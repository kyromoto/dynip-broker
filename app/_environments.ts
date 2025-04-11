import { z } from "zod"

export const DENO_ENV = z.enum(["development", "production"])
    .default("production")
    .parse(Deno.env.get("DENO_ENV"));

export const CONFIG_FILE = z.string()
    .default("config.yml")
    .parse(Deno.env.get("CONFIG_FILE"));

export const LOG_LEVEL = z.enum(["debug", "info", "warning", "error", "fatal"])
    .default("info")
    .parse(Deno.env.get("LOG_LEVEL"));