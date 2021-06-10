import { defer, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { RSocket, RSocketResponder, RSocketState } from "../api/rsocket.api";
import { RSocketConfig } from "../core/config/rsocket-config";
import { Payload } from "../core/protocol/payload";
import { decodeAuthentication, decodeCompositeMetadata, decodeJson, decodeMessageAcceptMimeTypes, decodeMessageMimeType, decodeMessageRoute, encodeAuthentication, encodeCompositionMetadata, encodeJson, encodeMessageAcceptMimeTypes, encodeMessageMimeType, encodeMessageRoute } from "./encoder/message-x-rsocket";
import { WellKnownMimeTypes } from "./well-known-mime-types";


export interface DecodedPayload<DataType = any, MetadataType = any> {
    data?: DataType;
    dataMimeType?: string;
    metadata?: MetadataType;
    metadataMimeType?: string;
}

export interface RSocketEncoderRequestOptions {
    responseDataMimeType?: string;
    responseMetadataMimeType?: string;
}

export interface RSocketEncoder {
    mimeType: string;
    encode: (data: any, rsocket: EncodingRSocket) => Uint8Array;
}

export interface RSocketDecoder {
    mimeType: string;
    decode: (buffer: Uint8Array, rsocket: EncodingRSocket) => any;
}

export class EncodingRSocket implements RSocket<DecodedPayload, DecodedPayload, RSocketEncoderRequestOptions> {

    private _encoder = new Map<string, RSocketEncoder>();
    private _decoder = new Map<string, RSocketDecoder>();

    constructor(
        public readonly rsocket: RSocket<Payload, Payload>
    ) {

        this.addDecoder({
            mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name,
            decode: decodeCompositeMetadata
        })
            .addEncoder({
                mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name,
                encode: encodeCompositionMetadata
            })
            .addDecoder({
                mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_ACCEPT_MIME_TYPES_V0.name,
                decode: decodeMessageAcceptMimeTypes
            })
            .addEncoder({
                mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_ACCEPT_MIME_TYPES_V0.name,
                encode: encodeMessageAcceptMimeTypes
            })
            .addDecoder({
                mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_MIME_TYPE_V0.name,
                decode: decodeMessageMimeType
            })
            .addEncoder({
                mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_MIME_TYPE_V0.name,
                encode: encodeMessageMimeType
            })
            .addDecoder({
                mimeType: WellKnownMimeTypes.APPLICATION_JSON.name,
                decode: decodeJson
            }).addEncoder({
                mimeType: WellKnownMimeTypes.APPLICATION_JSON.name,
                encode: encodeJson
            })
            .addDecoder({
                mimeType: WellKnownMimeTypes.APPLICATION_OCTET_STREAM.name,
                decode: (buffer, socket) => buffer
            })
            .addEncoder({
                mimeType: WellKnownMimeTypes.APPLICATION_OCTET_STREAM.name,
                encode: (buffer, socket) => buffer
            })
            .addDecoder({
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


    get responder(): RSocketResponder {
        return this.rsocket.responder;
    }

    close(): Observable<void> {
        return this.rsocket.close();
    }
    state(): Observable<RSocketState> {
        return this.rsocket.state();
    }

    public addEncoder(encoder: RSocketEncoder): EncodingRSocket {
        this._encoder.set(encoder.mimeType, encoder);
        return this;
    }

    public addDecoder(decoder: RSocketDecoder): EncodingRSocket {
        this._decoder.set(decoder.mimeType, decoder);
        return this;
    }

    public removeEncoder(mimeType: string): EncodingRSocket {
        this._encoder.delete(mimeType);
        return this;
    }

    public removeDecoder(mimeType: string): EncodingRSocket {
        this._decoder.delete(mimeType);
        return this;
    }

    public requestResponse(payload: DecodedPayload, options?: RSocketEncoderRequestOptions): Observable<DecodedPayload> {
        return defer(() => {
            let encodedPayload = this.tryEncodePayload(payload);
            return this.rsocket.requestResponse(encodedPayload);
        }).pipe(
            map(res => this.tryDecodePayload(res, options))
        );
    }
    public requestStream(payload: DecodedPayload,
        requester?: Observable<number>,
        options?: RSocketEncoderRequestOptions): Observable<DecodedPayload> {

        let encodedPayload = this.tryEncodePayload(payload);
        return this.rsocket.requestStream(encodedPayload, requester).pipe(
            map(res => this.tryDecodePayload(res, options))
        )
    }
    public requestFNF(payload: DecodedPayload): void {
        this.rsocket.requestFNF(this.tryEncodePayload(payload));
    }


    public setResponder(responder: RSocketResponder) {
        this.rsocket.responder = responder;
    }




    public tryEncodePayload(payload: DecodedPayload): Payload {
        let data = new Uint8Array(0);
        let metadata = new Uint8Array(0);
        if (payload.data != undefined) {
            data = this.tryEncodeObject(payload.data, payload.dataMimeType != undefined ? payload.dataMimeType : this.getSetupConfig().dataMimeType);
        }
        if (payload.metadata != undefined) {
            metadata = this.tryEncodeObject(payload.metadata, payload.metadataMimeType != undefined ? payload.metadataMimeType : this.getSetupConfig().metadataMimeType);
        }
        return new Payload(data, metadata);
    }

    public tryEncodeObject(object: any, mimeType: string): Uint8Array {
        if (this._encoder.has(mimeType)) {
            return this._encoder.get(mimeType).encode(object, this);
        } else {
            throw new Error(`No encoder for MimeType ${mimeType} available!`);
        }
    }

    public tryDecodePayload(payload: Payload, options?: RSocketEncoderRequestOptions): DecodedPayload<any, any> {
        let data = undefined;
        let metadata = undefined;
        if (options == undefined) {
            options = {
                responseDataMimeType: this.rsocket.getSetupConfig().dataMimeType,
                responseMetadataMimeType: this.rsocket.getSetupConfig().metadataMimeType,
            }
        }
        if (options.responseDataMimeType == undefined) {
            options.responseDataMimeType = this.rsocket.getSetupConfig().dataMimeType;
        }
        if (options.responseMetadataMimeType == undefined) {
            options.responseMetadataMimeType = this.rsocket.getSetupConfig().metadataMimeType;
        }
        data = this.tryDecodeObject(payload.data, options.responseDataMimeType);
        if (payload.hasMetadata()) {
            metadata = this.tryDecodeObject(payload.metadata, options.responseMetadataMimeType);
        }
        return {
            data: data,
            dataMimeType: options.responseDataMimeType,
            metadata: metadata,
            metadataMimeType: metadata != undefined ? options.responseMetadataMimeType : undefined
        }

    }

    public tryDecodeObject(buffer: Uint8Array, mimeType: string): any {
        if (this._decoder.has(mimeType)) {
            return this._decoder.get(mimeType).decode(buffer, this);
        } else {
            throw new Error(`No decoder for MimeType ${mimeType} available!`);
        }
    }

    getSetupConfig(): RSocketConfig {
        return this.rsocket.getSetupConfig();
    }
}
