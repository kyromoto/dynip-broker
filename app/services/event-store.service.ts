import { exists } from "@std/fs/exists";

import { z } from "zod";

import { ApplicationEvent } from "../events.ts";
import { ApplicationError, EventStore, EventStoreAPI } from "../controller.ts";
import { ClientIpsProjector as HetznerFirewallRuleClientIpsProjector } from "../actions/hetzner-firewall-rule.action.ts";
import { logger } from "../logger.ts";

export type StoredApplicationEvent = z.infer<typeof StoredApplicationEvent>
export const StoredApplicationEvent = ApplicationEvent.and(z.object({
    sequence: z.number().min(1)
}))


export class JSONEventStore implements EventStore, EventStoreAPI  {

    private constructor (private readonly filename: string) {
    
    }


    static async init (filename: string): Promise<JSONEventStore> {

        if (!await exists(filename, { isFile: true })) {
            logger.debug("Event store file does not exist. Creating empty file", { filename })
            await Deno.writeTextFile(filename, JSON.stringify([]))
        }
        
        return new JSONEventStore(filename)

    }


    async publishEvents( tx: (api: EventStoreAPI) => Promise<ApplicationEvent[]>): Promise<ApplicationEvent[]> {
        
        try {

            const evs = await tx(this)

            if (evs.length === 0) {
                throw new Error("No events returned by transaction")
            }

            const storedEvents = await this.getEventStream()

            const eventsWithSequence = evs.map((ev, i) => {
                return {
                    ...ev,
                    sequence: storedEvents.length + i + 1
                }
            })

            await Deno.writeTextFile(this.filename, JSON.stringify([...storedEvents, ...eventsWithSequence]))

            return evs

        } catch(error: unknown) {
            throw new ApplicationError("Failed to publish events", { error })
        }

    }


    public async getEventStream (filterBySubject?: string): Promise<ApplicationEvent[]> {

        const txt = await Deno.readTextFile(this.filename)
        const events = z.array(StoredApplicationEvent).parse(JSON.parse(txt))

        return events
            .filter(ev => {
                if (!filterBySubject) {
                    return true
                }

                if (!ev.subject) {
                    return false
                }

                return ev.subject === filterBySubject
            })
            .sort((a, b) => a.sequence - b.sequence)
    }

    public getHetznerFirewallRuleClientIpsProjector () : HetznerFirewallRuleClientIpsProjector {
        return {
            getClientIps: async (clientId: string) => {

                const events = await this.getEventStream(clientId)

                const ips = events.reduce<{ ipv4?: string, ipv6?: string }>((ips, event) => {

                    switch (event.type) {

                        case "client-ipv4-update-requested.v1" : {
                            return { ...ips, ipv4: event.data.ipv4 }
                        }

                        case "client-ipv6-update-requested.v1" : {
                            return { ...ips, ipv6: event.data.ipv6 }
                        }

                        default: return ips
                        
                    }

                }, {})

                return [
                    ...(ips.ipv4 ? [ips.ipv4] : []),
                    ...(ips.ipv6 ? [ips.ipv6] : [])
                ]
            }
        }
    }

} 