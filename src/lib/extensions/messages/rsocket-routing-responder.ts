import { defer, Observable, of } from "rxjs";
import { BackpressureStrategy, RSocketResponder } from "../../api/rsocket.api";
import { Payload } from "../../core/protocol/payload";
import { MimeType, MimeTypeRegistry } from '../../api/rsocket-mime.types';
import { factory } from '../../core/config-log4j';
import { map } from "rxjs/operators";

export class RequestResponseMapping implements RouteMapping {
    constructor(
        public readonly route: string,
        public readonly handler: (payload: any) => Observable<any> | any,
        public readonly incomingMimeType = MimeType.APPLICATION_JSON,
        public readonly outgoingMimeType = MimeType.APPLICATION_JSON,
    ) { }
}

export class RequestStreamMapping implements RouteMapping {
    constructor(
        public readonly route: string,
        public readonly handler: (payload: any) => Observable<any> | any,
        public readonly incomingMimeType = MimeType.APPLICATION_JSON,
        public readonly outgoingMimeType = MimeType.APPLICATION_JSON,
        public readonly backpressureStrategy: BackpressureStrategy = BackpressureStrategy.BufferDelay,
    ) { }
}




interface RouteMapping {
    route: string;
}


const log = factory.getLogger('rsocket.extensions.messages.RSocketRoutingResponder');
export class RSocketRoutingResponder implements RSocketResponder {


    private _requestResponseMappers: RequestResponseMapping[] = [];
    private _requestStreamMappers: RequestStreamMapping[] = [];

    constructor(
        public readonly mimeTypeRegistry: MimeTypeRegistry
    ) { }

    public addRequestResponseHandler(
        topic: string,
        handler: (payload: any) => Observable<any> | any,
        incomingMimeType = MimeType.APPLICATION_JSON,
        outgoingMimeType = MimeType.APPLICATION_JSON,
    ): void {
        this.addMapping(new RequestResponseMapping(
            topic,
            handler,
            incomingMimeType,
            outgoingMimeType,
        ), this._requestResponseMappers);
    }
    
    public addRequestStreamHandler(
        topic: string,
        handler: (payload: any) => Observable<any> | any,
        incomingMimeType = MimeType.APPLICATION_JSON,
        outgoingMimeType = MimeType.APPLICATION_JSON,
        backpressureStrategy: BackpressureStrategy = BackpressureStrategy.BufferDelay,
    ): void {
        this.addMapping(new RequestStreamMapping(
            topic,
            handler,
            incomingMimeType,
            outgoingMimeType,
            backpressureStrategy
        ), this._requestStreamMappers);
    }

    
    private addMapping(mapping: RouteMapping, target: RouteMapping[]) {
        if (target.findIndex(m => m.route == mapping.route) == -1) {
            target.push(mapping);
        } else {
            throw new Error(`Mapping for topic ${mapping} already registered`);
        }
    }

    handleRequestStream(payload: Payload): { stream: Observable<Payload>; backpressureStrategy: BackpressureStrategy; } {
        const mapper = this.getMapping(this.getTopic(payload), this._requestStreamMappers);
        const stream = defer(() => {
            log.debug("Executing Request Stream Handler for: " + mapper.route);
            let _payload = undefined;
            if (payload.data.length > 0) {
                _payload = mapper.incomingMimeType.coder.decoder(payload.data, this.mimeTypeRegistry);
            }

            const result = mapper.handler(_payload);
            let obs: Observable<any>;
            if (result instanceof Observable) {
                obs = result;
            } else {
                obs = of(result);
            }
            return obs.pipe(map(answer => {
                return new Payload(mapper.outgoingMimeType.coder.encoder(answer, this.mimeTypeRegistry));
            }));
        });
        return {
            stream: stream,
            backpressureStrategy: mapper.backpressureStrategy
        };
    }
    handleRequestResponse(payload: Payload): Observable<Payload> {
        return defer(() => {
            const mapper = this.getMapping(this.getTopic(payload), this._requestResponseMappers);
            log.debug("Executing Request Response Handler for: " + mapper.route);
            let _payload = undefined;
            if (payload.data.length > 0) {
                _payload = mapper.incomingMimeType.coder.decoder(payload.data, this.mimeTypeRegistry);
            }
            const result = mapper.handler(_payload);
            let obs: Observable<any>;
            if (result instanceof Observable) {
                obs = result;
            } else {
                obs = of(result);
            }
            return obs.pipe(map(answer => {
                return new Payload(mapper.outgoingMimeType.coder.encoder(answer, this.mimeTypeRegistry));
            }));
        });
    }
    handleFNF(payload: Payload): void {
        throw new Error("Method not implemented.");
    }


    private getMapping<T extends RouteMapping>(route: string, target: T[]) {
        const mapping = target.find(m => m.route == route);
        if (mapping == undefined) {
            throw Error(`No handler registered for ${route}`)
        }
        return mapping;
    }
    private getTopic(payload: Payload) {
        return MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.decoder(payload.metadata, this.mimeTypeRegistry).filter(c => c.type.equals(MimeType.MESSAGE_X_RSOCKET_ROUTING))[0].data;
    }

}