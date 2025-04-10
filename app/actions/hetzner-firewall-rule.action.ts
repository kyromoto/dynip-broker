import z from "zod";

import { logger } from "../logger.ts";
import { ApplicationError } from "../controller.ts";
import { destructerFetchResponse, EventQueue, SubscribeIpUpdateRequestService } from "./_shared.ts";



export const ACTION_NAME = "hetzner-firewall-rule"

export type ActionConfig = z.infer<typeof ActionConfig>
export const ActionConfig = z.object({
    token: z.string().nonempty(),
    name: z.string().nonempty(),
    rules: z.array(z.string().nonempty()).nonempty(),
    static_ips: z.array(z.string().cidr().nonempty()).default([]),
})

export type Action = z.infer<typeof Action>
export const Action = z.object({
    id: z.string().uuid().nonempty(),
    type: z.literal(ACTION_NAME),
    name: z.string(),
    config: ActionConfig
})


export interface ClientIpsProjector {
    getClientIps: (clientId: string) => Promise<string[]>
}


export interface AccountService {
    getActionsByClientId(clientId: string): Promise<Action[]>
    getAllClientIdsWithLinkedAction(actionId: string): Promise<string[]>
}



export function createActionHetznerFirewallRule (accountService: AccountService, projector: ClientIpsProjector, pubsub: SubscribeIpUpdateRequestService) {

    const actionLogger = logger.getChild(ACTION_NAME)
    const queue = new EventQueue(ACTION_NAME, async (event, cidContext) => {

        const cid = cidContext.CorrelationId
        const log = actionLogger.getChild(cid).with({ correlation_id: cid, event })

        log.debug(`Processing event`)

        try {

            const actions = await accountService.getActionsByClientId(event.subject)

            for (const action of actions) {

                try {

                    log.debug(`Processing action`, { action })

                    const clientIds = await accountService.getAllClientIdsWithLinkedAction(action.id)

                    const ips = await clientIds.reduce<Promise<string[]>>(async (ips, clientId) => {
                        return [
                            ...await ips,
                            ...await projector.getClientIps(clientId)
                        ]
                    }, Promise.resolve(action.config.static_ips))

                    const cidrIps = ips.map(ip => {
                        const isCIDR = z.string().cidr().safeParse(ip)

                        if (isCIDR.success) {
                            return isCIDR.data
                        }

                        const isIPV4 = z.string().ip({ version: "v4"}).safeParse(ip)
                        const isIPV6 = z.string().ip({ version: "v6"}).safeParse(ip)

                        if (isIPV4.success || isIPV6.success) {
                            
                            if (isIPV4.success) {
                                return `${isIPV4.data}/32`
                            }

                            if (isIPV6.success) {
                                return `${isIPV6.data}/128`
                            }

                        }

                        throw new Error(`IP ${ip} is not valid`)

                    })

                    const firewalls = await getAllFirewalls(action.config.token)
                    const firewall = firewalls.find(f => f.name === action.config.name)

                    if (!firewall) {
                        throw new Error(`Firewall ${action.config.name} not found`)
                    }

                    const ruleRecords = firewall.rules.reduce<Record<string, FirewallRule>>((rules, rule) => {
                        return {
                            ...rules,
                            [crypto.randomUUID()]: rule
                        }
                    }, {})

                    const updatedRules = Array.from(Object.entries(ruleRecords)).reduce<Record<string, FirewallRule>>((rules, [id, rule]) => {

                        if (!rule.description) {
                            return rules
                        }

                        if (!action.config.rules.includes(rule.description)) {
                            return rules
                        }

                        const updatedRule = {
                            ...rule,
                            ...(rule.direction === "in" ? { source_ips: cidrIps } : { destination_ips: cidrIps })
                        }

                        return  {
                            ...rules,
                            [id]: updatedRule
                        }
                        
                    }, {})

                    const mergedRules = { ...ruleRecords, ...updatedRules }

                    const validation = z.array(FirewallRule).safeParse(Array.from(Object.values(mergedRules)))

                    if (!validation.success) {
                        throw new ApplicationError(`Failed to validate updated hetzner firewallrules`, {
                            error: validation.error
                        })
                    }

                    const descriptionsOfUpdatedRules = Array.from(Object.values(updatedRules)).map(rule => rule.description)

                    const actions = await setRules(action.config.token, firewall.id, validation.data)
                    log.info(`Rule${descriptionsOfUpdatedRules.length > 1 ? "s" : ""} [${descriptionsOfUpdatedRules.join(",")}] of Firewall ${firewall.id} updated`, { action, rules: updatedRules, actions })

                } catch (error: unknown) {
                    log.error(`Failed to execute action`, { action, error })
                }

            }


        } catch (error: unknown) {
            log.error(`Failed to process event`, { error })
        }

    })


    pubsub.subscribeEvent("client-ipv4-update-requested.v1", event => Promise.resolve(queue.enqueue(event)))
    pubsub.subscribeEvent("client-ipv6-update-requested.v1", event => Promise.resolve(queue.enqueue(event)))

}






type FirewallAction = z.infer<typeof FirewallAction>
const FirewallAction = z.object({
    id: z.number(),
    command: z.string(),
    status: z.string(),
    started: z.string(),
    finished: z.string().nullable(),
    progress: z.number(),
    resources: z.array(z.object({
        id: z.number(),
        type: z.string()
    })),
    error: z.string().nullable()
})


type FirewallRule = z.infer<typeof FirewallRule>
const FirewallRule = z.discriminatedUnion('direction', [
    z.object({
        description: z.string().nullable(),
        direction: z.literal("in"),
        source_ips: z.array(z.string().cidr().nonempty()).optional(),
        protocol: z.enum(["tcp", "udp", "icmp", "esp", "gre"]),
        port: z.string().nullable().optional(),
    }),
    z.object({
        description: z.string().nullable(),
        direction: z.literal("out"),
        destination_ips: z.array(z.string().cidr().nonempty()).optional(),
        protocol: z.enum(["tcp", "udp", "icmp", "esp", "gre"]),
        port: z.string().nullable().optional(),
    })
])


type Firewall = z.infer<typeof Firewall>
const Firewall = z.object({
    id: z.number(),
    name: z.string(),
    labels: z.record(z.string(), z.string()),
    rules: z.array(FirewallRule),
})


type Pagination = z.infer<typeof Pagination>
const Pagination = z.object({
    page: z.number(),
    per_page: z.number(),
    previous_page: z.number().nullable(),
    next_page: z.number().nullable(),
    last_page: z.number().nullable(),
    total_entries: z.number().nullable(),
})


type GetAllFirewallsResponse = z.infer<typeof GetAllFirewallsResponse>
const GetAllFirewallsResponse = z.object({
    firewalls: z.array(Firewall),
    meta: z.object({
        pagination: Pagination
    })
})


type SetFirewallRulesResponse = z.infer<typeof SetFirewallRulesResponse>
const SetFirewallRulesResponse = z.object({
    actions: z.array(FirewallAction)
})


async function getAllFirewalls (token: string) : Promise<Firewall[]> {

    const getFirewalls = async (p: number = 1) : Promise<Firewall[]> => {        

        const searchParams = new URLSearchParams()

        searchParams.append("page", p.toString())

        const res = await fetch(`https://api.hetzner.cloud/v1/firewalls?${searchParams.toString()}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        })

        if (!res.ok) {
            throw new ApplicationError(`Failed to get hetzner firewall page ${p}`, {
                page: p,
                http_response: destructerFetchResponse(res)
            })
        }

        const payload = await res.json()
        const validation = GetAllFirewallsResponse.safeParse(payload)

        if (!validation.success) {
            throw new ApplicationError(`Failed to validate response when got hetzner firewall page ${p}`, { error: validation.error, page: p })
        }

        const { next_page } = validation.data.meta.pagination

        if (!next_page) {
            return validation.data.firewalls
        }

        return [
            ...validation.data.firewalls,
            ...await getFirewalls(next_page)
        ]
    }

    try {
        return await getFirewalls()
    } catch (error: unknown) {

        if (error instanceof ApplicationError) {
            throw error
        }

        throw new ApplicationError("Failed to get hetzner firewalls", { error })
    }

}



async function setRules (token: string, firewallId: number, rules: FirewallRule[]) {

    try {

    const res = await fetch(`https://api.hetzner.cloud/v1/firewalls/${firewallId}/actions/set_rules`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ rules })
    })

    if (!res.ok) {
        throw new ApplicationError(`Failed to set rules for hetzner firewall ${firewallId}`, { rules, http_response: destructerFetchResponse(res) })
    }

    const payload = await res.json()
    const validation = SetFirewallRulesResponse.safeParse(payload)

    if (!validation.success) {
        throw new ApplicationError(`Failed to validate response when set rules for hetzner firewall ${firewallId}`, { error: validation.error })
    }

    const hasError = validation.data.actions.some(action => action.error)

    if (hasError) {
        throw new ApplicationError(`Failed to set rules for firewall ${firewallId}`, { actions: validation.data.actions.filter(action => action.error) })
    }

    return validation.data

    } catch (error: unknown) {
        
        if (error instanceof ApplicationError) {
            throw error
        }
        
        throw new ApplicationError(`Failed to set rules for firewall ${firewallId}`, { error })
    }
}