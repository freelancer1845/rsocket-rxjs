import { CompositeMetadata } from "./composite-metadata";




describe('CompositeMetadata', () => {


    it('Can be iterated by "of"', () => {

        let data = new CompositeMetadata();
        for (let i = 0; i < 100; i++) {
            data.push({ mimeType: 'test', data: i });
        }
        let idx = 0;
        for (let m of data) {
            expect(m.mimeType).toEqual('test');
            expect(m.data).toEqual(idx++);
        }
    });

});
