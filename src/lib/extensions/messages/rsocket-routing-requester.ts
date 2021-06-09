import { defer, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Authentication, CompositeMetaData, MimeType } from '../../api/rsocket-mime.types';
import { RSocket } from "../../api/rsocket.api";
import { Payload } from "../../core/protocol/payload";
import { FluentRequest } from "./rsocket-fluent";


export class RSocketRoutingRequester {

    constructor(public readonly rsocket: RSocket) {

    }

    public requestResponse<O, I>(
        route: string,
        payload?: O,
        outgoingMimeType: MimeType<O> = MimeType.APPLICATION_JSON,
        incomingMimeType: MimeType<I> = MimeType.APPLICATION_JSON,
        authentication?: Authentication): Observable<I> {
        return defer(() => {
            const metaData: CompositeMetaData[] = this.standardMetadataConstructor(route, authentication, outgoingMimeType, [incomingMimeType]);
            const dataBuffer = outgoingMimeType.coder.encoder(payload, this.rsocket.mimeTypeRegistry);
            const metadataBuffer = MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.encoder(metaData, this.rsocket.mimeTypeRegistry);

            const _payload = new Payload(dataBuffer, metadataBuffer);
            return this.rsocket.requestResponse(_payload).pipe(map(ans => {
                if (ans.hasMetadata()) {
                    const composite = MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.decoder(ans.metadata, this.rsocket.mimeTypeRegistry);
                }
                return incomingMimeType.coder.decoder(ans.data, this.rsocket.mimeTypeRegistry);
            }));
        });
    }

    public requestStream<O, I>(
        route: string, payload?: O,
        outgoingMimeType: MimeType<O> = MimeType.APPLICATION_JSON,
        incomingMimeType: MimeType<I> = MimeType.APPLICATION_JSON,
        authentication?: Authentication,
        requester?: Observable<number>): Observable<I> {
        return defer(() => {
            const metaData: CompositeMetaData[] = this.standardMetadataConstructor(route, authentication, outgoingMimeType, [incomingMimeType]);
            const dataBuffer = outgoingMimeType.coder.encoder(payload, this.rsocket.mimeTypeRegistry);
            const metadataBuffer = MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.encoder(metaData, this.rsocket.mimeTypeRegistry);

            const _payload = new Payload(dataBuffer, metadataBuffer);
            return this.rsocket.requestStream(_payload, requester).pipe(map(ans => {
                return incomingMimeType.coder.decoder(ans.data, this.rsocket.mimeTypeRegistry);
            }));
        });
    }

    public requestFNF<O>(
        route: string,
        payload?: O,
        payloadMimeType: MimeType<O> = MimeType.APPLICATION_JSON,
        authentication?: Authentication
    ): void {
        const metaData: CompositeMetaData[] = this.standardMetadataConstructor(route, authentication, payloadMimeType);
        const dataBuffer = payloadMimeType.coder.encoder(payload, this.rsocket.mimeTypeRegistry);
        const metadataBuffer = MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA.coder.encoder(metaData, this.rsocket.mimeTypeRegistry);

        const _payload = new Payload(dataBuffer, metadataBuffer);
        this.rsocket.requestFNF(_payload);

    }


    public route<I, O>(route: string): FluentRequest<I, O> {
        return new FluentRequest(this, route);
    }



    private standardMetadataConstructor(route: string, auth?: Authentication, dataMimeTypes?: MimeType, acceptMimeTypes?: MimeType[]): CompositeMetaData[] {
        const metaData: CompositeMetaData[] = [];
        metaData.push({
            type: MimeType.MESSAGE_X_RSOCKET_ROUTING,
            data: route
        });
        if (auth != undefined) {
            metaData.push({
                type: MimeType.MESSAGE_X_RSOCKET_AUTHENTICATION,
                data: auth
            })
        }
        if (dataMimeTypes != undefined) {
            metaData.push({
                type: MimeType.MESSAGE_X_RSOCKET_MIME_TYPE,
                data: dataMimeTypes
            })
        }
        if (acceptMimeTypes != undefined && acceptMimeTypes.length > 0) {
            metaData.push({
                type: MimeType.MESSAGE_X_RSOCKET_ACCEPT_MIME_TYPES,
                data: acceptMimeTypes
            });
        }
        return metaData;
    }

}