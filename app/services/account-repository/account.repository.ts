import { exists } from "@std/fs/exists";
import { parse as parseYAML } from "@std/yaml";

import { z } from "zod";

import { logger } from "../../share/logger.ts";

import type {
    AccountService as ApiControllerAccountService
} from "../../controllers/interfaces.ts"

import {
    type Action as HetznerDnsRecordAction,
    ACTION_NAME as HetznerDnsRecordActionName
} from "../../actions/hetzner-dns-record/types.ts"

import {
    type Action as HetznerFirewallRuleAction,
    ACTION_NAME as HetznerFirewallRuleActionName
} from "../../actions/hetzner-firewall-rule/types.ts"

import type {
    AccountService as HetznerDnsRecordAccountService,
} from "../../actions/hetzner-dns-record/interfaces.ts"

import type {
    AccountService as HetznerFirewallRuleAccountService
} from "../../actions/hetzner-firewall-rule/interfaces.ts"
import { Account, type Action, type Client } from "./account.models.ts";








export class YAMLAccountService {

    private static _log = logger.getChild("yaml-account-service")

    public static async init(filename: string) {

        if (!await exists(filename, { isFile: true })) {
            this._log.debug("Account store file does not exist. Creating empty file", { filename })
            await Deno.writeTextFile(filename, "")
        }

        return new YAMLAccountService(filename)

    }


    private constructor(private readonly filename: string) {

    }


    getHetznerDnsRecordAccountService(): HetznerDnsRecordAccountService {
        return {
            
            getActionsByClient: async (clientId: string): Promise<HetznerDnsRecordAction[]> => {
        
                YAMLAccountService._log.debug("get actions by client", { clientId })

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
        
                YAMLAccountService._log.debug("get actions by clientId", { clientId })

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
        
                YAMLAccountService._log.debug("get all client ids with linked action", { actionId })

                const clients = await this.getClients()
        
                return clients
                    .filter(client => client.actions.includes(actionId))
                    .map(client => client.id)
        
            }

        }
    }

    getApiControllerAccountService(): ApiControllerAccountService {
        return {
            getAccounts: async () => {
                YAMLAccountService._log.debug("get accounts")
                return await this.getAccounts()
            }
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