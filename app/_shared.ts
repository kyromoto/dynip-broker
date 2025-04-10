import { AsyncLocalStorage } from "node:async_hooks";

export class CorrelationIdContext {

    private storage = new AsyncLocalStorage<string>()

    get CorrelationId() {
        return this.storage.getStore() || crypto.randomUUID()
    }

    get Storage() {
        return this.storage
    }

}