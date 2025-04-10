import {
    parse as parseYAML,
    stringify as stringifyYAML
} from '@std/yaml'

import { string, z } from 'zod'
import { exists } from "@std/fs/exists";
import { CONFIG_FILE } from "./_environments.ts";




export type AppConfig = z.infer<typeof AppConfig>
export const AppConfig = z.object({
    server: z.object({
        port: z.number().default(8080),
        logger: z.object({
            meta: z.object({
                file: z.string().default("dynip-broker.meta.jsonl"),
                max_file_size: z.number().default(10 * 1024 * 1024),
                max_files: z.number().default(10)
            }).default({}),
            app: z.object({
                file: z.string().default("dynip-broker.app.jsonl"),
                max_file_size: z.number().default(10 * 1024 * 1024),
                max_files: z.number().default(10)    
            }).default({})
        }).default({})
    }).default({}),
    nats: z.object({
        token: z.string().optional(),
        servers: z.array(z.object({
            host: z.string(),
            port: z.number().min(1024),
        })).min(1).default([{ host: "127.0.0.1", port: 4222 }]),
    }).default({}),
    accountstore: z.discriminatedUnion("type", [
        z.object({
            type: z.literal("YAML"),
            filename: string().nonempty()
        })
    ]).default({ type: "YAML", filename: "accounts.yml" }),
    eventstore: z.discriminatedUnion("type", [
        z.object({
            type: z.literal("JSON"),
            filename: z.string().nonempty()
        })
    ]).default({ type: "JSON", filename: "events.json" })
}).default({})



export async function loadConfig (filename: string) {

    try {

        if (!await exists(filename, { isFile: true })) {
            const defaultConfig = AppConfig.parse({})
            const yaml = stringifyYAML(defaultConfig)
            await Deno.writeTextFile(filename, yaml)
        }

        const yaml = await Deno.readTextFile(filename)
        const data = await parseYAML(yaml)
        const validation = AppConfig.safeParse(data)
        
        if (!validation.success) {
            throw new Error(validation.error.message)
        }
    
        return validation.data

    } catch (error: unknown) {
        throw new Error(`Failed to load config: ${error}`)
    }

}



export const config = await loadConfig(CONFIG_FILE)