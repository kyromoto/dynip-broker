import type { ApplicationEvent } from "../events.ts";
import type { CorrelationIdContext } from "../_share/correltionid-context.ts";



export type EventQueueProcessor = (event: ApplicationEvent, cid: CorrelationIdContext) => Promise<void>