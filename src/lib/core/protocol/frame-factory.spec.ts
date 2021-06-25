import { FrameBuilder } from './frame-factory';
import { Payload } from './payload';

describe('Frame builder', () => {
    it('should build frame with desired number of requests', () => {
        const fakeBuffer = new ArrayBuffer(512);
        const fakeArray = new Uint8Array(fakeBuffer, 0);
        const fakePayload = new Payload(
            fakeArray
        );
        const frame = FrameBuilder.requestStream()
            .streamId(0)
            .payload(fakePayload)
            .requests(20)
            .build();

        expect(frame.requests()).toBe(20);
    });
});