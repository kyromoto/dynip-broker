import { exists } from "@std/fs/exists";
import { parse as parseYAML } from "@std/yaml";

import { z } from "zod";


import {
    AccountService as HetznerDnsRecordAccountService,
    Action as HetznerDnsRecordAction,
    ACTION_NAME as HetznerDnsRecordActionName
} from "../actions/hetzner-dns-record.action.ts"

import {
    AccountService as HetznerFirewallRuleAccountService,
    Action as HetznerFirewallRuleAction,
    ACTION_NAME as HetznerFirewallRuleActionName
} from "../actions/hetzner-firewall-rule.action.ts"

import {
    AccountService as ApiControllerAccountService
} from "../controller.ts";
import { logger } from "../logger.ts";


export type Client = z.infer<typeof Client>
export const Client = z.object({
    id: z.string().uuid().nonempty(),
    name: z.string(),
    username: z.string(),
    password: z.string(),
    actions: z.array(z.string().uuid().nonempty())
})


export type Action = z.infer<typeof Action>
export const Action = z.discriminatedUnion('type', [
    HetznerDnsRecordAction,
    HetznerFirewallRuleAction
])

export type ActionType = z.infer<typeof Action>["type"]


export type Account = z.infer<typeof Account>
export const Account = z.object({
    id: z.string().uuid().nonempty(),
    username: z.string(),
    clients: z.array(Client),
    actions: z.array(Action)
})


export class YAMLAccountService {

    public static async init(filename: string) {

        if (!await exists(filename, { isFile: true })) {
            logger.debug("Account store file does not exist. Creating empty file", { filename })
            await Deno.writeTextFile(filename, "")
        }

        return new YAMLAccountService(filename)

    }


    private constructor(private readonly filename: string) {

    }


    getHetznerDnsRecordAccountService(): HetznerDnsRecordAccountService {
        return {
            
            getActionsByClient: async (clientId: string): Promise<HetznerDnsRecordAction[]> => {
        
                const clients = await this.getClients()
                const client = clients.find(client => client.id === clientId)
        
                if (!client) {
                    throw new Error(`Client ${clientId} not found`)
                }
        
                const actions = await this.getActions()
                
                return actions.filter(action => {
                    return client.actions.includes(action.id)
                        && action.type === HetznerDnsRecordActionName
                }) as HetznerDnsRecordAction[]
        
            }

        }
    }


    getHetznerFirewallRuleAccountService(): HetznerFirewallRuleAccountService {
        return {
            
            getActionsByClientId: async (clientId: string): Promise<HetznerFirewallRuleAction[]> => {
        
                const clients = await this.getClients()
                const client = clients.find(client => client.id === clientId)
        
                if (!client) {
                    throw new Error(`Client ${clientId} not found`)
                }
        
                const actions = await this.getActions()
        
                return actions.filter(action => {
                    return client.actions.includes(action.id)
                        && action.type === HetznerFirewallRuleActionName
                }) as HetznerFirewallRuleAction[]
        
            },


            getAllClientIdsWithLinkedAction: async (actionId: string): Promise<string[]> => {
        
                const clients = await this.getClients()
        
                return clients
                    .filter(client => client.actions.includes(actionId))
                    .map(client => client.id)
        
            }

        }
    }

    getApiControllerAccountService(): ApiControllerAccountService {
        return {
            getAccounts: async () => await this.getAccounts()
        }
    }


    private async getAccounts (): Promise<Account[]> {
        const txt = await Deno.readTextFile(this.filename)
        const data = parseYAML(txt)
        const accounts = z.array(Account).parse(data)

        return accounts
    }

    private async getClients (): Promise<Client[]> {
        const accounts = await this.getAccounts()
        const clients = accounts.reduce<Client[]>((clients, account) => {
            return [...clients, ...account.clients]
        }, [])

        return clients
    }


    private async getActions (): Promise<Action[]> {
        const accounts = await this.getAccounts()
        const actions = accounts.reduce<Action[]>((actions, account) => {
            return [...actions, ...account.actions]
        }, [])        
        
        return actions
    }

}