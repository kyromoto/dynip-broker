import z from "zod";

import type { SubscribeIpUpdateRequestService } from "../interfaces.ts";
import type { AccountService, ClientIpsProjector } from "./interfaces.ts";

import { logger } from "../../share/logger.ts";
import { EventQueue } from "../event-queue.ts";
import { ApplicationError } from "../../share/errors.ts";
import { ACTION_NAME, FirewallRule } from "./types.ts";
import { getAllFirewalls, setRules } from "./hetzner-api.ts";



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