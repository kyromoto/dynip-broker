import { z } from "zod";

export type BaseEvent = z.infer<typeof BaseEvent>
export const BaseEvent = z.object({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    source: z.string().nonempty(),
    type: z.string().nonempty(),
    subject: z.string().optional(),
    data: z.any().optional(),
    occurred_at: z.string().datetime().default(() => new Date().toISOString())
})


export type ClientIpV4UpdateRequestedEvent = z.infer<typeof ClientIpV4UpdateRequestedEvent>
export const ClientIpV4UpdateRequestedEvent = BaseEvent.extend({
    source: z.literal("dynip-broker"),
    type: z.literal("client-ipv4-update-requested.v1"),
    subject: z.string().uuid().nonempty(),
    data: z.object({
        ipv4: z.string().ip({ version: "v4" })
    })
})


export type ClientIpV6UpdateRequestedEvent = z.infer<typeof ClientIpV6UpdateRequestedEvent>
export const ClientIpV6UpdateRequestedEvent = BaseEvent.extend({
    source: z.literal("dynip-broker"),
    type: z.literal("client-ipv6-update-requested.v1"),
    subject: z.string().uuid().nonempty(),
    data: z.object({
        ipv6: z.string().ip({ version: "v6" })
    })
})



export type ApplicationEvent = z.infer<typeof ApplicationEvent>
export const ApplicationEvent = z.discriminatedUnion("type", [
    ClientIpV4UpdateRequestedEvent,
    ClientIpV6UpdateRequestedEvent
])


export type ApplicationEventType = z.infer<typeof ApplicationEvent>['type']