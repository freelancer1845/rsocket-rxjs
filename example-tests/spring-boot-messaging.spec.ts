import { SpringRSocketMessagingBuilder } from '../src/index';
import { CompositeMetadata } from '../src/lib/extensions/composite-metadata';
import { DecodedPayload } from '../src/lib/extensions/encoding-rsocket-client';
import { WellKnownMimeTypes } from '../src/lib/extensions/well-known-mime-types';


const WebSocket = require('ws')
global.WebSocket = WebSocket


describe('SpringBootMessaging Examples', () => {


    it("Shows basic simple interaction patterns", done => {


        // Build the Socket using the builder

        new SpringRSocketMessagingBuilder()
            .connectionString("ws://localhost:8080/rsocket")    // Websocket connection (only supported)
            .dataMimeType(WellKnownMimeTypes.APPLICATION_JSON.name) // Data mimetype
            .connectMappingData("Hello I'm a new client")   // Payload for @ConnectMapping annotation
            .connectMappingRoute("register-client") // Route for @ConnectMapping annotation
            .keepaliveTime(1000) // Reduce standard keepalive time
            .maxLifetime(5000) // Reduce standard maxLifetime
            .build().subscribe(socket => {

                socket.state().subscribe({ next: state => console.log("New RSocket State: ", state) }); // Log RSocket state

                // A simple Request Response interaction client -> server
                socket.simpleRequestResponse('/basic/request-response', 'Hello').subscribe(
                    ans => {
                        expect(ans).toBe('Hello');
                        console.log("Hello back from request-respones");
                    }
                );

                interface SimpleTestObject {
                    name: string;
                    nested?: SimpleTestObject;
                    age: number;
                    greatness: number;
                }
                // You can also type your response beforehand
                socket.simpleRequestResponse<SimpleTestObject, SimpleTestObject>('/basic/request-response', {
                    name: 'Me',
                    age: 28,
                    greatness: 0.1,
                }).subscribe(
                    ans => {
                        console.log("Object Request Response: " + ans);
                        expect(ans.age).toEqual(28);
                    }
                )

                // A RequestResponse interaction which allows to specify extra metadata (not sure if this is supported by spring)
                const metadata = new CompositeMetadata();
                metadata.push({
                    mimeType: WellKnownMimeTypes.APPLICATION_JSON.name,
                    data: { special: 'Some special metadata' }
                })
                socket.requestResponse({
                    route: '/basic/request-response',
                    data: 'Hello',
                    metadata: metadata,
                }).subscribe(response => {
                    // data and metadata is now available in a single payload
                    const responseMetadata = response.metadata as CompositeMetadata;
                    const responseData = response.data as string;
                    console.log(responseMetadata);
                    console.log(responseData);
                });

                // A Simple RequestStream. The MessageMapping returns a stream counting from 0-9 (10 elements)

                socket.simpleRequestStream<number, number>(
                    '/basic/request-stream',
                    10
                ).subscribe(a => {
                    console.log("Stream Request Returned: ", a);
                })


                // Simple request Response handler (automatically encodes/decodes using the specified dataMimetype from the builder)
                socket.addRequestResponseHandler<string, string>(
                    'my.test.route',
                    (data, metadata) => {

                        console.log("My Request Response handler was called! Data: ", data);
                        return data;
                    }
                )
                // Make spring boot call your response handler
                socket.simpleRequestFNF(
                    '/basic/fnf-reverse-request-response',
                    {
                        topic: 'my.test.route',
                        data: 'My Test Route was called'
                    }
                )


                // This is the more complex case where you also want to return metadata
                // If you only specify the first type parameter you are allowed to choose as payloadType: 'decodedPayload'
                // You can now return data and metadata on your response
                socket.addRequestResponseHandler<string>(
                    'my.complex.test.route',
                    (data, metadata) => {
                        return {
                            data: data,
                            metadata: metadata
                        }
                    },
                    {
                        payloadType: 'decodedPayload'
                    }
                )

                setTimeout(() => done(), 1000); // Give everything a second to execute
            });





    });



});