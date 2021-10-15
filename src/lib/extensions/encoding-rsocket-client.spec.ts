import { Payload } from "../core/protocol/payload";
import { RSocketClient } from "../core/rsocket-client.impl";
import { WebsocketTransport } from "../core/transport/websocket-transport.impl";
import { CompositeMetadata } from "./composite-metadata";
import { EncodingRSocket } from "./encoding-rsocket-client";
import { WellKnownMimeTypes } from "./well-known-mime-types";



interface SimpleTestObject {
    nested?: SimpleTestObject;
    name: string;
    age: number;
    greatness: number;
}


const WebSocket = require('ws')
global.WebSocket = WebSocket


describe("request_patterns", () => {
    let socket: EncodingRSocket;
    beforeAll(done => {
        const transport = new WebsocketTransport("ws://localhost:8080/rsocket");
        const client = new RSocketClient(transport, undefined, {
            setupPayload: new Payload(new Uint8Array(0)),
            dataMimeType: WellKnownMimeTypes.APPLICATION_JSON.name,
            metadataMimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name,
            honorsLease: false,
            keepaliveTime: 30000,
            majorVersion: 1,
            minorVersion: 0,
            maxLifetime: 100000,
            fragmentSize: 50 * 1024,
        });
        socket = new EncodingRSocket(client);
        client.establish();
        done();
    });

    it("Automagically decodes json using the standard decoder", done => {
        const metadata = new CompositeMetadata();
        const testObject = {
            nested: null,
            age: 18,
            greatness: 0.1,
            name: 'Peter'
        } as SimpleTestObject;
        metadata.route = '/encoding/request-response';
        socket.requestResponse({
            data: testObject,
            metadata: metadata
        }).subscribe(res => {
            console.log(res);
            const data = res.data as SimpleTestObject;
            expect(data.nested).toEqual(testObject);
            expect(data.age).toEqual(testObject.age + 1);
            expect(data.name).toEqual(testObject.name);
            expect(data.greatness).toEqual(testObject.greatness + 0.1);
            done();
        });
    });

    // it("Automagically decodes nested json objects", done => {

    // })

    afterAll(done => {
        socket.close().subscribe({
            complete: () => {
                done();
            }
        });
    });
});