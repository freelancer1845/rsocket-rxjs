import { Observable } from "rxjs";
import { RSocketConfig } from '../core/config/rsocket-config';
import { Payload } from '../core/protocol/payload';


export enum RSocketState {
    Disconnected = 'Disconnected',
    Connected = 'Connected',
    Error = 'Error',
    Reconnecting = 'Reconnecting'
}

export enum BackpressureStrategy {
    BufferDelay,
    Drop,
}

export type RequestResponseHandler = (payload: Payload) => Observable<Payload>;
/**
 * Use the requester to pull elements from the stream => "backpressure" support
 */
export type RequestStreamHandler = (payload: Payload) => { stream: Observable<Payload>, backpressureStrategy: BackpressureStrategy };
export type RequestFNFHandler = (payload: Payload) => void;

export interface RSocket<RequestPayload, ResponsePayload, RequestOptions = never> {

    responder: RSocketResponder;

    // establish(config: RSocketConfig<any, any>): void;
    close(): Observable<void>;
    state(): Observable<RSocketState>;

    requestResponse(payload: RequestPayload, options?: RequestOptions): Observable<ResponsePayload>;
    requestStream(payload: RequestPayload, requester?: Observable<number>, options?: RequestOptions): Observable<ResponsePayload>;
    requestFNF(payload: RequestPayload, options?: RequestOptions): void;

    getSetupConfig(): RSocketConfig;
}

export interface RSocketResponder {

    handleRequestStream(payload: Payload): { stream: Observable<Payload>, backpressureStrategy: BackpressureStrategy };
    handleRequestResponse(payload: Payload): Observable<Payload>;
    handleFNF(payload: Payload): void;

}