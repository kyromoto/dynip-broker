import { decodeBase64 } from "@std/encoding/base64";
import { Context, Next } from "@oak/oak";
import { logger } from "./logger.ts";
import { ApplicationEvent, ClientIpV4UpdateRequestedEvent, ClientIpV6UpdateRequestedEvent } from "./events.ts";
import { Account } from "./services/account.service.ts";
import { CorrelationIdContext } from "./_shared.ts";
import { z } from "zod";


const cidContext = new CorrelationIdContext()


export type ClientProjection = {
    name: string,
    username: string,
    password: string,
    actions: string[],
    belongsTo: {
        account: string
    }
}


export class DynipProtoError extends Error {
    constructor (message: string, readonly status: number = 500, readonly body: 'badauth' | 'nohost' | 'dnserr' | '911'  = "911") {
        super(message)
    }
}



export class ClientError extends Error {
    constructor (message: string, readonly status: number = 400, readonly meta?: Record<string, any>) {
        super(message)
    }
}

export class ApplicationError extends Error {
    constructor (message: string, readonly meta?: Record<string, any>) {
        super(message)
    }
}


export interface PublishApplicationEventService {
    publish: (events: ApplicationEvent[]) => Promise<void>
}


export interface AccountService {
    getAccounts(): Promise<Account[]>
}


export interface EventStoreAPI {
    getEventStream(filterBySubject?: string): Promise<ApplicationEvent[]>
}

export interface EventStore {
    publishEvents(tx: (api: EventStoreAPI) => Promise<ApplicationEvent[]>): Promise<ApplicationEvent[]>
}



export function createMiddlewareErrorHandler () {

    const httpLogger = logger.getChild("http-error")

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




export function createMiddlewareAuthorizeClient (accountService: AccountService) {

    const mwLogger = logger.getChild("authorize-client-middleware")

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


export function createControllerUpdateIp (accountService: AccountService, eventstore: EventStore,  pubsub: PublishApplicationEventService) {

    return async (ctx: Context) => {

        if (!ctx.state.client) {
            throw new DynipProtoError("Missing client in context state", 500, "911")
        }

        if (!ctx.state.account) {
            throw new DynipProtoError("Missing account in context state", 500, "911")
        }

        const requestIp = ctx.request.ip
        const ipv4 = ctx.request.url.searchParams.get("ipv4")
        const ipv6 = ctx.request.url.searchParams.get("ipv6")

        const validIPv4 = z.string().ip({ version: "v4" }).safeParse(ipv4)
        const validIPv6 = z.string().ip({ version: "v6" }).safeParse(ipv6)
        const validRequestIp = z.string().ip().safeParse(requestIp)

        if (ipv4 && !validIPv4.success) {
            throw new DynipProtoError("Invalid ipv4", 400, "dnserr")
        }

        if (ipv6 && !validIPv6.success) {
            throw new DynipProtoError("Invalid ipv6", 400, "dnserr")
        }

        if (!ipv4 && !ipv6 && !validRequestIp.success) {
            throw new DynipProtoError("IP from request could not be parsed", 500, "911")
        }

        const ips = !ipv4 && !ipv6 ? [requestIp] : [...(ipv4 ? [ipv4] : []), ...(ipv6 ? [ipv6] : [])]

        if (ips.length === 0) {
            throw new DynipProtoError("No ip was provided or could be parsed", 500, "911")
        }

        const accounts = await accountService.getAccounts()
        const account = accounts.find(account => account.username === ctx.state.account)

        if (!account) {
            throw new DynipProtoError("Account not found", 500, "911")
        }

        const client = account.clients.find(client => client.name === ctx.state.client)

        if (!client) {
            throw new DynipProtoError("Client not found", 500, "911")
        }

        const publishedEvents = await eventstore.publishEvents(() => {

            const events = ips.map(ip => {

                const ipV4 = z.string().ip({ version: "v4" }).safeParse(ip)
                const ipV6 = z.string().ip({ version: "v6" }).safeParse(ip)

                if (ipV4.success) {
                    const validation = ClientIpV4UpdateRequestedEvent.safeParse({
                        source: "dynip-broker",
                        type: "client-ipv4-update-requested.v1",
                        subject: client.id,
                        data: { ipv4 }
                    } as ClientIpV4UpdateRequestedEvent)

                    if (!validation.success) {
                        throw new DynipProtoError(`Create event failed`, 500, "911")
                    }

                    return validation.data
                    
                }

                if (ipV6.success) {
                    const validation = ClientIpV6UpdateRequestedEvent.safeParse({
                        source: "dynip-broker",
                        type: "client-ipv6-update-requested.v1",
                        subject: client.id,
                        data: { ipv6 }
                    } as ClientIpV6UpdateRequestedEvent)

                    if (!validation.success) {
                        throw new DynipProtoError(`Create event failed`, 500, "911")
                    }

                    return validation.data
                }

                throw new DynipProtoError(`IP ${ip} could not be parsed`, 500, "911")

            })

            if (events.length === 0) {
                throw new DynipProtoError("No events created", 500, "911")
            }

            return Promise.resolve(events)
        })

        await pubsub.publish(publishedEvents)

        for (const ev of publishedEvents) {
            ctx.response.headers.set(`X-${ev.type}`, ev.id)
        }

        ctx.response.status = 200
        ctx.response.body = "good"

    }

}