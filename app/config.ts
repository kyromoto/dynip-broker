import {
    parse as parseYAML,
    stringify as stringifyYAML
} from '@std/yaml'

import { string, z } from 'zod'
import { logger } from "./logger.ts";
import { exists } from "@std/fs/exists";




export type AppConfig = z.infer<typeof AppConfig>
export const AppConfig = z.object({
    server: z.object({
        port: z.number().default(8080)
    }),
    nats: z.object({
        token: z.string().optional(),
        servers: z.array(z.object({
            host: z.string(),
            port: z.number().min(1024),
        })).default([{ host: "127.0.0.1", port: 4222 }])
    }),
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
})



export async function loadConfig (filename: string) {

    try {

        if (!await exists(filename, { isFile: true })) {
            const defaultConfig = AppConfig.default
            const yaml = stringifyYAML(defaultConfig)
            await Deno.writeTextFile(filename, yaml)
        }

        const yaml = await Deno.readTextFile(filename)
        const data = await parseYAML(yaml)
        const validation = AppConfig.safeParse(data)
        
        if (!validation.success) {
            logger.error("Config file validation failed", { filename, errors: validation.error.errors })
            throw new Error(validation.error.message)
        }
    
        logger.info("Config loaded", { filename, config: validation.data })
    
        return validation.data

    } catch (error: unknown) {
        logger.fatal("Failed to load config", { filename, error })
        Deno.exit(1)
    }

}