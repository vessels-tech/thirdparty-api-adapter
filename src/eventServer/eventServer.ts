import { ServiceConfig } from '~/shared/config';


/**
 * @function create
 * @description Creates the Kafka Consumer server based on config
 * @param { ServiceConfig } config
 */
export async function create (config: ServiceConfig): Promise<any> {
  
}

export async function start (consumer: any): Promise<any> {
  
}

export default async function run (config: ServiceConfig): Promise<any> {
  const consumer = await create(config)

  return start(consumer)
}