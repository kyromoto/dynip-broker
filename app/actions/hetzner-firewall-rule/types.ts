import z from "zod";



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





export type FirewallAction = z.infer<typeof FirewallAction>
export const FirewallAction = z.object({
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


export type FirewallRule = z.infer<typeof FirewallRule>
export const FirewallRule = z.discriminatedUnion('direction', [
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


export type Firewall = z.infer<typeof Firewall>
export const Firewall = z.object({
    id: z.number(),
    name: z.string(),
    labels: z.record(z.string(), z.string()),
    rules: z.array(FirewallRule),
})


export type Pagination = z.infer<typeof Pagination>
export const Pagination = z.object({
    page: z.number(),
    per_page: z.number(),
    previous_page: z.number().nullable(),
    next_page: z.number().nullable(),
    last_page: z.number().nullable(),
    total_entries: z.number().nullable(),
})


export type GetAllFirewallsResponse = z.infer<typeof GetAllFirewallsResponse>
export const GetAllFirewallsResponse = z.object({
    firewalls: z.array(Firewall),
    meta: z.object({
        pagination: Pagination
    })
})


export type SetFirewallRulesResponse = z.infer<typeof SetFirewallRulesResponse>
export const SetFirewallRulesResponse = z.object({
    actions: z.array(FirewallAction)
})