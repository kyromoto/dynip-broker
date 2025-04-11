import type { ApplicationEvent, ApplicationEventType } from "../events.ts";



export interface SubscribeIpUpdateRequestService {
    subscribeEvent: (type: ApplicationEventType, callback: (event: ApplicationEvent) => Promise<void>) => void
}