import type { Context, Next } from "@oak/oak";
import { httpLogger } from "../share/logger.ts";
import { getCorrelationId } from "../share/correlation-context.ts";


const getMeta = (ctx: Context, durationMs: number, cid: string) => {
    return {
        correlation_id: cid,
        method: ctx.request.method,
        url: ctx.request.url,
        status: ctx.response.status,
        duration_ms: durationMs,
        headers: Object.fromEntries(ctx.request.headers.entries())
    }
}

const getMessage = (ctx: Context, durationMs: number, error: unknown | undefined | null) => {
    const success = error ? "ERROR" : "COMPLETED"
    return `${success}: ${ctx.request.method} ${ctx.request.url} ${ctx.response.status} ${durationMs}ms`
}


export function createMiddlewareRequestLogging () {

    return async (ctx: Context, next: Next) => {

        const start = Date.now()
        const contextId = ctx.state.CorrelationContextId
        const correlationId = getCorrelationId(contextId)
        const log = httpLogger.getChild("http-request").with({ correlation_id: correlationId })

        try {
            await next()
        } catch (error: unknown) {
            throw error
        } finally {
            
            const durationMs = Date.now() - start
            const message = getMessage(ctx, durationMs, null)
            const meta = getMeta(ctx, durationMs, correlationId)
            
            if (ctx.response.status >= 500) {
                log.error(message, meta)
            } else if (ctx.response.status >= 400) {
                log.warn(message, meta)
            } else {
                log.info(message, meta)
            }

        }

    }

}