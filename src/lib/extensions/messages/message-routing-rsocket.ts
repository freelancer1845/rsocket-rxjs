import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { RSocketConfig } from "../../..";
import { RSocket, RSocketState } from '../../api/rsocket.api';
import { Payload } from "../../core/protocol/payload";
import { CompositeMetadata } from "../composite-metadata";
import { decodeAuthentication, decodeMessageRoute, encodeAuthentication, encodeMessageRoute } from "../encoder/message-x-rsocket";
import { DecodedPayload, EncodingRSocket, RSocketEncoderRequestOptions } from "../encoding-rsocket-client";
import { Authentication } from "../security/authentication";
import { WellKnownMimeTypes } from "../well-known-mime-types";
import { RSocketRoutingResponder } from "./rsocket-routing-responder";

export interface RoutedPayload extends DecodedPayload {
    route: string;
    authentication?: Authentication;
    metadata?: CompositeMetadata;
}

export type MessagePayloadType = 'dataOnly' | 'decodedPayload';

export interface MessageRoutingOptions<PayloadType extends MessagePayloadType> {
    payloadType: PayloadType;
    encodingOptions?: RSocketEncoderRequestOptions
}

export class MessageRoutingRSocket implements RSocket<RoutedPayload, DecodedPayload, RSocketEncoderRequestOptions> {

    public readonly _responder: RSocketRoutingResponder;

    constructor(public readonly parent: EncodingRSocket) {
        this._responder = new RSocketRoutingResponder(parent);
        parent.setResponder(this._responder);

        parent.addDecoder({
            mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name,
            decode: decodeMessageRoute
        }).addEncoder({
            mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name,
            encode: encodeMessageRoute
        }).addDecoder({
            mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION_V0.name,
            decode: decodeAuthentication
        }).addEncoder({
            mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION_V0.name,
            encode: encodeAuthentication
        });
    }

    get responder(): RSocketRoutingResponder {
        return this._responder;
    }


    simpleRequestResponse(route: string, data?: any, authentication?: Authentication): Observable<any> {
        return this.requestResponse({
            route: route,
            data: data,
            authentication: authentication
        }).pipe(map(res => res.data));
    }


    requestResponse(payload: RoutedPayload, options?: RSocketEncoderRequestOptions): Observable<DecodedPayload<any, any>> {
        if (this._isCompositeMetadataRequest(payload)) {
            return this.parent.requestResponse(
                {
                    data: payload.data,
                    dataMimeType: payload.dataMimeType,
                    metadata: this._constructCompositeMetadata(payload),
                    metadataMimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name
                },
                options
            )
        } else {
            throw new Error('Only CompositeMetaData requests are implemented');
        }
    }

    simpleRequestStream(route: string, data?: any, requester?: Observable<number>, authentication?: Authentication): Observable<any> {
        return this.requestStream({
            route: route,
            data: data,
            authentication: authentication
        }, requester).pipe(map(ans => ans.data));
    }
    requestStream(payload: RoutedPayload, requester?: Observable<number>, options?: RSocketEncoderRequestOptions): Observable<DecodedPayload<any, any> | Payload> {
        if (this._isCompositeMetadataRequest(payload)) {
            return this.parent.requestStream(
                {
                    data: payload.data,
                    dataMimeType: payload.dataMimeType,
                    metadata: this._constructCompositeMetadata(payload),
                    metadataMimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name
                },
                requester,
                options
            )
        } else {
            throw new Error('Only CompositeMetaData requests are implemented');
        }

    }

    simpleRequestFNF(route: string, data?: any, authentication?: Authentication) {
        this.requestFNF({
            route: route,
            data: data,
            authentication: authentication
        });
    }
    requestFNF(payload: RoutedPayload): void {
        if (this._isCompositeMetadataRequest(payload)) {
            return this.parent.requestFNF(
                {
                    data: payload.data,
                    dataMimeType: payload.dataMimeType,
                    metadata: this._constructCompositeMetadata(payload),
                    metadataMimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name
                }
            )
        } else {
            throw new Error('Only CompositeMetaData requests are implemented');
        }
    }

    public addRequestResponseHandler<RequestType, ResponseType = any>(route: string,
        handler: (requestData: RequestType, metadata?: CompositeMetadata) => Observable<ResponseType> | ResponseType,
        options?: MessageRoutingOptions<'dataOnly'>);
    public addRequestResponseHandler<RequestType>(route: string,
        handler: (requestData: RequestType, metadata?: CompositeMetadata) => Observable<DecodedPayload> | DecodedPayload,
        options?: MessageRoutingOptions<'decodedPayload'>);

    public addRequestResponseHandler<RequestType = any, ResponseType = DecodedPayload | any>(
        route: string,
        handler: (requestData: RequestType, metadata?: CompositeMetadata) => Observable<ResponseType> | ResponseType,
        options: MessageRoutingOptions<MessagePayloadType> = {
            payloadType: 'dataOnly'
        }
    ) {
        let mappingHandler = (payload: DecodedPayload<any, any>) => {
            const handlerResponse = handler(payload.data, payload.metadata);
            let responseObservable: Observable<ResponseType>;
            if (handlerResponse instanceof Observable) {
                responseObservable = handlerResponse;
            } else {
                responseObservable = of(handlerResponse);
            }
            if (options.payloadType === 'dataOnly') {
                return responseObservable.pipe(map(v => ({ data: v })));
            } else if (options.payloadType === 'decodedPayload') {
                return responseObservable;
            }
        }

        this.responder.addRequestResponseHandler(
            route,
            mappingHandler,
            options?.encodingOptions
        )
    }

    public addRequestStreamHandler<RequestType, ResponseType = any>(
        route: string,
        handler: (requestData: RequestType, metadata?: CompositeMetadata) => Observable<ResponseType> | ResponseType,
        options?: MessageRoutingOptions<'dataOnly'>
    );
    public addRequestStreamHandler<RequestType>(
        route: string,
        handler: (requestData: RequestType, metadata?: CompositeMetadata) => Observable<DecodedPayload> | DecodedPayload,
        options?: MessageRoutingOptions<'decodedPayload'>
    );
    public addRequestStreamHandler<RequestType, ResponseType = DecodedPayload | any>(
        route: string,
        handler: (requestData: RequestType, metadata?: CompositeMetadata) => Observable<ResponseType> | ResponseType,
        options: MessageRoutingOptions<MessagePayloadType> = {
            payloadType: 'dataOnly'
        }
    ) {
        this.responder.addRequestStreamHandler(
            route,
            this._createMappingHandler(handler, options),
            options?.encodingOptions
        );
    }


    private _createMappingHandler<RequestType, ResponseType>(handler: (requestData: RequestType, metadata?: CompositeMetadata) => Observable<ResponseType> | ResponseType,
        options: MessageRoutingOptions<MessagePayloadType>) {
        let mappingHandler = (payload: DecodedPayload<any, any>) => {
            const handlerResponse = handler(payload.data, payload.metadata);
            let responseObservable: Observable<ResponseType>;
            if (handlerResponse instanceof Observable) {
                responseObservable = handlerResponse;
            } else {
                responseObservable = of(handlerResponse);
            }
            if (options.payloadType === 'dataOnly') {
                return responseObservable.pipe(map(v => ({ data: v })));
            } else if (options.payloadType === 'decodedPayload') {
                return responseObservable;
            }
        }
        return mappingHandler;
    }


    close(): Observable<void> {
        return this.parent.close();
    }
    state(): Observable<RSocketState> {
        return this.parent.state();
    }
    getSetupConfig(): RSocketConfig {
        return this.parent.getSetupConfig();
    }

    private _isCompositeMetadataRequest(payload: RoutedPayload): boolean {
        return (payload.metadataMimeType && payload.metadataMimeType == WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name)
            || this.getSetupConfig().metadataMimeType == WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name;
    }

    private _constructCompositeMetadata(payload: RoutedPayload): CompositeMetadata {
        const metadata = payload.metadata == undefined ? new CompositeMetadata() : payload.metadata;
        metadata.push({
            mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name,
            data: payload.route
        });
        if (payload.authentication) {
            metadata.push({
                mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION_V0.name,
                data: payload.authentication
            });
        }
        return metadata;

    }

}