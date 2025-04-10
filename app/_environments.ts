import { z } from "zod"



export const CONFIG_FILE = z.string()
    .default("config.yml")
    .parse(Deno.env.get("CONFIG_FILE"));

export const LOG_LEVEL = z.enum(["debug", "info", "warning", "error", "fatal"])
    .default("info")
    .parse(Deno.env.get("LOG_LEVEL"));

export const LOG_FILE_MAX_SIZE = z.number()
    .default(10 * 1024 * 1024)
    .parse(Deno.env.get("LOG_FILE_MAX_SIZE"));

export const LOG_FILE_MAX_FILES = z.number()
    .default(10)
    .parse(Deno.env.get("LOG_FILE_MAX_FILES"));