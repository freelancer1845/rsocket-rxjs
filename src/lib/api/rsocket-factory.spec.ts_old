import { range, timer } from "rxjs";
import { flatMap, reduce } from 'rxjs/operators';
import { RSocketBuilder } from './rsocket-factory';



const WebSocket = require('ws')
global.WebSocket = WebSocket

describe("RSocketBuilder", () => {

    it("Should create an rsocket connection", done => {
        new RSocketBuilder().connectionString('ws://localhost:8080/rsocket').messageRSocket().pipe(flatMap(socket => {
            return socket.requestResponse('/basic/request-response', 'Hello World');
        })).subscribe(ans => {
            expect(ans).toEqual("Hello World");
            done();
        });
    });
    it("Should automatically reconnect", done => {
        let counter = 0;
        new RSocketBuilder().connectionString('ws://localhost:8080/rsocket').automaticReconnect(500).messageRSocket().subscribe(socket => {
            counter++;
            if (counter == 1) {
                socket.requestFNF('/basic/disconnect');
            } else {
                socket.requestResponse('/basic/request-response', 'Hello World').subscribe(ans => {
                    expect(ans).toEqual("Hello World");
                    done();
                });
            }
        });
    })
});