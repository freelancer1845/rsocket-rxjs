import { defer, Observable, of } from "rxjs";
import { BackpressureStrategy, RSocketResponder } from "../../api/rsocket.api";
import { Payload } from "../../core/protocol/payload";
import { factory } from '../../core/config-log4j';
import { map } from "rxjs/operators";
import { DecodedPayload, EncodingRSocket, RSocketEncoderRequestOptions } from "../encoding-rsocket-client";
import { EncodingRSocketResponder } from "../encoding-rsocket-responder";
import { WellKnownMimeTypes } from "../well-known-mime-types";
import { CompositeMetadata } from "../composite-metadata";



interface RouteMapping {
    route: string;
}
export class RequestResponseMapping implements RouteMapping {
    constructor(
        public readonly route: string,
        public readonly handler: (payload: DecodedPayload) => Observable<DecodedPayload> | DecodedPayload,
        public readonly options?: RSocketEncoderRequestOptions
    ) { }
}

export class RequestStreamMapping implements RouteMapping {
    constructor(
        public readonly route: string,
        public readonly handler: (payload: DecodedPayload) => Observable<DecodedPayload> | DecodedPayload,
        public readonly options?: RSocketEncoderRequestOptions,
        public readonly backpressureStrategy: BackpressureStrategy = BackpressureStrategy.BufferDelay,
    ) { }
}

export class RequestFNFMapping implements RouteMapping {
    constructor(
        public readonly route: string,
        public readonly handler: (payload: DecodedPayload) => void,
        public readonly options?: RSocketEncoderRequestOptions
    ) { }
}






const log = factory.getLogger('rsocket.extensions.messages.RSocketRoutingResponder');
export class RSocketRoutingResponder extends EncodingRSocketResponder {


    private _requestResponseMappers: RequestResponseMapping[] = [];
    private _requestStreamMappers: RequestStreamMapping[] = [];
    private _requestFNFMappers: RequestFNFMapping[] = [];

    constructor(
        public readonly encodingRSocket: EncodingRSocket
    ) {
        super(encodingRSocket);
    }

    public removeHandler(route: string) {
        this._requestResponseMappers = this._requestResponseMappers.filter(v => v.route != route);
        this._requestStreamMappers = this._requestStreamMappers.filter(v => v.route != route);
        this._requestFNFMappers = this._requestFNFMappers.filter(v => v.route != route);
    }

    public addRequestResponseHandler(
        route: string,
        handler: (payload: DecodedPayload) => Observable<any> | any,
        options?: RSocketEncoderRequestOptions,
    ): void {
        this.addMapping(new RequestResponseMapping(
            route,
            handler,
            options,
        ), this._requestResponseMappers);
    }

    public addRequestStreamHandler(
        route: string,
        handler: (payload: DecodedPayload) => Observable<any> | any,
        options?: RSocketEncoderRequestOptions,
        backpressureStrategy: BackpressureStrategy = BackpressureStrategy.BufferDelay,
    ): void {
        this.addMapping(new RequestStreamMapping(
            route,
            handler,
            options,
            backpressureStrategy
        ), this._requestStreamMappers);
    }

    public addRequestFNFHandler(
        route: string,
        handler: (payload: DecodedPayload) => void,
        options?: RSocketEncoderRequestOptions
    ): void {
        this.addMapping(new RequestFNFMapping(
            route,
            handler,
            options
        ), this._requestFNFMappers);
    }


    private addMapping(mapping: RouteMapping, target: RouteMapping[]) {
        if (target.findIndex(m => m.route == mapping.route) == -1) {
            target.push(mapping);
        } else {
            throw new Error(`Mapping for topic ${mapping} already registered`);
        }
    }

    public handleDecodedRequestStream(payload: DecodedPayload<any, any>): { stream: Observable<DecodedPayload<any, any>>; backpressureStrategy: BackpressureStrategy; } {
        const mapper = this.getMapping(this.getTopic(payload), this._requestStreamMappers);
        const stream = defer(() => {
            log.debug("Executing Request Stream Handler for: " + mapper.route);

            const result = mapper.handler(payload);
            let obs: Observable<DecodedPayload<any, any>>;
            if (result instanceof Observable) {
                obs = result;
            } else {
                obs = of(result);
            }
            return obs;
        });
        return {
            stream: stream,
            backpressureStrategy: mapper.backpressureStrategy
        };


    }
    public handleDecodedRequestResponse(payload: DecodedPayload<any, any>): Observable<DecodedPayload<any, any>> {
        return defer(() => {
            const mapper = this.getMapping(this.getTopic(payload), this._requestResponseMappers);
            log.debug("Executing Request Response Handler for: " + mapper.route);

            const result = mapper.handler(payload);
            let obs: Observable<DecodedPayload<any, any>>;
            if (result instanceof Observable) {
                obs = result;
            } else {
                obs = of(result);
            }
            return obs;
        });
    }
    public handleDecodedFireAndForget(payload: DecodedPayload<any, any>): void {
        const mapper = this.getMapping(this.getTopic(payload), this._requestFNFMappers);
        log.debug('Executing Request FNF Handler for: ' + mapper.route);

        mapper.handler(payload);
    }



    private getMapping<T extends RouteMapping>(route: string, target: T[]) {
        const mapping = target.find(m => m.route == route);
        if (mapping == undefined) {
            throw Error(`No handler registered for ${route}`)
        }
        return mapping;
    }
    private getTopic(payload: DecodedPayload): string {
        if (payload.metadata == undefined) {
            throw new Error('Cannot get route. No metadata defined');
        }
        if (payload.metadataMimeType == WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name) {
            return payload.metadata as string;
        }
        if (payload.metadataMimeType == WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name) {
            let compositeMetadata = payload.metadata as CompositeMetadata;
            return compositeMetadata.route;
        }
        throw new Error('Failed to get route information from metadata');
    }

}