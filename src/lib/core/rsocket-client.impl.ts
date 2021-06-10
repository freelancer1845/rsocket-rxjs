import { BehaviorSubject, interval, merge, Notification, Observable, race, Subject, throwError } from "rxjs";
import { concatMap, delayWhen, dematerialize, filter, map, materialize, mergeMap, repeatWhen, skipWhile, switchMap, take, takeUntil, takeWhile, tap, timeout } from "rxjs/operators";
import { BackpressureStrategy, RSocket, RSocketResponder, RSocketState } from '../api/rsocket.api';
import { factory } from "./config-log4j";
import { RSocketConfig } from "./config/rsocket-config";
import { FragmentContext } from './protocol/fragments';
import { ErrorCode, Frame, FrameType } from "./protocol/frame";
import { FrameBuilder } from "./protocol/frame-factory";
import { Payload } from "./protocol/payload";
import { Transport } from "./transport/transport.api";

const protocolLog = factory.getLogger('protocol.RSocketClient');
const log = factory.getLogger('.RSocketClient');

export class RSocketClient implements RSocket<Payload, Payload> {

    private _state: BehaviorSubject<RSocketState> = new BehaviorSubject<RSocketState>(RSocketState.Disconnected);
    private _incoming: Subject<Frame> = new Subject();

    private streamIdsHolder: number[] = [];
    private streamIdCounter = 0;



    private $destroy = new Subject();
    private _closedByUser = false;
    constructor(
        private readonly transport: Transport,
        public readonly responder: RSocketResponder,
        private _config: RSocketConfig
    ) {
        this.incomingHandlerSetup();
    }

    setSetupConfig(config: RSocketConfig) {
        this._config = config;
    }

    getSetupConfig(): RSocketConfig {
        return this._config;
    }
    state(): Observable<RSocketState> {
        return this._state;
    }


    public establish(): void {
        this.transport.incoming().pipe(
            takeUntil(this.$destroy)
        ).subscribe({
            next: n => this._incoming.next(n),
            error: err => {
                protocolLog.debug("Websocket signaled error: " + JSON.stringify(err));
                this._state.next(RSocketState.Error);
                this._state.next(RSocketState.Disconnected);
            },
            complete: () => {
                protocolLog.debug("Websocket completed");
                if (this._closedByUser == false) {
                    this._state.next(RSocketState.Error);
                }
                this._state.next(RSocketState.Disconnected);
            }
        });
        const setupFrame = FrameBuilder.setup().buildFromConfig(this._config);
        if (this._config.honorsLease == false) {
            protocolLog.debug('Sending Setup frame without honoring lease...');
            this.transport.send(setupFrame);
            this._state.next(RSocketState.Connected);
        }
        this.setupKeepaliveSupport();
    }

    public close(): Observable<void> {
        this._closedByUser = true;
        this.$destroy.next(true);
        return this.transport.close();
    }


    private incomingHandlerSetup() {
        this._incoming.pipe(
            filter(f => f.type() == FrameType.REQUEST_RESPONSE),
            mergeMap(f => this.incomingRequestResponse(f)),
            takeUntil(this.$destroy)
        ).subscribe(frame => this.transport.send(frame));
        this._incoming.pipe(
            filter(f => f.type() == FrameType.REQUEST_STREAM),
            mergeMap(f => this.incomingRequestStream(f)),
            takeUntil(this.$destroy)
        ).subscribe(frame => this.transport.send(frame));
        this._incoming.pipe(
            filter(f => f.type() == FrameType.REQUEST_FNF),
            takeUntil(this.$destroy)
        ).subscribe(f => this.incomingRequestFNF(f));
    }


    public requestResponse(payload: Payload): Observable<Payload> {
        const obs = new Observable<Payload>(emitter => {
            protocolLog.debug("Executing Request Response");
            const streamId = this.getNewStreamId();
            const fragmentsContext = new FragmentContext();
            const subscription = this._incoming.pipe(
                filter(f => f.streamId() == streamId),
            ).subscribe(f => {
                if (f.type() == FrameType.PAYLOAD) {
                    if (f.isNext()) {
                        fragmentsContext.add(f.payload());
                        if (f.fragmentFollows() == false) {
                            emitter.next(fragmentsContext.get());
                        }
                    }
                    if (f.isStreamComplete()) {
                        subscription.unsubscribe();
                        emitter.complete();
                    }
                } else if (f.type() == FrameType.ERROR) {
                    let message = "No Error message given.";
                    let messagePayload = f.payload();
                    if (messagePayload != undefined) {
                        if (messagePayload.data.byteLength > 0) {
                            message = String.fromCharCode.apply(null, new Uint8Array(messagePayload.data) as unknown as number[]);
                        }
                    }

                    subscription.unsubscribe();
                    emitter.error(new Error(`Error: ${f.errorCode()}. Message: ${message}`))
                } else {
                    subscription.unsubscribe();
                    emitter.error(new Error('Unexpected frame type in request response interaction: ' + f.type()));
                }

            }, error => {
                emitter.error(new Error('Unexpected error form transport. ' + error.message));
                subscription.unsubscribe();
            }, () => {
                emitter.complete();
                subscription.unsubscribe();
            });

            this.transport.send(FrameBuilder.requestResponse().streamId(streamId).payload(payload).build());
            return () => {
                if (subscription.closed == false) {
                    subscription.unsubscribe();
                    this.transport.send(FrameBuilder.cancel().streamId(streamId).build());
                }
            }
        });

        return this._state.pipe(
            filter(s => s == RSocketState.Connected),
            take(1),
            switchMap(s => race(obs, this.connectionFailedObservable())));
    }

    public requestStream(payload: Payload, requester?: Observable<number>): Observable<Payload> {
        const obs = new Observable<Payload>(emitter => {
            protocolLog.debug("Executing Request Stream");
            const streamId = this.getNewStreamId();
            const fragmentsContext = new FragmentContext();
            const $requestDestroy = new Subject<number>();
            const subscription = this._incoming.pipe(
                takeUntil($requestDestroy),
                filter(f => f.streamId() == streamId),

            ).subscribe(f => {
                if (f.type() == FrameType.PAYLOAD) {
                    if (f.isNext()) {
                        fragmentsContext.add(f.payload());
                        if (f.fragmentFollows() == false) {
                            emitter.next(fragmentsContext.get());
                        }
                    }
                    if (f.isStreamComplete()) {
                        subscription.unsubscribe();
                        emitter.complete();
                    }
                } else if (f.type() == FrameType.ERROR) {
                    let message = "No Error message given.";
                    let messagePayload = f.payload();
                    if (messagePayload != undefined) {
                        if (messagePayload.data.byteLength > 0) {
                            message = String.fromCharCode.apply(null, new Uint8Array(messagePayload.data) as unknown as number[]);
                        }
                    }
                    $requestDestroy.next(0);
                    emitter.error(new Error(`Error: ${f.errorCode()}. Message: ${message}`))
                } else {
                    $requestDestroy.next(0);
                    emitter.error(new Error('Unexpected frame type in request response interaction: ' + f.type()));
                }

            }, error => {
                $requestDestroy.next(0);
                emitter.error(new Error('Unexpected error form transport. ' + error.message));
            }, () => {
                $requestDestroy.next(0);
                emitter.complete();
            });
            if (requester === undefined) {
                this.transport.send(FrameBuilder.requestStream().streamId(streamId).payload(payload).requests(2 ** 31 - 1).build());
            } else {
                let initialRequest = true;
                requester.pipe(takeUntil($requestDestroy)).subscribe(requests => {
                    if (initialRequest == true) {
                        initialRequest = false;
                        this.transport.send(FrameBuilder.requestStream().streamId(streamId).payload(payload).requests(requests).build());
                    } else {
                        this.transport.send(FrameBuilder.requestN().streamId(streamId).requests(requests).build());
                    }
                });
            }
            return () => {
                $requestDestroy.next(0);
                this.transport.send(FrameBuilder.cancel().streamId(streamId).build());
            }
        });

        return this._state.pipe(
            filter(s => s == RSocketState.Connected),
            take(1),
            mergeMap(s => merge(obs.pipe(materialize()), this.connectionFailedObservable().pipe(materialize()))),
            takeWhile(notification => notification.hasValue),
            dematerialize()
        );
    }

    public requestFNF(payload: Payload): void {

        this._state.pipe(filter(s => s == RSocketState.Connected), take(1)).subscribe(s => {
            protocolLog.debug("Executing Request FNF");
            const streamId = this.getNewStreamId();
            this.transport.send(FrameBuilder.requestFNF().streamId(streamId).payload(payload).build());
        });
    }


    private incomingRequestResponse(f: Frame): Observable<Frame> {
        protocolLog.debug('Handling incoming Request Response request');
        return this.responder.handleRequestResponse(f.payload()).pipe(
            takeUntil(this._incoming.pipe(
                filter(incFrame => incFrame.streamId() == f.streamId()), // Further checks are not required as the requester may not send other frames but cancel
                tap(n => protocolLog.debug("Request Response has been canceled by requester. StreamdId: " + n.streamId()))
            )),
            materialize(),
            map(p => {
                switch (p.kind) {
                    case "N":
                        return Notification.createNext(FrameBuilder.payload().streamId(f.streamId()).payload(p.value).flagComplete().flagNext().build());
                    case "E":
                        return Notification.createNext(FrameBuilder.error().errorCode(ErrorCode.APPLICATION_ERROR).message(p.error.message).streamId(f.streamId()).build());
                    case "C":
                        return Notification.createComplete();
                }
            }),
            dematerialize()
        );
    }

    private incomingRequestStream(f: Frame): Observable<Frame> {
        protocolLog.debug('Handling incoming Request Stream request');
        const handler = this.responder.handleRequestStream(f.payload());
        let requests = f.initialRequests();
        let pending = [];
        const backpressureHonorer = new Observable(emitter => {
            if (requests > 0) {
                emitter.next(requests);
            } else {
                pending.push(emitter);
            }
        });
        const signalComplete = new Subject<number>();
        const streamCanceler = this._incoming.pipe(
            takeUntil(signalComplete),
            filter(incFrame => incFrame.streamId() == f.streamId()),
            filter(incFrame => incFrame.type() == FrameType.CANCEL),
            tap(n => protocolLog.debug("Request Response has been canceled by requester. StreamdId: " + n.streamId())));

        this._incoming.pipe(
            takeUntil(streamCanceler),
            filter(incFrame => incFrame.streamId() == f.streamId()),
            filter(incFrame => incFrame.type() == FrameType.REQUEST_N),
            map(incFrame => incFrame.requests())
        ).subscribe(n => {
            while (n > 0) {
                const req = pending.shift();
                if (req == null) {
                    break;
                }
                req.next(0);
                n--;
            }
            requests = n;
        });
        let backpressureHandler;
        if (handler.backpressureStrategy == BackpressureStrategy.BufferDelay) {
            backpressureHandler = delayWhen((v, id) => backpressureHonorer);
        } else if (handler.backpressureStrategy == BackpressureStrategy.Drop) {
            backpressureHandler = skipWhile(p => requests == 0);
        } else {
            backpressureHandler = map(a => a);
        }

        return handler.stream.pipe(
            backpressureHandler,
            takeUntil(streamCanceler),
            materialize(),
            map(p => {
                switch (p.kind) {
                    case "N":
                        requests--;
                        return Notification.createNext(FrameBuilder.payload().streamId(f.streamId()).payload(p.value as Payload).flagNext().build())
                    case "E":
                        signalComplete.next(0);
                        this.transport.send(FrameBuilder.error().errorCode(ErrorCode.APPLICATION_ERROR).message(p.error.message).streamId(f.streamId()).build());
                        return Notification.createComplete();
                    case "C":
                        signalComplete.next(0);
                        this.transport.send(FrameBuilder.payload().streamId(f.streamId()).flagComplete().build());
                        return Notification.createComplete();
                }
            }),
            dematerialize()
        );
    }
    private incomingRequestFNF(f: Frame): void {
        protocolLog.debug("Handling incoming FNF request");
        this.responder.handleFNF(f.payload());
    }


    private getNewStreamId(): number {
        const i = this.streamIdCounter;
        this.streamIdCounter++;
        const id = i * 2 + 1;
        this.streamIdsHolder.push(id);
        return id;
    }

    private connectionFailedObservable(): Observable<never> {
        return this._state.pipe(filter(s => s != RSocketState.Connected), concatMap(s => throwError(() => new Error("RSocket connection closed"))));
    }

    private setupKeepaliveSupport(): void {
        new Observable(emitter => {
            const data = new Uint8Array(20);
            for (let i = 0; i < 20; i++) {
                data[i] = Math.floor(Math.random() * 100);
            }
            const sub = this._incoming.pipe(filter(p => p.type() == FrameType.KEEPALIVE && p.respondWithKeepalive() == false), filter(p => {
                const returnData = new Uint8Array(p.payload().data);
                if (returnData.length != data.length) {
                    protocolLog.warn("Keepalive answer length did not match");
                    return false;
                } else {
                    for (let i = 0; i < 20; i++) {
                        if (data[i] != returnData[i]) {
                            protocolLog.warn("Keepalive answer length data did not match");
                            return false;
                        }
                    }
                    protocolLog.debug("Keepalive answer received");
                    return true;
                }
            }), take(1), timeout(this._config.maxLifetime)).subscribe({
                next: n => {
                    emitter.complete();
                },
                error: error => emitter.error(error),
            });
            const keepaliveFrame = FrameBuilder.keepalive().flagRespond().lastReceivedPosition(this.transport.recvPosition()).data(data).build();
            this.transport.send(keepaliveFrame);
            return () => sub.unsubscribe()
        }).pipe(takeUntil(this.$destroy), repeatWhen(() => interval(this._config.keepaliveTime))).subscribe();

        this._incoming.pipe(takeUntil(this.$destroy), filter(p => p.type() == FrameType.KEEPALIVE && p.respondWithKeepalive() == true)).subscribe(p => {
            const keepaliveAnswer = FrameBuilder.keepalive().lastReceivedPosition(this.transport.recvPosition()).data(p.payload().data).build();
            this.transport.send(keepaliveAnswer);
        });
    }

}