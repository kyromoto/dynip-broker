import { decodeBase64 } from "@std/encoding/base64";
import type { Context, Next } from "@oak/oak";

import { DynipProtoError } from "../share/errors.ts";
import type { AccountService } from "./interfaces.ts";








export function createMiddlewareAuthorizeClient (accountService: AccountService) {

    return async (ctx: Context, next: Next) => {

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

        const clientname = ctx.request.url.searchParams.get("client")

        if (!clientname) {
            throw new DynipProtoError("Missing parameter 'client'", 400, "badauth")
        }

        const client = clients.find(client => client.name === clientname)

        if (!client) {
            throw new DynipProtoError("Client not found", 404, "nohost")
        }

        const header = ctx.request.headers.get("Authorization")

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