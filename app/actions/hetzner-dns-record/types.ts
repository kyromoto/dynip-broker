import z from "zod";



export const ACTION_NAME = "hetzner-dns-record"

export type ActionConfig = z.infer<typeof ActionConfig>
export const ActionConfig = z.object({
    zone: z.string(),
    record: z.string(),
    type: z.enum(["A", "AAAA"]),
    token: z.string()
})

export type Action = z.infer<typeof Action>
export const Action = z.object({
    id: z.string().uuid().nonempty(),
    type: z.literal(ACTION_NAME),
    name: z.string(),
    config: ActionConfig
})