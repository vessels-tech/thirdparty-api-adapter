import { EventTypeEnum, EventActionEnum, Enum } from '@mojaloop/central-services-shared'
import { promisify } from 'util';

// TODO: typings!!!

const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const KafkaUtil = require('@mojaloop/central-services-shared').Util.Kafka


export interface InternalConsumerConfig {
  eventAction: EventActionEnum,
  eventType: EventTypeEnum,
  // TODO: make strict!
  rdKafkaConfig: any,
}


/**
 * @class Consumer
 * @description A utility wrapper around the `@mojaloop/central-services-stream` Kafka Consumer
 */
export default class Consumer {
  topicName: string;
  rdKafkaConsumer: any;
  handlerFunc: (...args: any) => any

  constructor(config: InternalConsumerConfig, topicTemplate: string, handlerFunc: (...args: any) => any) {
    // const topicConfig = KafkaUtil.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, ENUM.Events.Event.Type.NOTIFICATION, ENUM.Events.Event.Action.EVENT)
    const topicConfig = KafkaUtil.createGeneralTopicConf(topicTemplate, config.eventType, config.eventAction)
    this.topicName = topicConfig.topicName
    const generalConfig = KafkaUtil.getKafkaConfig(config.rdKafkaConfig, Enum.Kafka.Config.CONSUMER, config.eventType.toUpperCase(), config.eventAction.toUpperCase())
    // TODO: seems hacky to me...
    // @ts-ignore
    generalConfig.rdkafkaConf['client.id'] = this.topicName

    // Create the internal consumer
    this.rdKafkaConsumer = new KafkaConsumer([this.topicName], generalConfig)
    // TODO: not sure if we need to bind this?
    this.handlerFunc = handlerFunc
  }

  /**
   * @function start
   * @description Start the consumer listening for kafka events
   */
  async start(): Promise<void> {
    await this.rdKafkaConsumer.connect()
    await this.rdKafkaConsumer.consume(this.handlerFunc)
  }

  /**
   * @function isConnected
   * @description Use this to determine whether or not we are connected to the broker. Internally, it calls `getMetadata` to determine
   * if the broker client is connected.
   *
   * @returns {true} - if connected
   * @throws {Error} - if we can't find the topic name, or the consumer is not connected
   */
  async isConnected (): Promise<true>  {
    const getMetadataPromise = promisify(this.rdKafkaConsumer.getMetadata)
    const getMetadataConfig = {
      topic: this.topicName,
      timeout: 3000
    }
    // TODO: typings!!!
    const metadata = await getMetadataPromise(getMetadataConfig)

    const foundTopics = metadata.topics.map((topic: any) => topic.name)
    if (foundTopics.indexOf(this.topicName) === -1) {
      // Logger.isDebugEnabled && Logger.debug(`Connected to consumer, but ${this.topicName} not found.`)
      throw new Error(`Connected to consumer, but ${this.topicName} not found.`)
    }

    return true
  }

  /**
   * @function disconnect
   * @description Disconnect from the notificationConsumer
   * @returns Promise<*> - Passes on the Promise from Consumer.disconnect()
   * @throws {Error} - if the consumer hasn't been initialized, or disconnect() throws an error
   */
  async disconnect () {
    if (!this.rdKafkaConsumer || !this.rdKafkaConsumer.disconnect) {
      throw new Error('Tried to disconnect from consumer, but consumer is not initialized')
    }

    return this.rdKafkaConsumer.disconnect()
  }
}

/*

Logger.isInfoEnabled && Logger.info('Notification::startConsumer')
  let topicName
  try {
    const topicConfig = KafkaUtil.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, ENUM.Events.Event.Type.NOTIFICATION, ENUM.Events.Event.Action.EVENT)
    topicName = topicConfig.topicName
    Logger.isInfoEnabled && Logger.info(`Notification::startConsumer - starting Consumer for topicNames: [${topicName}]`)
    const config = KafkaUtil.getKafkaConfig(Config.KAFKA_CONFIG, ENUM.Kafka.Config.CONSUMER, ENUM.Events.Event.Type.NOTIFICATION.toUpperCase(), ENUM.Events.Event.Action.EVENT.toUpperCase())
    config.rdkafkaConf['client.id'] = topicName

    if (config.rdkafkaConf['enable.auto.commit'] !== undefined) {
      autoCommitEnabled = config.rdkafkaConf['enable.auto.commit']
    }
    notificationConsumer = new Consumer([topicName], config)
    await notificationConsumer.connect()
    Logger.isInfoEnabled && Logger.info(`Notification::startConsumer - Kafka Consumer connected for topicNames: [${topicName}]`)
    await notificationConsumer.consume(consumeMessage)
    Logger.isInfoEnabled && Logger.info(`Notification::startConsumer - Kafka Consumer created for topicNames: [${topicName}]`)
    return true
  } catch (err) {
    Logger.error(`Notification::startConsumer - error for topicNames: [${topicName}] - ${err}`)
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    Logger.error(fspiopError)
    throw fspiopError
  }
*/