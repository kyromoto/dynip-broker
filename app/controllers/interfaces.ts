import type { ApplicationEvent } from "../share/events.ts";
import type { Account } from "../services/account-repository/account.models.ts";



export interface EventStoreAPI {
    getEventStream(con4xtId: string, filterBySubject?: string): Promise<ApplicationEvent[]>
}

export interface EventStore {
    publishEvents(contextId: string, tx: (api: EventStoreAPI) => Promise<ApplicationEvent[]>): Promise<ApplicationEvent[]>
}

export interface PublishApplicationEventService {
    publish: (contextId: string, events: ApplicationEvent[]) => Promise<void>
}

export interface AccountService {
    getAccounts(contextId: string): Promise<Account[]>
}