import type { Logger } from "@logtape/logtape";

import { logger } from "../share/logger.ts";
import { CorrelationIdContext } from "../share/correltionid.ts";
import type { ApplicationEvent } from "../share/events.ts";
import type { EventQueueProcessor } from "./types.ts";



export class EventQueue {

    constructor(private readonly name: string, private readonly processEvent: EventQueueProcessor) {
        this.queueLogger = logger.getChild(this.name)
    }

    private queueLogger: Logger
    private queue: ApplicationEvent[] = []
    private isProcessing = false
    private cidContext = CorrelationIdContext.getInstance()



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