import { Router } from "@oak/oak";

import { AccountService, createControllerUpdateIp, createMiddlewareAuthorizeClient, EventStore, PublishApplicationEventService } from "./controller.ts";


export function createApiRouter(accountService: AccountService, eventstoreService: EventStore, pubsub: PublishApplicationEventService) {

    const router = new Router();

    router.get("/update", createMiddlewareAuthorizeClient(accountService), createControllerUpdateIp(accountService, eventstoreService, pubsub));

    return router
}