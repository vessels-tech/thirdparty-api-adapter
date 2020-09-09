/*****
 License
 --------------
 Copyright © 2020 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
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

 * Lewis Daly <lewisd@crosslaketech.com>
 --------------
 ******/
import { Server } from '@hapi/hapi'
import { ServiceConfig } from '~/shared/config'

const defaultMockConfig: ServiceConfig = {
  PACKAGE: {
    version: '11.0.0'
  },
  PORT: 1234,
  HOST: 'auth-service.local',
  ENDPOINT_CACHE_CONFIG: {
    expiresIn: 5000,
    generateTimeout: 5000
  },
  ENDPOINT_SERVICE_URL: 'central-ledger.local',
  ERROR_HANDLING: {
    includeCauseExtension: true,
    truncateExtensions: true,
  },
  INSTRUMENTATION: {
    METRICS: {
      DISABLED: false,
      labels: {
        eventId: "*"
      },
      config: {
        timeout: 5000,
        prefix: "moja_3p_api"
      }
    }
  },
  KAFKA: {
    TOPIC_TEMPLATES: {
      GENERAL_TOPIC_TEMPLATE: {
        TEMPLATE: 'topic-{{functionality}}-{{action}}',
        REGEX: 'topic-(.*)-(.*)'
      }
    },
    CONSUMER: [
      // TODO: fix
      // {
      //   eventType: "notification",
      //   eventAction: "event",
      //   "options": {
      //     "mode": 2,
      //     "batchSize": 1,
      //     "pollFrequency": 10,
      //     "recursiveTimeout": 100,
      //     "messageCharset": "utf8",
      //     "messageAsJSON": true,
      //     "sync": true,
      //     "consumeTimeout": 1000
      //   },
      //   "rdkafkaConf": {
      //     "client.id": "3p-con-notification-event",
      //     "group.id": "3p-group-notification-event",
      //     "metadata.broker.list": "localhost:9092",
      //     "socket.keepalive.enable": true
      //   },
      //   "topicConf": {
      //     "auto.offset.reset": "earliest"
      //   }
      // }
    ]
  },
  MOCK_CALLBACK: {
    transactionRequestId: '12345',
    pispId: 'pisp'
  }
}

let mockInitializeCache: any;
let mockSetupMetrics: any;

describe('start', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    //Make sure the Config gets re-imported
    jest.resetModules()

    // Since we need to reset modules between every test
    // we must also import inline the modules we need to mock
    const Util = (await import('@mojaloop/central-services-shared')).Util
    const Metrics = (await import('@mojaloop/central-services-metrics')).default
    mockInitializeCache = jest.spyOn(Util.Endpoints, 'initializeCache')
    mockSetupMetrics = jest.spyOn(Metrics, 'setup')
  })

  it('starts with Metrics Disabled', async () => {
    // Arrange
    jest.mock('../../../src/shared/config', () => ({
      __esModule: true,
      default: {
        ...defaultMockConfig,
        INSTRUMENTATION: {
          METRICS: {
            DISABLED: true
          }
        }
      }
    }))
    const { default: start } = await import('~/server/start')

    const mockServer = {
      info: {
        uri: 'test.com'
      },
      start: jest.fn().mockResolvedValueOnce(undefined)
    } as unknown as Server

    mockInitializeCache.mockResolvedValueOnce(true)

    // Act
    const result = await start(mockServer)

    // Assert
    expect(mockInitializeCache).toHaveBeenCalledTimes(1)
    expect(mockSetupMetrics).toHaveBeenCalledTimes(0)
    expect(mockServer.start).toHaveBeenCalledTimes(1)
    expect(result).toStrictEqual(mockServer)
  })

  it('starts with Metrics Enabled', async () => {
    // Arrange
    jest.mock('../../../src/shared/config', () => ({
      __esModule: true,
      default: defaultMockConfig
    }))
    const { default: start } = await import('~/server/start')

    const mockServer = {
      info: {
        uri: 'test.com'
      },
      start: jest.fn().mockResolvedValueOnce(undefined)
    } as unknown as Server
    mockInitializeCache.mockResolvedValueOnce(true)

    // Act
    const result = await start(mockServer)

    // Assert
    expect(mockInitializeCache).toHaveBeenCalledTimes(1)
    expect(mockSetupMetrics).toHaveBeenCalledTimes(1)
    expect(mockSetupMetrics).toHaveBeenCalledWith(defaultMockConfig.INSTRUMENTATION.METRICS.config)
    expect(mockServer.start).toHaveBeenCalledTimes(1)
    expect(result).toStrictEqual(mockServer)
  })

})
