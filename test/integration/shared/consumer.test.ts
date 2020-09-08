import Consumer, { InternalConsumerConfig } from '~/shared/consumer'
import { EventActionEnum, EventTypeEnum } from '@mojaloop/central-services-shared'
const internalConfig = require('../data/notification_event_config.json')

describe('Consumer', () => {
  it('creates and consumer and connects', async () => {
    // Arrange
    const config: InternalConsumerConfig = {
      //TODO
      eventAction: EventActionEnum.EVENT,
      eventType: EventTypeEnum.NOTIFICATION,
      internalConfig: internalConfig
    }
    const handler = () => { console.log('handled thingo!')}

    const consumer = new Consumer(config, `topic-{{functionality}}-{{action}}`, handler)
    await consumer.start()
    
    // Act
    const result = await consumer.isConnected()

    // Assert
    expect(result).toBe(true)
  })

  it.todo('disconnects from a connected consumer')
  it.todo('fails to disconnect from a not-connected consumer')
  it.todo('fails to connect with invalid config')
  // we may not be able to test this...
  it.todo('calls the handler function?')
})