# RSocket-RxJs

Basic library implementing RSockets RC 1 (Version 1.0).

## What this is:

### This library provides a basic RSocket client implementing the following features:

* Request FNF - Both directions
* Request Response - Both directions
* Request Stream - Both direction + Backpressure support
* Websocket Transport
* RSocket Security (Only tested 'simple') (tested with spring-boot 2.5.0)

### Additional features

* MimeTypes:
  * application/json using JSON.stringify/parse
  * application/octet-stream giving and using UInt8Arrays
  * 'MESSAGE_X_COMPOSITE_METADATA' to  work with spring-boot rsocket MessageMapping etc.
  * 'message/x.rsocket.mime-type.v0' to work with spring-boot mime type encoders
* Automatic reconnect when using RSocketBuilder


## What this isn't:

* A full implementation of the RSocket Spec. Missing:
  * Lease Handling
  * Server Setup
  * Resume Support
  * Request Channel
  * Metadata Push
  * Most MimeTypes
* The library is also not deeply tested, but works well for my projects (which is always a Spring Boot - Angular Stack)

## How to use as simple Message Routing RSocket without the RSocketFactory

```typescript
const mimeTypeRegistry = MimeTypeRegistry.defaultRegistry();
const transport = new WebsocketTransport("ws://localhost:8080/rsocket"); // This is currently the only supported transport
const responder = new RSocketRoutingResponder(mimeTypeRegistry); // this is a routing responder using MESSAGE_X_RSOCKET_COMPOSITE_METADATA. You can register your routes with this responder
const client = new RSocketClient(transport, responder, mimeTypeRegistry); // The client that handles the socket/transport
const requester = new RSocketRoutingRequester(client); // A requester that wraps the client and allows for routed requests

// Add handler for route "request"
responder.addRequestResponseHandler('test', ans => {
    console.log('Received a request on route "test"');
    return ans + ans;
})

// Establish connection
client.establish({
    data: 'Test-Client',
    dataMimeType: MimeType.APPLICATION_JSON,
    metadataMimeType: MimeType.MESSAGE_X_RSOCKET_COMPOSITE_METADATA,
    metaData: [
        {
            type: MimeType.MESSAGE_X_RSOCKET_ROUTING,
            data: 'connect-client'
        }
    ],
    honorsLease: false,
    keepaliveTime: 30000,
    majorVersion: 1,
    minorVersion: 0,
    maxLifetime: 100000,
});

// Execute Request
requester.requestResponse('test', { request: 'Hello', data: 'World' }, MimeType.APPLICATION_JSON, MimeType.APPLICATION_JSON)
    .subscribe({ next: ans => console.log(ans) });

```
