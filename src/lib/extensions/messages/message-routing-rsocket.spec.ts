import { BehaviorSubject, range, timer } from "rxjs";
import { concatMap, flatMap, reduce } from 'rxjs/operators';
import { Payload } from "../../core/protocol/payload";
import { RSocketClient } from "../../core/rsocket-client.impl";
import { WebsocketTransport } from "../../core/transport/websocket-transport.impl";
import { EncodingRSocket } from "../encoding-rsocket-client";
import { WellKnownMimeTypes } from "../well-known-mime-types";
import { MessageRoutingRSocket } from "./message-routing-rsocket";

const WebSocket = require('ws')
global.WebSocket = WebSocket


describe("request_patterns", () => {
    let socket: MessageRoutingRSocket;
    beforeAll(done => {
        const transport = new WebsocketTransport("ws://localhost:8080/rsocket");
        const client = new RSocketClient(transport, undefined, {
            setupPayload: new Payload(new Uint8Array(0)),
            // setupPayload: new Payload(
            //     encodeJson(stringToUtf8ArrayBuffer('Test-Client'), encodingClient),
            //     encodeCompositionMetadata([
            //         {
            //             type: WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name,
            //             data: 'connect-client'
            //         }
            //     ], encodingClient)),
            dataMimeType: WellKnownMimeTypes.APPLICATION_JSON.name,
            metadataMimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0.name,
            honorsLease: false,
            keepaliveTime: 30000,
            majorVersion: 1,
            minorVersion: 0,
            maxLifetime: 100000,
            fragmentSize: 50 * 1024
        });
        const encodingClient = new EncodingRSocket(client);
        socket = new MessageRoutingRSocket(encodingClient);
        const responder = socket.responder;
        // responder.addRequestResponseHandler('/basic/setup-payload', ans => {
        //     expect(ans).toEqual('Test-Client');
        //     done();
        //     return ans;
        // })
        client.establish();
        done();
    })
    it("Returns Request Response payload", done => {
        socket.simpleRequestResponse('/basic/request-response', 'Hello World').subscribe(ans => {
            expect(ans).toEqual("Hello World");
            done();
        });
    });
    it("Maps Error", done => {
        socket.simpleRequestResponse('/error/request-response', 'Hello World').subscribe(ans => {
        }, (err: Error) => {
            expect(err.message.match(/Error: (\d+)\. Message: "(.+)"$/)[1]).toEqual("513");
            expect(err.message.match(/Error: (\d+)\. Message: "(.+)"$/)[2]).toEqual("Hello World");
            done()
        });
    })
    it("Subscribes Using Request Stream", done => {
        let counter = 0;
        socket.simpleRequestStream('/basic/request-stream', 42).subscribe(ans => {
            expect(ans).toEqual(counter++);
        }, err => { }, () => {
            expect(counter).toEqual(42);
            done();
        });
    });
    it("Respects Backpressure Requester", done => {
        let counter = 0;
        const requester = new BehaviorSubject<number>(1);
        socket.simpleRequestStream('/basic/request-stream', 42, requester).subscribe(ans => {
            expect(ans).toEqual(counter++);
            requester.next(1);
        }, err => { }, () => {
            expect(counter).toEqual(42);
            done();
        });
    });
    it("Request Stream sends cancel signal", done => {
        let counter = 0;
        const sub = socket.simpleRequestStream('/basic/request-stream/unending').subscribe(ans => {
            expect(ans).toEqual(counter++);
        });
        timer(200).subscribe(a => sub.unsubscribe());
        timer(400).pipe(flatMap(s => socket.simpleRequestResponse('/basic/request-stream/is-canceled'))).subscribe(n => {
            expect(n).toBeTruthy();
            done();
        });
    });
    it("Request FNF reaches server", done => {
        socket.simpleRequestFNF('/basic/request-fnf', 'Must be 42');

        timer(200).pipe(flatMap(s => socket.simpleRequestResponse('/basic/request-fnf/check'))).subscribe(n => {
            expect(n).toEqual('Must be 42');
            done();
        });
    });
    it("Handles Request Response / dataOnly", done => {

        socket.addRequestResponseHandler<string, string>('/basic/request-response', input => input + '-hello');

        socket.simpleRequestResponse('/basic/request-reverse-response', {
            topic: '/basic/request-response',
            data: "world"
        }).subscribe(ans => {
            expect(ans).toEqual("world-hello");
            done();
        });
    });
    it("Handles Request Response / decodedPayload", done => {
        socket.responder.removeHandler('/basic/request-response');
        socket.addRequestResponseHandler<string>('/basic/request-response', input => ({ data: input + '-hello' }), { payloadType: 'decodedPayload' });

        socket.simpleRequestResponse('/basic/request-reverse-response', {
            topic: '/basic/request-response',
            data: "world"
        }).subscribe(ans => {
            expect(ans).toEqual("world-hello");
            done();
        })
    });
    it("Handles Empty Request Response", done => {
        socket.addRequestResponseHandler(
            '/basic/empty-request-response',
            data => {
                expect(data).toBeUndefined();
                return 'hello';
            }
        );
        socket.simpleRequestResponse('/basic/empty-request-reverse-response', {
            topic: '/basic/empty-request-response',
            data: "\"empty\""
        }).subscribe(ans => {
            expect(ans).toEqual("hello");
            done();
        })
    })
    it("Handles Request Stream", done => {
        socket.addRequestStreamHandler(
            '/basic/request-response',
            data => range(0, Number(data))
        );
        socket.simpleRequestResponse('/basic/request-reverse-stream', {
            topic: '/basic/request-response',
            data: 42
        }).subscribe(ans => {
            range(0, 42).pipe(reduce((a, b) => a + b, 0)).subscribe(result => expect(ans).toEqual(result), err => {
                fail(err);
            }, () => done());
        })
    });
    it("Authenticates using simple authentication on request-response", done => {
        socket.simpleRequestResponse('/secure/request-response',
            'DoSthUnallowed',
            {
                type: 'simple',
                username: 'user',
                password: 'pass'
            }
        ).subscribe(ans => {
            expect(ans).toEqual('DoSthUnallowed');
            done();
        });
    });
    it("Authenticates using simple authentication on request-stream", done => {
        socket.simpleRequestStream('/secure/request-stream',
            'DoSthUnallowed',
            undefined,
            {
                type: 'simple',
                username: 'user',
                password: 'pass'
            }
        ).subscribe(ans => {
            expect(ans).toEqual('DoSthUnallowed');
            done();
        });
    });
    it("Authenticates using fire and forget", done => {
        const number = Math.random();
        socket.simpleRequestFNF('/secure/fnf', number, {
            type: 'simple',
            username: 'user',
            password: 'pass'
        });
        timer(200).pipe(concatMap(t => {
            return socket.simpleRequestResponse('/secure/fnf/verify', undefined, {
                type: 'simple',
                username: 'user',
                password: 'pass'
            });
        }))
            .subscribe(ans => {
                expect(Number(ans)).toEqual(number);
                done();
            })
    })
    it("Fails  unauthenticated", done => {
        socket.simpleRequestResponse('/secure/request-response',
            'DoSthUnallowed',
        ).subscribe(ans => {
            expect(ans).toBe("Error: 513. Message: Access Denied");
            done();
        }, err => {
            expect(err.message).toMatch(/^Error: 513.+$/);
            done();
        });
    });
    it("Fails with wrong credentials", done => {
        socket.simpleRequestResponse('/secure/request-response',
            'DoSthUnallowed',
            {
                type: 'simple',
                username: 'user',
                password: 'passgweg'
            }
        ).subscribe(ans => {
            expect(ans).toBe("Error: 513. Message: Access Denied");
            done();
        }, err => {
            expect(err.message).toMatch(/^Error: 513.+$/);
            done();
        });
    });
    it("Fails with unallowed role", done => {
        socket.simpleRequestResponse('/secure/request-response',
            'DoSthUnallowed',
            {
                type: 'simple',
                username: 'test',
                password: 'pass'
            }
        ).subscribe(ans => {
            expect(ans).toBe("Error: 513. Message: Access Denied");
            done();
        }, err => {
            expect(err.message).toMatch(/^Error: 513.+$/);
            done();
        });
    });
    it("Send fragments", done => {
        jest.setTimeout(20000);
        const databuffer = new Uint8Array(50 * 1024);
        for (let i = 0; i < databuffer.length; i++) {
            databuffer[i] = Math.floor(Math.random() * 100);
        }
        socket.simpleRequestResponse('/basic/request-response/byte',
            databuffer,
        ).subscribe(ans => {
            for (let i = 0; i < databuffer.length; i++) {
                expect(ans[i]).toEqual(databuffer[i]);
            }
            done();
        }, err => {
            fail(err.message);
        });
    });
    // it("Accepts application/octet-stream mime type", done => {
    //     socket.simpleRequestResponse('/binary/request-response', new TextEncoder().encode("Hello World").buffer, MimeType.APPLICATION_OCTET_STREAM, MimeType.APPLICATION_OCTET_STREAM).subscribe(ans => {
    //         expect(new TextDecoder().decode(ans)).toEqual('Hello World To You Too!');
    //         done();
    //     });
    // })
    afterAll(done => {
        socket.close().subscribe({
            complete: () => {
                done();
            }
        });
    })
});

// describe("fluent_requests", () => {
//     let requester: RSocketRoutingRequester;
//     beforeAll(done => {

//         const transport = new WebsocketTransport("ws://localhost:8080/rsocket");
//         const responder = new RSocketRoutingResponder(MimeTypeRegistry.defaultRegistry());
//         const client = new RSocketClient(transport, responder, MimeTypeRegistry.defaultRegistry());
//         requester = new RSocketRoutingRequester(client);
//         client.establish({
//             dataMimeType: MimeType.APPLICATION_JSON,
//             metadataMimeType: MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA,
//             honorsLease: false,
//             keepaliveTime: 30000,
//             majorVersion: 1,
//             minorVersion: 0,
//             maxLifetime: 100000,
//         });
//         done();

//     })
//     it("Returns Request Response payload", done => {
//         requester.route('/basic/request-response').data('Hello World').simpleRequestResponse().subscribe(ans => {
//             expect(ans).toEqual("Hello World");
//             done();
//         })
//     });
//     it("Subscribes Using Request Stream", done => {
//         let counter = 0;
//         requester.route('/basic/request-stream').data(42).simpleRequestStream().subscribe(ans => {
//             expect(ans).toEqual(counter++);
//         }, err => { }, () => {
//             expect(counter).toEqual(42);
//             done();
//         });
//     });
//     it("Request FNF reaches server", done => {
//         requester.route('/basic/request-fnf').data('Must be 42').fireAndForget();

//         timer(200).pipe(concatMap(s => requester.simpleRequestResponse('/basic/request-fnf/check'))).subscribe(n => {
//             expect(n).toEqual('Must be 42');
//             done();
//         });
//     });
//     afterAll(done => {
//         requester.rsocket.close().subscribe({
//             complete: () => {
//                 done();
//             }
//         });
//     })
// });

// describe("mimetypes", () => {
//     let socket: MessageRoutingRSocket;
//     let stringReverseMime: MimeType<string>;
//     let textPlainMime: MimeType<string>;
//     beforeAll(() => {

//         const transport = new WebsocketTransport("ws://localhost:8080/rsocket");
//         const client = new RSocketClient(transport, MimeTypeRegistry.defaultRegistry());
//         stringReverseMime = new MimeType('application/stringreverse',
//             {
//                 encoder: (text: string) => new TextEncoder().encode(text.split("").reverse().join("")),
//                 decoder: (buffer) => new TextDecoder().decode(buffer).split("").reverse().join("")
//             }
//         );
//         client.mimeTypeRegistry.registerMimeType(stringReverseMime);
//         textPlainMime = new MimeType('text/plain', {
//             encoder: text => new TextEncoder().encode(text),
//             decoder: buffer => new TextDecoder().decode(buffer)
//         });
//         client.mimeTypeRegistry.registerMimeType(textPlainMime);
//         socket = new MessageRoutingRSocket(client);
//         client.establish({
//             dataMimeType: MimeType.APPLICATION_OCTET_STREAM,
//             metadataMimeType: MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA,
//             honorsLease: false,
//             keepaliveTime: 30000,
//             majorVersion: 1,
//             minorVersion: 0,
//             maxLifetime: 100000,
//         });
//     });
//     it("Correctly submits stringreverse mime type", done => {

//         socket.simpleRequestResponse('/basic/mime/stringreverse', "Hello World", stringReverseMime, stringReverseMime).subscribe(value => {
//             expect(value).toEqual("Hello World");
//             done();
//         });
//     });
//     it("Distinguishes between input and output mime type", done => {

//         socket.simpleRequestResponse('/basic/mime/stringreverse', "Hello World", stringReverseMime, textPlainMime).subscribe(value => {
//             expect(value).toEqual("Hello World");
//             done();
//         });
//     });


//     afterAll(() => {
//         socket.rsocket.close();
//     });
// });