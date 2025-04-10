import { connect, ConnectionOptions, NatsConnection } from "@nats-io/transport-deno";

import { AppConfig } from "./config.ts";
import { logger } from "./logger.ts";


export async function connectToNats (options: ConnectionOptions) : Promise<NatsConnection> {
    
    const nc = await connect(options)
    
    onClosed(nc)

    logger.info(`NATS connected [${options.servers}]`, { options })

    return nc
}


async function onClosed (nc: NatsConnection) {
    
    const error = await nc.closed()

    if (error) {
        logger.fatal(`NATS disconnected with error: ${error.message}`);
    } else {
        logger.fatal("NATS disconnected");
    }

    Deno.exit(1)

}


export function getNatsConnectionOptions (config: AppConfig) : ConnectionOptions {
    return {
        servers: config.nats.servers.map(server => `${server.host}:${server.port}`),
        ...(config.nats.token && { token: config.nats.token }),
        reconnect: false
    }
}