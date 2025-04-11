import type { Action } from "./types.ts";



export interface ClientIpsProjector {
    getClientIps: (clientId: string) => Promise<string[]>
}


export interface AccountService {
    getActionsByClientId(clientId: string): Promise<Action[]>
    getAllClientIdsWithLinkedAction(actionId: string): Promise<string[]>
}