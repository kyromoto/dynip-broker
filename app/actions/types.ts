import type { ApplicationEvent } from "../share/events.ts";


export type EventQueueProcessor = (event: ApplicationEvent) => Promise<void>