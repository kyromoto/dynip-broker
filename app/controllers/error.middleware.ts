import type { Context, Next } from "@oak/oak";
import { logger } from "../_share/logger.ts"
import { CorrelationIdContext } from "../_share/correltionid-context.ts";
import { ApplicationError, ClientError } from "../_share/errors.ts";

export function createMiddlewareErrorHandler () {

    const httpLogger = logger.getChild("http-error")
    const cidContext = CorrelationIdContext.getInstance()

    return async (ctx: Context, next: Next) => {
    
        try {
            const cid = ctx.request.headers.get("X-Correlation-Id") || crypto.randomUUID()
            ctx.response.headers.set("X-Correlation-Id", cid)
            await cidContext.Storage.run(cid, next)
        } catch (error) {

            const log = httpLogger.getChild(cidContext.CorrelationId).with({ correlation_id: cidContext.CorrelationId })

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