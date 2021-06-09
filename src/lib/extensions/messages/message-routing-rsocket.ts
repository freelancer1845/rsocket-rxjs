import { Observable } from "rxjs";
import { Authentication, CompositeMetaData, MimeType } from '../../api/rsocket-mime.types';
import { BackpressureStrategy } from '../../api/rsocket.api';
import { RSocketRoutingRequester } from "./rsocket-routing-requester";
import { RSocketRoutingResponder } from "./rsocket-routing-responder";




export class MessageRoutingRSocket {


    constructor(
        public readonly responder: RSocketRoutingResponder,
        public readonly requester: RSocketRoutingRequester,
    ) {
    }


    public requestResponse<O, I>(
        route: string,
        payload?: O,
        outgoingMimeType: MimeType<O> = MimeType.APPLICATION_JSON,
        incomingMimeType: MimeType<I> = MimeType.APPLICATION_JSON,
        authentication?: Authentication): Observable<I> {
        return this.requester.requestResponse(route, payload, outgoingMimeType, incomingMimeType, authentication);
    }

    public requestStream<O, I>(
        route: string, payload?: O,
        outgoingMimeType: MimeType<O> = MimeType.APPLICATION_JSON,
        incomingMimeType: MimeType<I> = MimeType.APPLICATION_JSON,
        authentication?: Authentication,
        requester?: Observable<number>): Observable<I> {
        return this.requester.requestStream(route, payload, outgoingMimeType, incomingMimeType, authentication, requester);
    }

    public requestFNF<O>(
        route: string,
        payload?: O,
        payloadMimeType: MimeType<O> = MimeType.APPLICATION_JSON,
        authentication?: Authentication
    ): void {
        this.requester.requestFNF(route, payload, payloadMimeType, authentication);

    }


    /**
     * @deprecated Configure using the responder provided to the rsocket
     * @param topic 
     * @param handler 
     * @param incomingMimeType 
     * @param outgoingMimeType 
     */
    public addRequestResponseHandler(
        topic: string,
        handler: (payload: any) => Observable<any> | any,
        incomingMimeType = MimeType.APPLICATION_JSON,
        outgoingMimeType = MimeType.APPLICATION_JSON,
    ): void {
        this.responder.addRequestResponseHandler(topic, handler, incomingMimeType, outgoingMimeType);
    }

    /**
     * @deprecated Configure using the responder provided to the rsocket
     * @param topic 
     * @param handler 
     * @param incomingMimeType 
     * @param outgoingMimeType 
     */
    public addRequestStreamHandler(
        topic: string,
        handler: (payload: any) => Observable<any> | any,
        incomingMimeType = MimeType.APPLICATION_JSON,
        outgoingMimeType = MimeType.APPLICATION_JSON,
        backpressureStrategy: BackpressureStrategy = BackpressureStrategy.BufferDelay,
    ): void {
        this.responder.addRequestStreamHandler(topic, handler, incomingMimeType, outgoingMimeType, backpressureStrategy);
    }







}