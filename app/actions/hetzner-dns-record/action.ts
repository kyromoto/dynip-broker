import { z } from "zod";

import { logger } from "../../share/logger.ts";
import { EventQueue } from "../event-queue.ts";
import { ApplicationError } from "../../share/errors.ts";
import { destructerFetchResponse } from "../_helpers.ts";
import type { SubscribeIpUpdateRequestService } from "../interfaces.ts";
import type { AccountService } from "./interfaces.ts";
import { ACTION_NAME } from "./types.ts";



export const createActionHetznerDnsRecord = (accountService: AccountService, pubsub: SubscribeIpUpdateRequestService) => {

    const queue = new EventQueue(ACTION_NAME, async event => {

        const cid = event.correlation_id || 'unknown'
        const log = logger.getChild(ACTION_NAME).with({ correlation_id: cid, event })

        log.debug(`Processing event`)

        try {

            const actions = await accountService.getActionsByClient(event.subject)

            for (const action of actions) {

                try {

                    log.debug(`Processing action`, { action })

                    const zones = await getAllZonesFromHetznerApi(action.config.token, action.config.zone)
                    const zone = zones.find(zone => zone.name === action.config.zone)

                    if (!zone) {
                        throw new Error(`Zone ${action.config.zone} not found`)
                    }

                    const records = await getAllRecordsFromHetznerApi(action.config.token, zone.id)

                    switch (event.type) {

                        case "client-ipv4-update-requested.v1": {
                            const record = records.find(record => record.name === action.config.record && record.type === "A")

                            if (!record) {
                                throw new Error(`Record ${action.config.record} not found`)
                            }
    
                            if (record.type !== "A") {
                                throw new Error(`Record ${action.config.record} is not of type ${action.config.type}`)
                            }
    
                            await updateRecordAtHetznerApi(action.config.token, zone.id, record.id, record.name, record.type, event.data.ipv4)
                            log.info(`Record ${record.name}.${zone.name} updated to ${event.data.ipv4}`)

                            break
                        }

                        case "client-ipv6-update-requested.v1": {
                            const record = records.find(record => record.name === action.config.record && record.type === "AAAA")

                            if (!record) {
                                throw new Error(`Record ${action.config.record} not found`)
                            }
    
                            if (record.type !== "AAAA") {
                                throw new Error(`Record ${action.config.record} is not of type ${action.config.type}`)
                            }
    
                            await updateRecordAtHetznerApi(action.config.token, zone.id, record.id, record.name, record.type, event.data.ipv6)
                            log.info(`Record ${record.name}.${zone.name} updated to ${event.data.ipv6}`)

                            break
                        }

                        default: throw new Error("Event not handled")
                    }

                } catch (error: unknown) {
                    log.error(`Failed to execute action ${ACTION_NAME}`, { action, error })
                }

            }

        } catch (error: unknown) {
            log.error("Failed to process event", { error })
        }

    })

    pubsub.subscribeEvent("client-ipv4-update-requested.v1", event => Promise.resolve(queue.enqueue(event)))
    pubsub.subscribeEvent("client-ipv6-update-requested.v1", event => Promise.resolve(queue.enqueue(event)))

}



type HetznerDate = z.infer<typeof HetznerDate>
const HetznerDate = z.string().transform(val => {
    return new Date(val).toISOString()
}).pipe(z.string().datetime())



type Zone = z.infer<typeof Zone>
const Zone = z.object({
    id: z.string(),
    name: z.string()
})

type Record = z.infer<typeof Record>
const Record = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["A", "AAAA", "PTR", "NS", "MX", "CNAME", "RP", "TXT", "SOA", "HINFO", "SRV", "DANE", "TLSA", "DS", "CAA"]),
    value: z.string(),
    zone_id: z.string(),
    ttl: z.number().optional(),
    created: HetznerDate,
    modified: HetznerDate
})

type Pagination = z.infer<typeof Pagination>
const Pagination = z.object({
    last_page: z.number().min(1),
    page: z.number().min(1),
    per_page: z.number().min(1),
    total_entries: z.number()
})


type GetAllZonesResponse = z.infer<typeof GetAllZonesResponse>
const GetAllZonesResponse = z.object({
    zones: z.array(Zone),
    meta: z.object({
        pagination: Pagination
    })
})


type GetAllRecordsResponse = z.infer<typeof GetAllRecordsResponse>
const GetAllRecordsResponse = z.object({
    records: z.array(Record),
    meta: z.object({
        pagination: Pagination
    })
})



async function getAllZonesFromHetznerApi (token: string, zone?: string)  {

    const getZones = async (p: number = 1) : Promise<Zone[]> => {

        const searchParams = new URLSearchParams()

        searchParams.append("page", p.toString())
        if (zone) searchParams.append("name", zone)

        const res = await fetch(`https://dns.hetzner.com/api/v1/zones?${searchParams.toString()}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Auth-API-Token": token
            }
        })

        if (!res.ok) {
            throw new ApplicationError(`Failed to get hetzner dns zone page ${p}`, {
                page: p,
                http_response: destructerFetchResponse(res)
            })
        }

        const payload = await res.json()
        const validation = GetAllZonesResponse.safeParse(payload)

        if (!validation.success) {
            throw new Error(validation.error.message)
        }

        const { page, last_page } = validation.data.meta.pagination

        if (page >= last_page) {
            return validation.data.zones
        }

        return [ ...validation.data.zones, ...await getZones(page + 1) ]

    }

    return await getZones()    

}


async function getAllRecordsFromHetznerApi (token: string, zoneId: string) {

    const getRecordsRecursive = async (p: number = 1) : Promise<Record[]> => {

        const res = await fetch(`https://dns.hetzner.com/api/v1/records?zone_id=${zoneId}&page=${p}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Auth-API-Token": token
            }
        })

        if (!res.ok) {
            throw new ApplicationError(`Failed to get hetzner dns record page ${p}`, {
                page: p,
                http_response: destructerFetchResponse(res)
            })
        }

        const payload = await res.json()
        const validation = GetAllRecordsResponse.safeParse(payload)

        if (!validation.success) {
            throw new Error(validation.error.message)
        }

        const { page, last_page } = validation.data.meta.pagination

        if (page >= last_page) {
            return validation.data.records
        }

        return [ ...validation.data.records, ...await getRecordsRecursive(page + 1) ]

    }

    return await getRecordsRecursive()

}


async function updateRecordAtHetznerApi (token: string, zoneId: string, recordId: string, recordName: string, type: "A" | "AAAA", ip: string) {

    await fetch("https://dns.hetzner.com/api/v1/records/" + recordId, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Auth-API-Token": token
        },
        body: JSON.stringify({
            name: recordName,
            type,
            value: ip,
            zone_id: zoneId
        })
    })

}