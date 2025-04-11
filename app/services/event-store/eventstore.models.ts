import z from "zod";
import { ApplicationEvent } from "../../events.ts";



export type StoredApplicationEvent = z.infer<typeof StoredApplicationEvent>
export const StoredApplicationEvent = ApplicationEvent.and(z.object({
    sequence: z.number().min(1)
}))