import { AsyncLocalStorage } from "node:async_hooks";

export class CorrelationIdContext {

    private static instance: CorrelationIdContext

    public static getInstance() {
        
        if (!CorrelationIdContext.instance) {
            CorrelationIdContext.instance = new CorrelationIdContext()
        }

        return CorrelationIdContext.instance
    }

    private constructor() {}

    private storage = new AsyncLocalStorage<string>()

    get CorrelationId() {
        return this.storage.getStore() || crypto.randomUUID()
    }

    get Storage() {
        return this.storage
    }

}