import { arrayBufferToUtf8String, stringToAsciiArrayBuffer, stringToUtf8ArrayBuffer } from "../../utlities/conversions";
import { CompositeMetadata, DecodedMetadata } from "../composite-metadata";
import { EncodingRSocket } from "../encoding-rsocket-client";
import { Authentication } from "../security/authentication";
import { WellKnownMimeTypes } from "../well-known-mime-types";



export function decodeCompositeMetadata(buffer: Uint8Array, encodingSocket: EncodingRSocket): CompositeMetadata {
    const view = new DataView(buffer.buffer, buffer.byteOffset);
    let idx = 0;
    const metadata = new CompositeMetadata();
    while (idx < buffer.byteLength) {
        const idOrLength = view.getUint8(idx++);
        let type: string = undefined;
        if ((idOrLength >> 7 & 1) == 1) {
            const id = idOrLength & 0x7F;
            type = WellKnownMimeTypes.getByIdentifer(id)?.name;
            if (type == null) {
                throw new Error('Trying to resolve WellKnownMimeType that is not implemented yet. Id: ' + id.toString(16));
            }
        } else {
            const nameLength = idOrLength & 0x7F;
            const name = arrayBufferToUtf8String(buffer.slice(idx, idx + nameLength));
            idx += nameLength;
            type = name;
        }
        const payloadLength = view.getUint32(idx - 1) & 0xFFFFFF;
        idx += 3;
        metadata.push({
            mimeType: type,
            data: encodingSocket.tryDecodeObject(buffer.slice(idx, idx + payloadLength), type)
        });
        idx += payloadLength;
    }
    return metadata;
}


interface CompositeMetadataPart {
    idOrLength: number;
    metadataString?: Uint8Array;
    data: Uint8Array;
}

export function encodeCompositionMetadata(data: CompositeMetadata, encodingSocket: EncodingRSocket) {
    const metadataParts: CompositeMetadataPart[] = [];

    for (let metaData of data) {
        if (WellKnownMimeTypes.isWellKnown(metaData.mimeType)) {
            let mimeType = WellKnownMimeTypes.getByName(metaData.mimeType);
            metadataParts.push({
                idOrLength: ((1 << 7) | mimeType.identifier) & 0xFF,
                data: encodingSocket.tryEncodeObject(metaData.data, mimeType.name)
            });
        } else {
            const metadataString = stringToAsciiArrayBuffer(metaData.mimeType);
            metadataParts.push({
                idOrLength: metadataString.byteLength & 0x7F,
                metadataString: metadataString,
                data: encodingSocket.tryEncodeObject(metaData.data, metaData.mimeType)
            });
        }
    }
    let requiredBufferSize = 0;
    for (let part of metadataParts) {
        if (part.metadataString == undefined) {
            requiredBufferSize += 1 + part.data.byteLength + 3;
        } else {
            requiredBufferSize += 1 + part.metadataString.byteLength + part.data.byteLength + 3;
        }
    }
    const uint8View = new Uint8Array(requiredBufferSize);
    const view = new DataView(uint8View.buffer);
    let idx = 0;
    for (let part of metadataParts) {
        if (part.metadataString == undefined) {
            view.setUint8(idx++, part.idOrLength);
        } else {
            view.setUint8(idx++, part.idOrLength);
            uint8View.set(new Uint8Array(part.metadataString), idx);
            idx += part.metadataString.byteLength;
        }
        view.setUint8(idx++, part.data.byteLength >> 16);
        view.setUint8(idx++, part.data.byteLength >> 8);
        view.setUint8(idx++, part.data.byteLength);
        uint8View.set(new Uint8Array(part.data), idx);
        idx += part.data.byteLength;
    }

    return uint8View;
}

export function decodeAuthentication(buffer: Uint8Array, encodingSocket: EncodingRSocket): Authentication {
    const view = new DataView(buffer.buffer, buffer.byteOffset);
    let idx = 0;
    const authIdOrLength = view.getUint8(idx++);
    let authentication: Authentication;
    if ((authIdOrLength >> 7 & 1) == 1) {
        if ((authIdOrLength & 0x7F) == 0x00) {
            authentication = { type: 'simple' };
        } else if ((authIdOrLength & 0x7F) == 0x01) {
            authentication = { type: 'bearer' };
        } else {
            throw new Error('Auth type not implemented');
        }
    } else {
        authentication = { type: 'unknown' };
        const customType = arrayBufferToUtf8String(buffer.slice(idx, authIdOrLength & 0x7F + idx));
        idx += (authIdOrLength & 0x7F);
        authentication.typeString = customType;
    }
    if (authentication.type == "unknown") {
        authentication.customData = buffer.slice(idx);
    } else if (authentication.type == "bearer") {
        authentication.token = arrayBufferToUtf8String(buffer.slice(idx));
    } else if (authentication.type == "simple") {
        const usernameLength = view.getUint16(idx);
        idx += 2;
        authentication.username = arrayBufferToUtf8String(buffer.slice(idx, idx + usernameLength));
        idx += usernameLength;
        authentication.password = arrayBufferToUtf8String(buffer.slice(idx));
    }
    return authentication;
}

export function encodeAuthentication(authentication: Authentication, encodingSocket: EncodingRSocket): Uint8Array {
    let usernameBuffer: Uint8Array;
    let passwordBuffer: Uint8Array;
    let tokenBuffer: Uint8Array;
    let typeBuffer: Uint8Array;
    let length = 0;
    if (authentication.type == "simple") {
        length++;
        usernameBuffer = stringToUtf8ArrayBuffer(authentication.username);
        passwordBuffer = stringToUtf8ArrayBuffer(authentication.password);
        length += 2;
        length += usernameBuffer.byteLength;
        length += passwordBuffer.byteLength;
    } else if (authentication.type == "bearer") {
        length++;
        tokenBuffer = stringToUtf8ArrayBuffer(authentication.token);
        length += tokenBuffer.byteLength;
    } else if (authentication.type == "unknown") {
        length++;
        typeBuffer = stringToUtf8ArrayBuffer(authentication.typeString);
        length += typeBuffer.byteLength;
        length += authentication.customData.byteLength;
    }

    const uint8View = new Uint8Array(length);
    const view = new DataView(uint8View.buffer);
    let idx = 0;
    if (authentication.type == "simple") {
        view.setUint8(idx++, (1 << 7) | 0x00);
        view.setUint16(idx, usernameBuffer.byteLength);
        idx += 2;
        uint8View.set(new Uint8Array(usernameBuffer), idx);
        idx += usernameBuffer.byteLength;
        uint8View.set(new Uint8Array(passwordBuffer), idx);
    } else if (authentication.type == "bearer") {
        view.setUint8(idx++, (1 << 7) | 0x01);
        uint8View.set(new Uint8Array(tokenBuffer), idx);
    } else if (authentication.type == "unknown") {
        view.setUint8(idx++, typeBuffer.byteLength & 0x7F);
        uint8View.set(new Uint8Array(typeBuffer), idx);
        idx += typeBuffer.byteLength;
        uint8View.set(new Uint8Array(authentication.customData), idx);
    }
    return uint8View;
}

export function decodeMessageRoute(data: Uint8Array): string {
    const routeLength = data[0];
    return arrayBufferToUtf8String(data.slice(1, 1 + routeLength));
}

export function encodeMessageRoute(route: string): Uint8Array {
    return stringToUtf8ArrayBuffer(String.fromCharCode(route.length) + route);
}


export function encodeJson(obj: any, encodingSocket: EncodingRSocket) {
    if (obj == undefined) {
        return new Uint8Array(0);
    } else {
        return stringToUtf8ArrayBuffer(JSON.stringify(obj));
    }
}

export function decodeJson(buffer: Uint8Array, encodingSocket: EncodingRSocket) {
    if (buffer.length == 0) {
        return undefined;
    } else {
        return JSON.parse(arrayBufferToUtf8String(buffer));
    }
}



export function encodeMessageMimeType(mimeType: string, encodingSocket: EncodingRSocket) {
    if (WellKnownMimeTypes.isWellKnown(mimeType)) {
        let buf = new Uint8Array(1);
        buf[0] = WellKnownMimeTypes.getByName(mimeType).identifier | (1 << 7);
        return buf;
    } else {
        let mimeTypeBuffer = stringToAsciiArrayBuffer(mimeType);
        let buf = new Uint8Array(mimeTypeBuffer.length + 1);
        buf[0] = mimeTypeBuffer.length;
        buf.set(mimeTypeBuffer, 1);
        return buf;
    }
}

export function decodeMessageMimeType(buffer: Uint8Array, encodingSocket: EncodingRSocket): string {
    const mimeIdOrLength = buffer[0];
    if ((mimeIdOrLength >> 7 & 0x1) == 1) {
        const wellKnownId = mimeIdOrLength & 0x7F;
        return WellKnownMimeTypes.getByIdentifer(wellKnownId).name;
    } else {
        const mimeTypeName = arrayBufferToUtf8String(buffer.slice(1, 1 + mimeIdOrLength));
        return WellKnownMimeTypes.getByName(mimeTypeName).name;
    }
}


export function encodeMessageAcceptMimeTypes(objs: string[], encodingSocket: EncodingRSocket) {
    let buffers: Uint8Array[] = [];
    for (let obj of objs) {
        if (WellKnownMimeTypes.isWellKnown(obj)) {
            let buf = new Uint8Array(1);
            buf[0] = WellKnownMimeTypes.getByName(obj).identifier | (1 << 7);
            buffers.push(buf);
        } else {
            let mimeTypeBuffer = stringToAsciiArrayBuffer(obj);
            let buf = new Uint8Array(mimeTypeBuffer.length + 1);
            buf[0] = mimeTypeBuffer.length;
            buf.set(mimeTypeBuffer, 1);
            buffers.push(buf);
        }
    }
    let finalSize = buffers.reduce((acc, next) => acc + next.length, 0);
    let buffer = new Uint8Array(finalSize);
    let idx = 0;
    for (let buf of buffers) {
        buffer.set(buf, idx);
        idx += buf.length;
    }
    return buffer;
}

export function decodeMessageAcceptMimeTypes(buffer: Uint8Array, encodingSocket: EncodingRSocket) {
    let idx = 0;
    let types: string[] = [];
    while (idx < buffer.length) {
        const mimeIdOrLength = buffer[0];
        if ((mimeIdOrLength >> 7 & 0x1) == 1) {
            idx += 1;
            const wellKnownId = mimeIdOrLength & 0x7F;
            types.push(WellKnownMimeTypes.getByIdentifer(wellKnownId).name);
        } else {
            idx += 1 + mimeIdOrLength;
            const mimeTypeName = arrayBufferToUtf8String(buffer.slice(1, 1 + mimeIdOrLength));
            types.push(mimeTypeName);
        }

    }
    return types;
}


