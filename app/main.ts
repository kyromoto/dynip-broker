import { Application } from '@oak/oak'
import { oakCors as cors } from "@tajpouria/cors"

import { version } from "./version.ts";
import { logger } from "./share/logger.ts"
import { config } from "./share/config.ts"
import { createApiRouter } from "./controllers/routes.ts"
import { createActionHetznerFirewallRule } from "./actions/hetzner-firewall-rule/action.ts";
import { createActionHetznerDnsRecord } from "./actions/hetzner-dns-record/action.ts";
import { YAMLAccountService } from "./services/account-repository/account.repository.ts";
import { PublishIpUpdateRequestServiceAdapter, SubscribeIpUpdateRequestServiceAdapter } from "./adapter/pubsub.adapter.ts";
import { JSONEventStore } from "./services/event-store/eventstore.service.ts";
import { createMiddlewareErrorHandler } from "./controllers/error.middleware.ts";
import { connectToNats, getNatsConnectionOptions } from "./services/messaging/nats.ts";
import { createMiddlewareRequestLogging } from "./controllers/logger.middleware.ts";



logger.info(`dynip-broker v${version}`)

const nc = await connectToNats(getNatsConnectionOptions(config));


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
app.use(createMiddlewareRequestLogging());
app.use(cors());
app.use(router.routes(), router.allowedMethods());

app.listen({ port: config.server.port });