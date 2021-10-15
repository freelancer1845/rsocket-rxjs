import { Observable } from 'rxjs';
import { delay, filter, retryWhen } from 'rxjs/operators';
import { RSocketConfig } from '../core/config/rsocket-config';
import { Payload } from '../core/protocol/payload';
import { RSocketClient } from '../core/rsocket-client.impl';
import { Transport } from '../core/transport/transport.api';
import { WebsocketTransport } from '../core/transport/websocket-transport.impl';
import { CompositeMetadata } from '../extensions/composite-metadata';
import { EncodingRSocket } from '../extensions/encoding-rsocket-client';
import { MessageRoutingRSocket } from '../extensions/messages/message-routing-rsocket';
import { Authentication } from '../extensions/security/authentication';
import { WellKnownMimeTypes } from '../extensions/well-known-mime-types';
import { RSocketState } from './rsocket.api';


/**
 * A builder that should work with Spring Messaging for RSocket
 */
export class SpringRSocketMessagingBuilder {

    private _config: RSocketConfig = {
        majorVersion: 1,
        minorVersion: 0,
        honorsLease: false,
        keepaliveTime: 30000,
        maxLifetime: 100000,
        dataMimeType: WellKnownMimeTypes.APPLICATION_JSON.name,
        metadataMimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name,
        setupPayload: undefined,
        fragmentSize: 16777215      // 16mb
    }

    private _setupData: any;
    private _setupMetdata = new CompositeMetadata();

    private _connectionString: string;

    public keepaliveTime(time: number) {
        this._config.keepaliveTime = time;
        return this;
    }

    public maxLifetime(time: number) {
        this._config.maxLifetime = time;
        return this;
    }

    public dataMimeType(type: string) {
        this._config.dataMimeType = type;
        return this;
    }

    public connectMappingRoute(route: string) {
        this._setupMetdata.route = route;
        return this;
    }

    public connectMappingData(data: any) {
        this._setupData = data;
        return this;
    }

    public connectAuthentication(authentication: Authentication) {
        this._setupMetdata.authentication = authentication;
        return this;
    }

    public connectionString(str: string) {
        this._connectionString = str;
        return this;
    }

    public fragmentMaxSize(sizeInBytes: number) {
        this._config.fragmentSize = sizeInBytes;
        return this;
    }

    private getSetupConfig(socket: EncodingRSocket): RSocketConfig {

        return {
            ...this._config,
            setupPayload: new Payload(
                socket.tryEncodeObject(this._setupData, this._config.dataMimeType),
                socket.tryEncodeObject(this._setupMetdata, WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name)
            )
        }

    }

    private _encodingCustomizer: (encodingSocket: EncodingRSocket) => void = s => { };

    public customizeEncoding(encodingSocketConsumer: (encodingSocket: EncodingRSocket) => void) {
        this._encodingCustomizer = encodingSocketConsumer;
        return this;
    }

    private _preConnectionRoutesCustomizer: (messageRoutSocket: MessageRoutingRSocket) => void = s => { };

    public customizeMessageRoutingRSocket(socketConsumer: (messageRoutingSocket: MessageRoutingRSocket) => void) {
        this._preConnectionRoutesCustomizer = socketConsumer;
        return this;
    }

    private _automaticReconnect = false;
    private _reconnectWaitTime = 5000;
    public automaticReconnect(waitTime: number = 5000) {
        this._automaticReconnect = true;
        this._reconnectWaitTime = waitTime;
        return this;
    }


    /**
     * 
     * This establishes the connection on subscribe.
     * Note that this observable will never complete.
     * Unsubscribing will close the connection.
     * 
     * To add route mappings before the connection is established use 'customizeMessageRoutingRSocket'.
     * 
     * To customize encoders use 'customizeEncoding'
     * 
     * @returns 
     */
    public build(): Observable<MessageRoutingRSocket> {

        const obs = new Observable<MessageRoutingRSocket>(observer => {

            const transport = this.buildTransport();
            const rsocket = new RSocketClient(transport, undefined, undefined);
            const encodingSocket = new EncodingRSocket(rsocket);
            this._encodingCustomizer(encodingSocket);
            rsocket.setSetupConfig(this.getSetupConfig(encodingSocket));
            const messageSocket = new MessageRoutingRSocket(encodingSocket);
            this._preConnectionRoutesCustomizer(messageSocket);
            observer.next(messageSocket);
            rsocket.establish();

            const stateSub = rsocket.state().pipe(filter(s => s == RSocketState.Error)).subscribe(s => observer.error(new Error("RSocket failed")));
            return () => {
                messageSocket.close();
                stateSub.unsubscribe();
            };
        });

        if (this._automaticReconnect) {
            return obs.pipe(retryWhen(delay(this._reconnectWaitTime)));
        } else {
            return obs;
        }

    }


    private buildTransport(): Transport {
        if (this._connectionString.match("^(ws:)|(wss:)\/\/.*$") != null) {
            const transport = new WebsocketTransport(this._connectionString);
            return transport;
        } else {
            throw new Error("Currently only supports websocket. Connection string must be 'ws://...'");
        }
    }
}



