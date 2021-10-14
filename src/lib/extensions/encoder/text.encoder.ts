import { arrayBufferToUtf8String, stringToUtf8ArrayBuffer } from "../../utlities/conversions";
import { EncodingRSocket } from "../encoding-rsocket-client";

export namespace TextCoding {


    export const Plain = {
        encoder: (data: string, rsocket: EncodingRSocket) => stringToUtf8ArrayBuffer(data),
        decoder: (buffer: Uint8Array, rsocket: EncodingRSocket) => arrayBufferToUtf8String(buffer)
    };
};