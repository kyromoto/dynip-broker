import type { Action } from "./types.ts";



export interface AccountService {
    getActionsByClient(clientId: string): Promise<Action[]>
}