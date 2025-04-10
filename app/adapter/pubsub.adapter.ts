import { NatsConnection } from "@nats-io/transport-deno";
import { SubscribeIpUpdateRequestService } from "../actions/_shared.ts";
import { PublishApplicationEventService } from "../controller.ts";
import { ApplicationEventType, ApplicationEvent } from "../events.ts";



export class PublishIpUpdateRequestServiceAdapter implements PublishApplicationEventService {
    
    constructor(private readonly nc: NatsConnection) {}
    
    publish (events: ApplicationEvent[]) : Promise<void> {
        
        for (const event of events) {
            this.nc.publish('dynip-broker.' + event.type, JSON.stringify(event))
        }
        
        return Promise.resolve()
        
    }
    
}



export class SubscribeIpUpdateRequestServiceAdapter implements SubscribeIpUpdateRequestService {

    constructor (private readonly nc: NatsConnection) {}
    
    subscribeEvent (type: ApplicationEventType, callback: (event: ApplicationEvent) => Promise<void>) : void {
        
        const subscription = this.nc.subscribe('dynip-broker.' + type);

        (async () => {
            for await (const message of subscription) {
                const event = ApplicationEvent.parse(message.json())
                await callback(event)
            }
        })()

    }

}