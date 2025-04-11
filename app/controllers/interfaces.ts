import type { ApplicationEvent } from "../events.ts";
import type { Account } from "../services/account-repository/account.models.ts";



export interface EventStoreAPI {
    getEventStream(filterBySubject?: string): Promise<ApplicationEvent[]>
}

export interface EventStore {
    publishEvents(tx: (api: EventStoreAPI) => Promise<ApplicationEvent[]>): Promise<ApplicationEvent[]>
}

export interface PublishApplicationEventService {
    publish: (events: ApplicationEvent[]) => Promise<void>
}

export interface AccountService {
    getAccounts(): Promise<Account[]>
}