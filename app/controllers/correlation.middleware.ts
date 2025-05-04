import type { Context, Next } from "@oak/oak";
import { withCorrelationId } from "../share/correlation-context.ts";


const CORRELATION_ID_HEADER = "X-Correlation-Id"

export function createMiddlewareCorrelation () {
    
    return async (ctx: Context, next: Next) => {
        
        const cid = ctx.request.headers.get(CORRELATION_ID_HEADER) || crypto.randomUUID()
        
        ctx.response.headers.set(CORRELATION_ID_HEADER, cid)
        
        await withCorrelationId(cid, async contextId => {
           ctx.state.CorrelationContextId = contextId
           await next() 
        })

    }

}