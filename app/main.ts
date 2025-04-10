import { Application } from '@oak/oak'
import { oakCors as cors } from "@tajpouria/cors"

import { logger } from "./logger.ts"
import { loadConfig } from "./config.ts"
import { createApiRouter } from "./routes.ts"
import { createActionHetznerFirewallRule } from "./actions/hetzner-firewall-rule.action.ts";
import { createActionHetznerDnsRecord } from "./actions/hetzner-dns-record.action.ts";
import { YAMLAccountService } from "./services/account.service.ts";
import { PublishIpUpdateRequestServiceAdapter, SubscribeIpUpdateRequestServiceAdapter } from "./adapter/pubsub.adapter.ts";
import { JSONEventStore } from "./services/event-store.service.ts";
import { createMiddlewareErrorHandler } from "./controller.ts";
import { CONFIG_FILE } from "./_environments.ts";
import { connectToNats, getNatsConnectionOptions } from "./nats.ts";


const config = await loadConfig(CONFIG_FILE);
const nc = await connectToNats(getNatsConnectionOptions(config));

// (async () => {
//     const error = await nc.closed();

//     if (error) {
//         logger.fatal(`NATS disconnected with error: ${error.message}`);
//     } else {
//         logger.fatal("NATS disconnected");
//     }

//     Deno.exit(1);

// })();


const accountService = await (async () => {
    switch(config.accountstore.type) {

        case "YAML": {
            return await YAMLAccountService.init(config.accountstore.filename)
        }

        default: throw new Error(`Unknown accountstore type: ${config.accountstore.type}`)

    }
})()

const eventstoreService = await (async () => {
    switch(config.eventstore.type) {

        case "JSON": {
            return await JSONEventStore.init(config.eventstore.filename)
        }

        default: throw new Error(`Unknown eventstore type: ${config.eventstore.type}`)
    }
})()

const eventPublishService = new PublishIpUpdateRequestServiceAdapter(nc);
const eventSubscribeService = new SubscribeIpUpdateRequestServiceAdapter(nc);

createActionHetznerFirewallRule(
    accountService.getHetznerFirewallRuleAccountService(),
    eventstoreService.getHetznerFirewallRuleClientIpsProjector(),
    eventSubscribeService
)

createActionHetznerDnsRecord(
    accountService.getHetznerDnsRecordAccountService(),
    eventSubscribeService
)



const app = new Application();

app.addEventListener("listen", ev => {
    logger.info(`API listening ${ev.hostname}:${ev.port}`, { host: ev.hostname, port: ev.port });
})

app.addEventListener("close", () => {
    logger.warn("API closed");
    Deno.exit(0);
})

app.addEventListener("error", ev => {
    logger.fatal(`API error: ${ev.error}`, { error: ev.error.message });
    Deno.exit(1);
})

const router = createApiRouter(accountService.getApiControllerAccountService(), eventstoreService, eventPublishService);

app.use(createMiddlewareErrorHandler());
app.use(cors());
app.use(router.routes(), router.allowedMethods());

app.listen({ port: config.server.port });