import { ApplicationError } from "../../_share/errors.ts";
import { destructerFetchResponse } from "../_helpers.ts";
import {
    type Firewall,
    type FirewallRule,
    GetAllFirewallsResponse,
    SetFirewallRulesResponse
} from "./types.ts";

export async function getAllFirewalls (token: string) : Promise<Firewall[]> {

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



export async function setRules (token: string, firewallId: number, rules: FirewallRule[]) {

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