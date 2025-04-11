import { Router } from "@oak/oak";

import { createMiddlewareAuthorizeClient } from "./client-auth.middleware.ts";
import { createControllerUpdateIp } from "./dynip-update.controller.ts";
import type { AccountService, EventStore, PublishApplicationEventService } from "./interfaces.ts";
import { createControllerGetHealth } from "./health.controller.ts";


export function createApiRouter(accountService: AccountService, eventstoreService: EventStore, pubsub: PublishApplicationEventService) {

    const router = new Router();

    router.get("/update", createMiddlewareAuthorizeClient(accountService), createControllerUpdateIp(accountService, eventstoreService, pubsub));
    router.get("/health", createControllerGetHealth());

    return router
}