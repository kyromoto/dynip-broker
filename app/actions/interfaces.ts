import type { ApplicationEvent, ApplicationEventType } from "../share/events.ts"



export interface SubscribeIpUpdateRequestService {
    subscribeEvent: (type: ApplicationEventType, callback: (event: ApplicationEvent) => Promise<void>) => void
}