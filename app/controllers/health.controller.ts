import type { Context } from "@oak/oak";




export function createControllerGetHealth () {
    return (ctx: Context) => {
        ctx.response.headers.set("Content-Type", "application/json")
        ctx.response.status = 200
        ctx.response.body = { status: "OK"}
    }
}