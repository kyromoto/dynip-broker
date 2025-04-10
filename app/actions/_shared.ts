import { Body } from "@oak/oak/body";
import { ApplicationEvent, ApplicationEventType } from "../events.ts";
import { url } from "node:inspector";
import { logger } from "../logger.ts";
import { Logger } from "@logtape/logtape";
import { CorrelationIdContext } from "../_shared.ts";

export interface SubscribeIpUpdateRequestService {
    subscribeEvent: (type: ApplicationEventType, callback: (event: ApplicationEvent) => Promise<void>) => void
}


export function destructerFetchResponse(res: Response) {
    return {
        url: res.url,
        status: res.status,
        message: res.statusText,
        body: res.headers.get("Content-Type")?.toLowerCase() === "application/json" ? res.json() : res.text()
    }
}



export type EventQueueProcessor = (event: ApplicationEvent, cid: CorrelationIdContext) => Promise<void>



export class EventQueue {

    constructor(private readonly name: string, private readonly processEvent: EventQueueProcessor) {
        this.queueLogger = logger.getChild(this.name)
    }

    private queueLogger: Logger
    private queue: ApplicationEvent[] = []
    private isProcessing = false
    private cidContext = new CorrelationIdContext()



    private async processQueue () {

        this.queueLogger.debug(`Process queue - remaing events: ${this.queue.length}`)

        const event = this.queue.shift()
        if (!event) return

        try {
            await this.cidContext.Storage.run(event.id, async () => await this.processEvent(event, this.cidContext))   
        } catch (error: unknown) {
            this.queueLogger.error(`Processing failed`, { event, error })
        }

        this.processQueue()

    }


    public enqueue (event: ApplicationEvent) {

        this.queueLogger.debug(`Push event to queue`, { event })
        this.queue.push(event)

        if (!this.isProcessing) {
            this.isProcessing = true
            this.processQueue()
            this.isProcessing = false
        }

    }

}