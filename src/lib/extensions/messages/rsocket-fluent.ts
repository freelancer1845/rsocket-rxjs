import { Observable } from 'rxjs';
import { Authentication, MimeType } from '../../api/rsocket-mime.types';
import { RSocketRoutingRequester } from './rsocket-routing-requester';


export class FluentRequest<O, I> {

    constructor(
        private requester: RSocketRoutingRequester,
        private _route: string,
        private _data?: any,
        private _outgoingMimeType?: MimeType<O>,
        private _incomingMimeType?: MimeType<I>,
        private _authentication?: Authentication,
        private _requester?: Observable<number>,
    ) {
    }


    public data(data: any) {
        this._data = data;
        return this.copy();
    }

    private copy() {
        return new FluentRequest(this.requester, this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication, this._requester);
    }

    public requestMimetype<L>(type: MimeType<L>): FluentRequest<L, I> {
        return new FluentRequest(this.requester, this._route, this._data, type, this._incomingMimeType, this._authentication, this._requester);
    }

    public answerMimetype<L>(type: MimeType<L>): FluentRequest<O, L> {
        return new FluentRequest(this.requester, this._route, this._data, this._outgoingMimeType, type, this._authentication, this._requester);
    }

    public authentication(auth: Authentication): FluentRequest<O, I> {
        return new FluentRequest(this.requester, this._route, this._data, this._outgoingMimeType, this._incomingMimeType, auth, this._requester);
    }

    public requestResponse(): Observable<I> {
        return this.requester.requestResponse(this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication);
    }

    public requestStream(): Observable<I> {
        return this.requester.requestStream(this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication, this._requester);
    }

    public fireAndForget(): void {
        this.requester.requestFNF(this._route, this._data, this._outgoingMimeType, this._authentication);
    }



}
