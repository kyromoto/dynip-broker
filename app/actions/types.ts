import type { ApplicationEvent } from "../share/events.ts";
import type { CorrelationIdContext } from "../share/correltionid.ts";



export type EventQueueProcessor = (event: ApplicationEvent, cid: CorrelationIdContext) => Promise<void>