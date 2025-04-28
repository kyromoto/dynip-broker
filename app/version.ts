const raw = Deno.readTextFileSync("./deno.json")
const json = JSON.parse(raw)

export const version = json.version