import{ z } from "zod"
import type { Context } from "@oak/oak"

import { DynipProtoError } from "../share/errors.ts"
import { ClientIpV4UpdateRequestedEvent, ClientIpV6UpdateRequestedEvent } from "../share/events.ts"
import type { AccountService, EventStore, PublishApplicationEventService } from "./interfaces.ts"
import { logger } from "../share/logger.ts";
import { getCorrelationId } from "../share/correlation-context.ts";





export function createControllerUpdateIp (accountService: AccountService, eventstore: EventStore,  pubsub: PublishApplicationEventService) {

    return async (ctx: Context) => {

        const contextId = ctx.state.CorrelationContextId;
        const correlationId = getCorrelationId(contextId)
        const log = logger.getChild('update-ip-controller').with({ correlation_id: correlationId })

        log.debug('update client ip')

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

        const accounts = await accountService.getAccounts(contextId)
        const account = accounts.find(account => account.username === ctx.state.account)

        if (!account) {
            throw new DynipProtoError("Account not found", 500, "911")
        }

        const client = account.clients.find(client => client.name === ctx.state.client)

        if (!client) {
            throw new DynipProtoError("Client not found", 500, "911")
        }

        const publishedEvents = await eventstore.publishEvents(contextId, () => {

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

        await pubsub.publish(contextId, publishedEvents)

        for (const ev of publishedEvents) {
            ctx.response.headers.set(`X-${ev.type}`, ev.id)
        }

        ctx.response.status = 200
        ctx.response.body = "good"

    }

}