import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { BackpressureStrategy, RSocketResponder } from "../api/rsocket.api";
import { Payload } from "../core/protocol/payload";
import { DecodedPayload, EncodingRSocket } from "./encoding-rsocket-client";




export abstract class EncodingRSocketResponder implements RSocketResponder {

    constructor(public readonly encodingRSocket: EncodingRSocket) {

    }

    handleRequestStream(payload: Payload): { stream: Observable<Payload>; backpressureStrategy: BackpressureStrategy; } {
        const handler = this.handleDecodedRequestStream(this.encodingRSocket.tryDecodePayload(payload));
        return {
            stream: handler.stream.pipe(map(ans => this.encodingRSocket.tryEncodePayload(ans))) as Observable<Payload>,
            backpressureStrategy: handler.backpressureStrategy
        }
    }
    handleRequestResponse(payload: Payload): Observable<Payload> {
        return this.handleDecodedRequestResponse(this.encodingRSocket.tryDecodePayload(payload)).pipe(
            map(ans => this.encodingRSocket.tryEncodePayload(ans))
        );
    }
    handleFNF(payload: Payload): void {
        this.handleDecodedFireAndForget(this.encodingRSocket.tryDecodePayload(payload));
    }


    public abstract handleDecodedRequestStream(payload: DecodedPayload): { stream: Observable<DecodedPayload>; backpressureStrategy: BackpressureStrategy };
    public abstract handleDecodedRequestResponse(payload: DecodedPayload): Observable<DecodedPayload>;
    public abstract handleDecodedFireAndForget(payload: DecodedPayload): void;
}