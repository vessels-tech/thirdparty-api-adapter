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

 - Lewis Daly <lewisd@crosslaketech.com>
 - Sridhar Voruganti <sridhar.voruganti@modusbox.com>

 --------------
 ******/

import { Authorizations } from '~/domain/thirdpartyRequests'
import Logger from '@mojaloop/central-services-logger'
import {
  Util, Enum
} from '@mojaloop/central-services-shared'
import { ReformatFSPIOPError } from '@mojaloop/central-services-error-handling'
import Span from 'test/unit/__mocks__/span'
import * as types from '~/interface/types'

const mockGetEndpoint = jest.spyOn(Util.Endpoints, 'getEndpoint')
const mockSendRequest = jest.spyOn(Util.Request, 'sendRequest')
const mockLoggerPush = jest.spyOn(Logger, 'push')
const mockLoggerError = jest.spyOn(Logger, 'error')

describe('domain/authorizations', () => {
  describe('forwardAuthorizationRequest', () => {
    const path = Enum.EndPoints.FspEndpointTemplates.TP_TRANSACTION_REQUEST_AUTHORIZATIONS_POST
    const endpointType = Enum.EndPoints.FspEndpointTypes.TP_CB_URL_TRANSACTION_REQUEST_AUTH_POST
    const errorEndpointType = Enum.EndPoints.FspEndpointTypes.TP_CB_URL_TRANSACTION_REQUEST_AUTH_PUT_ERROR
    const method = Enum.Http.RestMethods.POST

    beforeEach((): void => {
      jest.clearAllMocks()
      mockLoggerPush.mockReturnValue(null)
      mockLoggerError.mockReturnValue(null)
    })

    it('forwards the POST `thirdpartyRequests/transactions/{id}/authorizations request', async () => {
      // Arrange
      mockGetEndpoint.mockResolvedValue('http://auth-service.local')
      mockSendRequest.mockResolvedValue({ status: 202, payload: null })
      const headers = {
        'fspiop-source': 'pispA',
        'fspiop-destination': 'dfspA'
      }
      const id = '123456'
      const payload: types.AuthorizationPayload = {
        challenge: '12345',
        value: '12345',
        consentId: '12345',
        sourceAccountId: 'dfspa.12345.67890',
        status: types.AuthorizationStatus.PENDING
      }

      const getEndpointExpected = [
        'http://central-ledger.local:3001',
        'dfspA',
        endpointType
      ]
      const sendRequestExpected = [
        'http://auth-service.local/thirdpartyRequests/transactions/123456/authorizations',
        headers,
        'pispA',
        'dfspA',
        Enum.Http.RestMethods.POST,
        payload,
        Enum.Http.ResponseTypes.JSON,
        expect.objectContaining({ isFinished: false })
      ]
      const mockSpan = new Span()

      // Act
      await Authorizations.forwardAuthorizationRequest(path, endpointType, headers, method, id, payload, mockSpan)

      // Assert
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpected)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpected)
    })

    it('handles `getEndpoint` failure', async () => {
      // Arrange
      mockGetEndpoint
        .mockRejectedValueOnce(new Error('Cannot find endpoint'))
        .mockResolvedValueOnce('http://pispA.local')
      const headers = {
        'fspiop-source': 'pispA',
        'fspiop-destination': 'dfspA'
      }
      const id = '123456'
      const payload: types.AuthorizationPayload = {
        challenge: '12345',
        value: '12345',
        consentId: '12345',
        sourceAccountId: 'dfspa.12345.67890',
        status: types.AuthorizationStatus.PENDING
      }
      const mockSpan = new Span()

      const getEndpointExpectedFirst = [
        'http://central-ledger.local:3001',
        'dfspA',
        endpointType
      ]
      const getEndpointExpectedSecond = [
        'http://central-ledger.local:3001',
        'pispA',
        errorEndpointType
      ]

      // Act
      const action = async () => await Authorizations.forwardAuthorizationRequest(path, endpointType, headers, method, id, payload, mockSpan)

      // Assert
      await expect(action).rejects.toThrow('Cannot find endpoint')
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedFirst)
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedSecond)
      // Children's children in `forwardAuthorizationRequestError()`
      expect(mockSpan.child?.child?.finish).toHaveBeenCalledTimes(1)
      expect(mockSpan.child?.child?.error).toHaveBeenCalledTimes(0)
      // Children in `forwardAuthorizationRequest()`
      expect(mockSpan.child?.finish).toHaveBeenCalledTimes(1)
      expect(mockSpan.child?.error).toHaveBeenCalledTimes(1)
    })

    it('handles `getEndpoint` failure twice', async () => {
      // Arrange
      mockGetEndpoint
        .mockRejectedValue(new Error('Cannot find endpoint first time'))
        .mockRejectedValue(new Error('Cannot find endpoint second time'))
      const headers = {
        'fspiop-source': 'pispA',
        'fspiop-destination': 'dfspA'
      }
      const id = '123456'
      const payload: types.AuthorizationPayload = {
        challenge: '12345',
        value: '12345',
        consentId: '12345',
        sourceAccountId: 'dfspa.12345.67890',
        status: types.AuthorizationStatus.PENDING
      }

      const getEndpointExpectedFirst = [
        'http://central-ledger.local:3001',
        'dfspA',
        endpointType
      ]
      const getEndpointExpectedSecond = [
        'http://central-ledger.local:3001',
        'pispA',
        errorEndpointType
      ]

      // Act
      const action = async () => await Authorizations.forwardAuthorizationRequest(path, endpointType, headers, method, id, payload)

      // Assert
      await expect(action).rejects.toThrow('Cannot find endpoint second time')
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedFirst)
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedSecond)
    })

    it('handles `sendRequest` failure', async () => {
      // Arrange
      mockGetEndpoint
        .mockResolvedValueOnce('http://auth-service.local')
        .mockResolvedValueOnce('http://pispA.local')
      mockSendRequest
        .mockRejectedValueOnce(new Error('Failed to send HTTP request'))
        .mockResolvedValue({ status: 202, payload: null })
      const headers = {
        'fspiop-source': 'pispA',
        'fspiop-destination': 'dfspA'
      }
      const id = '123456'
      const payload: types.AuthorizationPayload = {
        challenge: '12345',
        value: '12345',
        consentId: '12345',
        sourceAccountId: 'dfspa.12345.67890',
        status: types.AuthorizationStatus.PENDING
      }
      const mockSpan = new Span()
      const errorPayload = ReformatFSPIOPError(new Error('Failed to send HTTP request')).toApiErrorObject(true, true)

      const getEndpointExpectedFirst = [
        'http://central-ledger.local:3001',
        'dfspA',
        endpointType
      ]
      const getEndpointExpectedSecond = [
        'http://central-ledger.local:3001',
        'pispA',
        errorEndpointType
      ]
      const sendRequestExpectedFirst = [
        'http://auth-service.local/thirdpartyRequests/transactions/123456/authorizations',
        headers,
        'pispA',
        'dfspA',
        Enum.Http.RestMethods.POST,
        payload,
        Enum.Http.ResponseTypes.JSON,
        expect.objectContaining({ isFinished: false })
      ]
      const sendRequestExpectedSecond = [
        'http://pispA.local/thirdpartyRequests/transactions/123456/authorizations/error',
        { 'fspiop-source': 'switch', 'fspiop-destination': 'pispA' },
        'switch',
        'pispA',
        Enum.Http.RestMethods.PUT,
        errorPayload,
        Enum.Http.ResponseTypes.JSON,
        expect.objectContaining({ isFinished: false })
      ]

      // Act
      const action = async () => await Authorizations.forwardAuthorizationRequest(path, endpointType, headers, method, id, payload, mockSpan)

      // Assert
      await expect(action).rejects.toThrow('Failed to send HTTP request')
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedFirst)
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedSecond)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpectedFirst)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpectedSecond)
      // Children's children in `forwardAuthorizationRequestError()`
      expect(mockSpan.child?.child?.finish).toHaveBeenCalledTimes(1)
      expect(mockSpan.child?.child?.error).toHaveBeenCalledTimes(0)
      // Children in `forwardAuthorizationRequest()`
      expect(mockSpan.child?.finish).toHaveBeenCalledTimes(1)
      expect(mockSpan.child?.error).toHaveBeenCalledTimes(1)
    })

    it('handles `sendRequest` failure twice', async (): Promise<void> => {
      // Arrange
      mockGetEndpoint
        .mockResolvedValueOnce('http://auth-service.local')
        .mockResolvedValueOnce('http://pispA.local')
      mockSendRequest
        .mockRejectedValueOnce(new Error('Failed to send HTTP request first time'))
        .mockRejectedValueOnce(new Error('Failed to send HTTP request second time'))
      const headers = {
        'fspiop-source': 'pispA',
        'fspiop-destination': 'dfspA'
      }
      const id = '123456'
      const payload: types.AuthorizationPayload = {
        challenge: '12345',
        value: '12345',
        consentId: '12345',
        sourceAccountId: 'dfspa.12345.67890',
        status: types.AuthorizationStatus.PENDING
      }
      const errorPayload =
        ReformatFSPIOPError(new Error('Failed to send HTTP request first time')).toApiErrorObject(true, true)
      const getEndpointExpectedFirst = [
        'http://central-ledger.local:3001',
        'dfspA',
        endpointType
      ]
      const getEndpointExpectedSecond = [
        'http://central-ledger.local:3001',
        'pispA',
        errorEndpointType
      ]
      const sendRequestExpectedFirst = [
        'http://auth-service.local/thirdpartyRequests/transactions/123456/authorizations',
        headers,
        'pispA',
        'dfspA',
        Enum.Http.RestMethods.POST,
        payload,
        Enum.Http.ResponseTypes.JSON,
        undefined
      ]
      const sendRequestExpectedSecond = [
        'http://pispA.local/thirdpartyRequests/transactions/123456/authorizations/error',
        { 'fspiop-source': 'switch', 'fspiop-destination': 'pispA' },
        'switch',
        'pispA',
        Enum.Http.RestMethods.PUT,
        errorPayload,
        Enum.Http.ResponseTypes.JSON,
        undefined
      ]

      // Act
      const action = async () => await Authorizations.forwardAuthorizationRequest(path, endpointType, headers, method, id, payload)

      // Assert
      await expect(action).rejects.toThrow('Failed to send HTTP request second time')
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedFirst)
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpectedSecond)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpectedFirst)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpectedSecond)
    })
  })

  describe('forwardAuthorizationRequestError', () => {
    const path = Enum.EndPoints.FspEndpointTemplates.TP_TRANSACTION_REQUEST_AUTHORIZATIONS_PUT_ERROR

    beforeEach((): void => {
      jest.clearAllMocks()
      mockLoggerPush.mockReturnValue(null)
      mockLoggerError.mockReturnValue(null)
    })

    it('forwards the POST /../authorization error', async () => {
      // Arrange
      mockGetEndpoint.mockResolvedValue('http://pisp.local')
      mockSendRequest.mockResolvedValue({ status: 202, payload: null })
      const headers = {
        'fspiop-source': 'switch',
        'fspiop-destination': 'pispA'
      }
      const id = '123456'
      const fspiopError = ReformatFSPIOPError(new Error('Test Error'))
      const payload = fspiopError.toApiErrorObject(true, true)
      const getEndpointExpected = [
        'http://central-ledger.local:3001',
        'pispA',
        Enum.EndPoints.FspEndpointTypes.TP_CB_URL_TRANSACTION_REQUEST_AUTH_PUT_ERROR
      ]
      const sendRequestExpected = [
        'http://pisp.local/thirdpartyRequests/transactions/123456/authorizations/error',
        headers,
        'switch',
        'pispA',
        Enum.Http.RestMethods.PUT,
        payload,
        Enum.Http.ResponseTypes.JSON,
        undefined
      ]

      // Act
      await Authorizations.forwardAuthorizationRequestError(path, headers, id, payload)

      // Assert
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpected)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpected)
    })
  })

  describe('PUT : forwardAuthorizationRequest', () => {
    const path = Enum.EndPoints.FspEndpointTemplates.TP_TRANSACTION_REQUEST_AUTHORIZATIONS_PUT
    const endpointType = Enum.EndPoints.FspEndpointTypes.TP_CB_URL_TRANSACTION_REQUEST_AUTH_PUT
    const method = Enum.Http.RestMethods.PUT

    beforeEach((): void => {
      jest.clearAllMocks()
      mockLoggerPush.mockReturnValue(null)
      mockLoggerError.mockReturnValue(null)
    })

    it('forwards the PUT `thirdpartyRequests/transactions/{id}/authorizations request', async () => {
      const headers = {
        'fspiop-source': 'pispA',
        'fspiop-destination': 'dfspA'
      }
      const id = '123456'
      const payload: types.AuthorizationPayload = {
        challenge: '12345',
        value: '12345',
        consentId: '12345',
        sourceAccountId: 'dfspa.12345.67890',
        status: types.AuthorizationStatus.VERIFIED
      }
      // Arrange
      mockGetEndpoint.mockResolvedValue('http://auth-service.local')
      mockSendRequest.mockResolvedValue({ status: 202, payload: null })

      const getEndpointExpected = [
        'http://central-ledger.local:3001',
        'dfspA',
        endpointType
      ]
      const sendRequestExpected = [
        'http://auth-service.local/thirdpartyRequests/transactions/123456/authorizations',
        headers,
        'pispA',
        'dfspA',
        Enum.Http.RestMethods.PUT,
        payload,
        Enum.Http.ResponseTypes.JSON,
        expect.objectContaining({ isFinished: false })
      ]
      const mockSpan = new Span()

      // Act
      await Authorizations.forwardAuthorizationRequest(path, endpointType, headers, method, id, payload, mockSpan)

      // Assert
      expect(mockGetEndpoint).toHaveBeenCalledWith(...getEndpointExpected)
      expect(mockSendRequest).toHaveBeenCalledWith(...sendRequestExpected)
    })
  })
})
