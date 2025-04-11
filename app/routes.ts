import { Router } from "@oak/oak";

import { createMiddlewareAuthorizeClient } from "./controllers/client-auth.middleware.ts";
import { createControllerUpdateIp } from "./controllers/dynip-update.controller.ts";
import type { AccountService, EventStore, PublishApplicationEventService } from "./controllers/interfaces.ts";


export function createApiRouter(accountService: AccountService, eventstoreService: EventStore, pubsub: PublishApplicationEventService) {

    const router = new Router();

    router.get("/update", createMiddlewareAuthorizeClient(accountService), createControllerUpdateIp(accountService, eventstoreService, pubsub));

    return router
}