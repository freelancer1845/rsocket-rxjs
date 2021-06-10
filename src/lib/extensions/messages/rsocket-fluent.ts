import { Observable } from 'rxjs';
import { Authentication } from '../security/authentication';


export class FluentRequest<O, I> {

    constructor(
        // private requester: RSocketRoutingRequester,
        private _route: string,
        private _data?: any,
        private _authentication?: Authentication,
    ) {
    }


    // public data(data: any) {
    //     this._data = data;
    //     return this.copy();
    // }

    // private copy() {
    //     return new FluentRequest(this.requester, this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication);
    // }

    // public requestMimetype<L>(type: MimeType<L>): FluentRequest<L, I> {
    //     return new FluentRequest(this.requester, this._route, this._data, type, this._incomingMimeType, this._authentication);
    // }

    // public answerMimetype<L>(type: MimeType<L>): FluentRequest<O, L> {
    //     return new FluentRequest(this.requester, this._route, this._data, this._outgoingMimeType, type, this._authentication);
    // }

    // public authentication(auth: Authentication): FluentRequest<O, I> {
    //     return new FluentRequest(this.requester, this._route, this._data, this._outgoingMimeType, this._incomingMimeType, auth);
    // }

    // public requestResponse(): Observable<I> {
    //     return this.requester.requestResponse(this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication);
    // }

    // public requestStream(requester?: Observable<number>): Observable<I> {
    //     return this.requester.requestStream(this._route, this._data, this._outgoingMimeType, this._incomingMimeType, this._authentication, requester);
    // }

    // public fireAndForget(): void {
    //     this.requester.requestFNF(this._route, this._data, this._outgoingMimeType, this._authentication);
    // }



}
