class CorrelationContext {

    private static storage = new Map<number, string>();

    private static nextId = 0;

    public static createContext(cid: string) {
        const contextId = this.nextId++
        this.storage.set(contextId, cid)
        return contextId
    }

    public static getCorrelationId(contextId: number) {
        return this.storage.get(contextId)
    }

    public static clearContext(contextId: number) {
        this.storage.delete(contextId)
    }

}



export function withCorrelationId<T> (cid: string, fn: (contextId: number) => Promise<T>) : Promise<T> {
    
    const contextId = CorrelationContext.createContext(cid)
    const promise = fn(contextId)
    
    promise.finally(() => {
        CorrelationContext.clearContext(contextId)
    })
    
    return promise

}


export function getCorrelationId(contextId: number) {
    return CorrelationContext.getCorrelationId(contextId) || "unknown"
}