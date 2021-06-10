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

## How to use with SpringBoot RSocket Messaging and SpringRSocketMessagingBuilder

* See **example-tests/spring-boot-messaging.spec.ts**
* To run the tests the **spring-test** application needs to be running (mvn spring-boot:run)
