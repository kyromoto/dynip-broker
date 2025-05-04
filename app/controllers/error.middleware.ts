import type { Context, Next } from "@oak/oak";
import { logger } from "../share/logger.ts"
import { ApplicationError, ClientError } from "../share/errors.ts";
import { getCorrelationId } from "../share/correlation-context.ts";



export function createMiddlewareErrorHandler () {

    return async (ctx: Context, next: Next) => {
    
        try {
            await next()
        } catch (error) {

            const contextId = ctx.state.CorrelationContextId;
            const correlationId = getCorrelationId(contextId)
            const log = logger.getChild("http-error").with({ correlation_id: correlationId })

            if (error instanceof ClientError) {
                log.error(error.message, { type: "client", ...error.meta })
                ctx.response.status = error.status
                ctx.response.body = error.message
                return
            }
            
            if (error instanceof ApplicationError) {
                log.error(error.message, { type: "application", ...error.meta })
                ctx.response.status = 500
                ctx.response.body = "Internal Application Error"
                return
            }

            log.error("unknown error", { type: "unknown", error })
            ctx.response.status = 500
            ctx.response.body = "Internal Server Error"

        }
    }
}