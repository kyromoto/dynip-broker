import z from "zod"

import {
    Action as HetznerDnsRecordAction,
} from "../../actions/hetzner-dns-record/types.ts"

import {
    Action as HetznerFirewallRuleAction,
} from "../../actions/hetzner-firewall-rule/types.ts"



export type Action = z.infer<typeof Action>
export const Action = z.discriminatedUnion('type', [
    HetznerDnsRecordAction,
    HetznerFirewallRuleAction
])

export type ActionType = z.infer<typeof Action>["type"]



export type Client = z.infer<typeof Client>
export const Client = z.object({
    id: z.string().uuid().nonempty(),
    name: z.string(),
    username: z.string(),
    password: z.string(),
    actions: z.array(z.string().uuid().nonempty())
})


export type Account = z.infer<typeof Account>
export const Account = z.object({
    id: z.string().uuid().nonempty(),
    username: z.string(),
    clients: z.array(Client),
    actions: z.array(Action)
})