import { EventTypeEnum, EventActionEnum, Util } from '@mojaloop/central-services-shared'
import { ConsumeCallback, Kafka, RdKafkaConsumerConfig } from '@mojaloop/central-services-stream'
import { promisify } from 'util'

export interface ConsumerConfig {
  eventAction: EventActionEnum;
  eventType: EventTypeEnum;
  internalConfig: RdKafkaConsumerConfig;
}

/**
 * @class Consumer
 * @description A utility class that wraps around the `@mojaloop/central-services-stream` Kafka Consumer
 */
export default class Consumer {
  private topicName: string;
  private rdKafkaConsumer: Kafka.Consumer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlerFunc: ConsumeCallback<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor (config: ConsumerConfig, topicTemplate: string, handlerFunc: ConsumeCallback<any>) {
    const topicConfig = Util.Kafka.createGeneralTopicConf(topicTemplate, config.eventType, config.eventAction)
    this.topicName = topicConfig.topicName
    config.internalConfig.rdkafkaConf['client.id'] = this.topicName

    // Create the internal consumer
    this.rdKafkaConsumer = new Kafka.Consumer([this.topicName], config.internalConfig)

    this.handlerFunc = handlerFunc
  }

  /**
   * @function start
   * @description Start the consumer listening for kafka events
   */
  public async start (): Promise<void> {
    await this.rdKafkaConsumer.connect()
    this.rdKafkaConsumer.consume(this.handlerFunc)
  }

  /**
   * @function isConnected
   * @description Use this to determine whether or not we are connected to the broker. Internally, it calls `getMetadata` to determine
   * if the broker client is connected.
   *
   * @returns {true} - if connected
   * @throws {Error} - if we can't find the topic name, or the consumer is not connected
   */
  public async isConnected (): Promise<true> {
    const getMetadataPromise = promisify(this.rdKafkaConsumer.getMetadata)
      .bind(this.rdKafkaConsumer)
    const getMetadataConfig = {
      topic: this.topicName,
      timeout: 3000
    }

    const metadata = await getMetadataPromise(getMetadataConfig)

    const foundTopics = metadata.topics.map(topic => topic.name)
    if (foundTopics.indexOf(this.topicName) === -1) {
      throw new Error(`Connected to consumer, but ${this.topicName} not found.`)
    }

    return true
  }

  /**
   * @function disconnect
   * @description Disconnect from the consumer
   * @returns {Promise<void>} - Passes on the Promise from Consumer.disconnect()
   * @throws {Error} - if there is a failure in rdkafka's disconnect
   */
  public async disconnect (): Promise<void> {
    const disconnectPromise = promisify(this.rdKafkaConsumer.disconnect)
      .bind(this.rdKafkaConsumer)
    return disconnectPromise()
  }
}
