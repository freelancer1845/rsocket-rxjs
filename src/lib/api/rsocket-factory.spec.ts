import { Subscription } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { WellKnownMimeTypes } from '../extensions/well-known-mime-types';
import { arrayBufferToUtf8String, stringToUtf8ArrayBuffer } from '../utlities/conversions';
import { SpringRSocketMessagingBuilder } from './rsocket-factory';



const WebSocket = require('ws')
global.WebSocket = WebSocket

describe("SpringRSocketMessagingBuilder", () => {

    it("Should create an rsocket connection", done => {

        const subscription = new SpringRSocketMessagingBuilder().connectionString('ws://localhost:8080/rsocket').build().pipe(
            concatMap(socket => {
                return socket.simpleRequestResponse('/basic/request-response', 'Hello World');
            })
        ).subscribe(ans => {
            expect(ans).toEqual("Hello World");
            done();
            setTimeout(() => subscription.unsubscribe(), 100);
        });

    });
    it("Customizes encoding socket", done => {
        const subscription = new SpringRSocketMessagingBuilder().connectionString('ws://localhost:8080/rsocket')
            .customizeEncoding(socket => socket.addEncoder({
                mimeType: WellKnownMimeTypes.APPLICATION_JSON.name,
                encode: data => {
                    if (data != undefined) {
                        done();
                    }
                    return stringToUtf8ArrayBuffer(JSON.stringify(data));
                }
            }))
            .build().subscribe(socket => {
                socket.simpleRequestResponse('/basic/request-response', 'Hello World').subscribe();
                setTimeout(() => subscription.unsubscribe(), 100);
            });
    });
    it("Customizes messaging socket", done => {
        const subscription = new SpringRSocketMessagingBuilder().connectionString('ws://localhost:8080/rsocket')
            .customizeMessageRoutingRSocket(socket => socket.addRequestResponseHandler('/basic/request-response', data => {
                done();
                return data;
            })).build().subscribe(socket => {
                socket.simpleRequestResponse('/basic/request-reverse-response', {
                    topic: '/basic/request-response',
                    data: 'empty'
                }).subscribe();
                setTimeout(() => subscription.unsubscribe(), 400);
            });
    });
    it("Does automatic reconnect", done => {
        let connectCount = 0;
        const subscription = new SpringRSocketMessagingBuilder().connectionString('ws://localhost:8080/rsocket')
            .automaticReconnect(2000).build().subscribe(socket => {
                connectCount += 1;
                if (connectCount == 2) {
                    done();
                }
                socket.simpleRequestFNF('/basic/disconnect');
            });
        setTimeout(() => subscription.unsubscribe(), 3000);
    });
    it("Can handle a custom data mime type", done => {
        const subscription = new SpringRSocketMessagingBuilder().connectionString('ws://localhost:8080/rsocket')
            .dataMimeType("application/stringreverse")
            .customizeEncoding(encoder => {
                encoder.addEncoder({
                    mimeType: "application/stringreverse",
                    encode: buf => stringToUtf8ArrayBuffer(buf),
                });
                encoder.addDecoder({
                    mimeType: "application/stringreverse",
                    decode: buf => arrayBufferToUtf8String(buf)
                })
            })
            .build().subscribe(socket => {
                socket.simpleRequestResponse("/basic/mime/stringreverse", "Hello").subscribe(v => done());
            });
        setTimeout(() => subscription.unsubscribe(), 3000);
    }
    );
});