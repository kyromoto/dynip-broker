import type { Context, Next } from "@oak/oak";
import { CorrelationIdContext } from "../share/correltionid.ts";
import { httpLogger } from "../share/logger.ts";


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

    const cidContext = CorrelationIdContext.getInstance()

    return async (ctx: Context, next: Next) => {

        const start = Date.now()
        const cid = cidContext.CorrelationId

        try {
            await next()

            const durationMs = Date.now() - start
            const message = getMessage(ctx, durationMs, null)
            const meta = getMeta(ctx, durationMs, cid)
            
            
            if (ctx.response.status >= 500) {
                httpLogger.error(message, meta)
            } else if (ctx.response.status >= 400) {
                httpLogger.warn(message, meta)
            } else {
                httpLogger.info(message, meta)
            }

        } catch (error: unknown) {
            const durationMs = Date.now() - start
            httpLogger.error(getMessage(ctx, durationMs, error), { ...getMeta(ctx, durationMs, cid), error})

            throw error
        }

    }

}