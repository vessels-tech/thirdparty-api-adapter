/*****
 License
 --------------
 Copyright © 2020 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 - Kevin Leyow <kevin.leyow@modusbox.com>

 --------------
 ******/

import Logger from '@mojaloop/central-services-logger'
import { Util, Enum } from '@mojaloop/central-services-shared'
import TestData from 'test/unit/data/mockData.json'
import Span from 'test/unit/__mocks__/span'
import  * as Consents from '~/domain/consents'
import { ReformatFSPIOPError } from '@mojaloop/central-services-error-handling'

const mockGetEndpoint = jest.spyOn(Util.Endpoints, 'getEndpoint')
const mockSendRequest = jest.spyOn(Util.Request, 'sendRequest')
const mockLoggerPush = jest.spyOn(Logger, 'push')
const mockLoggerError = jest.spyOn(Logger, 'error')
const mockData = JSON.parse(JSON.stringify(TestData))
const request = mockData.consentsPostRequest

const getEndpointExpected = [
  'http://central-ledger.local:3001',
  request.headers['fspiop-destination'],
  Enum.EndPoints.FspEndpointTypes.TP_CB_URL_CONSENT_POST
]

const getEndpointExpectedSecond = [
  'http://central-ledger.local:3001',
  request.headers['fspiop-source'],
  Enum.EndPoints.FspEndpointTypes.TP_CB_URL_CONSENT_PUT_ERROR
]

const expectedErrorHeaders = {
  'fspiop-source': Enum.Http.Headers.FSPIOP.SWITCH.value,
  'fspiop-destination': request.headers['fspiop-source']
}

const sendRequestExpected = [
  'http://dfspa-sdk/consents',
  request.headers,
  request.headers['fspiop-source'],
  request.headers['fspiop-destination'],
  Enum.Http.RestMethods.POST,
  request.payload,
  Enum.Http.ResponseTypes.JSON,
  expect.objectContaining({ isFinished: false })
]

describe('domain/consents', () => {
  describe('forwardConsentsRequest', () => {
    beforeEach((): void => {
      jest.clearAllMocks()
      mockLoggerPush.mockReturnValue(null)
      mockLoggerError.mockReturnValue(null)
    })

    it('forwards POST /consents request', async (): Promise<void> => {
      const mockSpan = new Span()
      mockGetEndpoint.mockResolvedValue('http://dfspa-sdk')
      mockSendRequest.mockResolvedValue({ ok: true, status: 202, statusText: 'Accepted', payload: null })
      await Consents.forwardConsentsRequest(
        Enum.EndPoints.FspEndpointTemplates.TP_CONSENT_POST,
        Enum.EndPoints.FspEndpointTypes.TP_CB_URL_CONSENT_POST,
        request.headers,
        Enum.Http.RestMethods.POST,
        request.payload,
        mockSpan
      )

      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpected)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpected)
    })


    it('handles `getEndpoint` failure', async (): Promise<void> => {
      const mockSpan = new Span()
      mockGetEndpoint
        .mockRejectedValueOnce(new Error('Cannot find endpoint'))
        .mockResolvedValueOnce('http://pispa-sdk')

      const action = async () => await Consents.forwardConsentsRequest(
        Enum.EndPoints.FspEndpointTemplates.TP_CONSENT_POST,
        Enum.EndPoints.FspEndpointTypes.TP_CB_URL_CONSENT_POST,
        request.headers,
        Enum.Http.RestMethods.POST,
        request.payload,
        mockSpan
      )

      await expect(action).rejects.toThrow('Cannot find endpoint')
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpected)
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedSecond)
      // Children's children in `forwardTransactionRequestError()`
      expect(mockSpan.child?.child?.finish).toHaveBeenCalledTimes(1)
      expect(mockSpan.child?.child?.error).toHaveBeenCalledTimes(0)
      // Children in `forwardTransactionRequest()`
      expect(mockSpan.child?.finish).toHaveBeenCalledTimes(1)
      expect(mockSpan.child?.error).toHaveBeenCalledTimes(1)
    })

    it('handles `getEndpoint` failure twice', async (): Promise<void> => {
      mockGetEndpoint
        .mockRejectedValue(new Error('Cannot find endpoint first time'))
        .mockRejectedValue(new Error('Cannot find endpoint second time'))

      const action = async () => await Consents.forwardConsentsRequest(
        Enum.EndPoints.FspEndpointTemplates.TP_CONSENT_POST,
        Enum.EndPoints.FspEndpointTypes.TP_CB_URL_CONSENT_POST,
        request.headers,
        Enum.Http.RestMethods.POST,
        request.payload,
      )

      await expect(action).rejects.toThrow('Cannot find endpoint second time')
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpected)
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedSecond)
      expect(mockSendRequest).not.toHaveBeenCalled()
    })

    it('handles `sendRequest` failure', async (): Promise<void> => {
      const mockSpan = new Span()
      const errorPayload =
        ReformatFSPIOPError(new Error('Failed to send HTTP request')).toApiErrorObject(true, true)
      const sendRequestErrExpected = [
        'http://pispa-sdk/consents/' + request.payload.id + '/error',
        expectedErrorHeaders,
        expectedErrorHeaders['fspiop-source'],
        expectedErrorHeaders['fspiop-destination'],
        Enum.Http.RestMethods.PUT,
        errorPayload,
        Enum.Http.ResponseTypes.JSON,
        expect.objectContaining({ isFinished: false })
      ]

      mockGetEndpoint
        .mockResolvedValueOnce('http://dfspa-sdk')
        .mockResolvedValue('http://pispa-sdk')
      mockSendRequest
        .mockRejectedValueOnce(new Error('Failed to send HTTP request'))
        .mockResolvedValue({ ok: true, status: 202, statusText: 'Accepted', payload: null })

      const action = async () => await Consents.forwardConsentsRequest(
        Enum.EndPoints.FspEndpointTemplates.TP_CONSENT_POST,
        Enum.EndPoints.FspEndpointTypes.TP_CB_URL_CONSENT_POST,
        request.headers,
        Enum.Http.RestMethods.POST,
        request.payload,
        mockSpan
      )
      await expect(action).rejects.toThrow('Failed to send HTTP request')
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpected)
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedSecond)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpected)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestErrExpected)
      // Children's children in `forwardTransactionRequestError()`
      expect(mockSpan.child?.child?.finish).toHaveBeenCalledTimes(1)
      expect(mockSpan.child?.child?.error).toHaveBeenCalledTimes(0)
      // Children in `forwardTransactionRequest()`
      expect(mockSpan.child?.finish).toHaveBeenCalledTimes(1)
      expect(mockSpan.child?.error).toHaveBeenCalledTimes(1)
    })

    it('handles `sendRequest` failure twice', async (): Promise<void> => {
      const mockSpan = new Span()
      const errorPayload =
        ReformatFSPIOPError(new Error('Failed to send HTTP request first time')).toApiErrorObject(true, true)
      const sendRequestErrExpected = [
        'http://pispa-sdk/consents/' + request.payload.id + '/error',
        expectedErrorHeaders,
        expectedErrorHeaders['fspiop-source'],
        expectedErrorHeaders['fspiop-destination'],
        Enum.Http.RestMethods.PUT,
        errorPayload,
        Enum.Http.ResponseTypes.JSON,
        expect.objectContaining({ isFinished: false })
      ]
      mockGetEndpoint
        .mockResolvedValueOnce('http://dfspa-sdk')
        .mockResolvedValue('http://pispa-sdk')
      mockSendRequest
        .mockRejectedValueOnce(new Error('Failed to send HTTP request first time'))
        .mockRejectedValueOnce(new Error('Failed to send HTTP request second time'))

      const action = async () => await Consents.forwardConsentsRequest(
        Enum.EndPoints.FspEndpointTemplates.TP_CONSENT_POST,
        Enum.EndPoints.FspEndpointTypes.TP_CB_URL_CONSENT_POST,
        request.headers,
        Enum.Http.RestMethods.POST,
        request.payload,
        mockSpan
      )

      await expect(action).rejects.toThrow('Failed to send HTTP request second time')
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpected)
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedSecond)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpected)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestErrExpected)
    })
  })
})

describe('domain/consents/{ID}', () => {
  describe('forwardConsentsIdRequestError', () => {
    const path = Enum.EndPoints.FspEndpointTemplates.TP_CONSENT_PUT_ERROR

    beforeEach((): void => {
      jest.clearAllMocks()
      mockLoggerPush.mockReturnValue(null)
      mockLoggerError.mockReturnValue(null)
    })

    it('forwards the PUT /consents/{ID} error', async () => {
      // Arrange
      mockGetEndpoint.mockResolvedValue('http://dfspa-sdk')
      mockSendRequest.mockResolvedValue({ status: 202, payload: null })
      const headers = {
        'fspiop-source': 'switch',
        'fspiop-destination': 'dfspA'
      }
      const id = '123456'
      const fspiopError = ReformatFSPIOPError(new Error('Test Error'))
      const payload = fspiopError.toApiErrorObject(true, true)
      const getEndpointErrorExpected = [
        'http://central-ledger.local:3001',
        'dfspA',
        Enum.EndPoints.FspEndpointTypes.TP_CB_URL_CONSENT_PUT_ERROR
      ]
      const sendRequestErrorExpected = [
        'http://dfspa-sdk/consents/123456/error',
        headers,
        'switch',
        'dfspA',
        Enum.Http.RestMethods.PUT,
        payload,
        Enum.Http.ResponseTypes.JSON,
        undefined
      ]

      // Act
      await Consents.forwardConsentsIdRequestError(
        path, id, headers, payload
      )

      // Assert
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointErrorExpected)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestErrorExpected)
    })
  })
})
