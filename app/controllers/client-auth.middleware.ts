import { decodeBase64 } from "@std/encoding/base64";
import type { Context, Next } from "@oak/oak";

import { DynipProtoError } from "../share/errors.ts";
import type { AccountService } from "./interfaces.ts";
import { logger } from "../share/logger.ts";
import { CorrelationIdContext } from "../share/correltionid.ts";








export function createMiddlewareAuthorizeClient (accountService: AccountService) {

    const cidContext = CorrelationIdContext.getInstance()
    const mwLogger = logger.getChild('client-auth-middleware')

    return async (ctx: Context, next: Next) => {

        const log = mwLogger.getChild(cidContext.CorrelationId)

        log.debug(`Authorize client`)

        const accounts = await accountService.getAccounts()
        const clients = accounts.reduce<ClientProjection[]>((clients, account) => {
            
            const mappedClients = account.clients.map(client => ({
                ...client,
                belongsTo: {
                    account: account.username
                }
            }))
            
            return [...clients, ...mappedClients]

        }, [])

        const header = ctx.request.headers.get("Authorization")
        const clientname = ctx.request.url.searchParams.get("client")
        
        log.debug("client requests auth", { header, clientname })

        if (!clientname) {
            throw new DynipProtoError("Missing parameter 'client'", 400, "badauth")
        }

        if (!header) {
            throw new DynipProtoError("Missing Authorization header", 401, "badauth")
        }

        if (!header.startsWith("Basic ")) {
            throw new DynipProtoError("Invalid Authorization header", 401, "badauth")
        }

        const baHeaderPayload = header.slice(`Basic `.length)
        const baUInt8Array = decodeBase64(baHeaderPayload)
        const baPayloadDecoded = new TextDecoder().decode(baUInt8Array)
        const [username, password] = baPayloadDecoded.split(":")

        if (!username || !password) {
            throw new DynipProtoError("Invalid Authorization header", 401, "badauth")
        }

        log.debug(`Search client by ${clientname}`)

        const client = clients.find(client => client.name === clientname)

        if (!client) {
            throw new DynipProtoError("Client not found", 404, "nohost")
        }

        if (client.username !== username || client.password !== password) {
            throw new DynipProtoError(`Invalid credentials for client ${client.name}`, 401, "badauth")
        }

        ctx.state.client = client.name
        ctx.state.account = client.belongsTo.account

        await next()

    }

}




export type ClientProjection = {
    name: string,
    username: string,
    password: string,
    actions: string[],
    belongsTo: {
        account: string
    }
}