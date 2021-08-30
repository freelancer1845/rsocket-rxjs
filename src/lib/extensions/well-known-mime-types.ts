import { decodeCompositeMetadata, encodeCompositionMetadata } from "./encoder/message-x-rsocket";
import { RSocketDecoder, RSocketEncoder } from "./encoding-rsocket-client";



interface WellKnownMimeType {
    name: string;
    identifier: number;
}

export class WellKnownMimeTypes {

    public static MESSAGE_X_RSOCKET_COMPOSITE_METADATA_V0: WellKnownMimeType = {
        name: 'message/x.rsocket.composite-metadata.v0',
        identifier: 0x7F,
    };

    public static MESSAGE_X_RSOCKET_ROUTING_V0: WellKnownMimeType = {
        name: 'message/x.rsocket.routing.v0',
        identifier: 0x7E
    }

    public static MESSAGE_X_RSOCKET_AUTHENTICATION_V0: WellKnownMimeType = {
        name: 'message/x.rsocket.authentication.v0',
        identifier: 0x7C
    }

    public static MESSAGE_X_RSOCKET_MIME_TYPE_V0: WellKnownMimeType = {
        name: 'message/x.rsocket.mime-type.v0',
        identifier: 0x7A
    }

    public static MESSAGE_X_RSOCKET_ACCEPT_MIME_TYPES_V0: WellKnownMimeType = {
        name: 'message/x.rsocket.accept-mime-types.v0',
        identifier: 0x7B
    }

    public static APPLICATION_JSON: WellKnownMimeType = {
        name: 'application/json',
        identifier: 0x05
    }

    public static APPLICATION_OCTET_STREAM: WellKnownMimeType = {
        name: 'application/octet-stream',
        identifier: 0x06
    }

    public static APPLICATION_VND_GOOGLE_PROTOBUF: WellKnownMimeType = {
        name: 'application/vnd.google.protobuf',
        identifier: 0x09
    }

    private static initialized = false;
    private static _identifierMap = new Map<number, WellKnownMimeType>();
    private static _nameMap = new Map<string, WellKnownMimeType>();


    public static getByIdentifer(identifier: number): WellKnownMimeType {
        if (WellKnownMimeTypes.initialized == false) {
            this._initialize();
        }
        return this._identifierMap.get(identifier);
    }

    public static getByName(name: string): WellKnownMimeType {
        if (WellKnownMimeTypes.initialized == false) {
            this._initialize();
        }
        return this._nameMap.get(name);
    }

    public static isWellKnown(idOrName: number | string) {
        if (WellKnownMimeTypes.initialized == false) {
            this._initialize();
        }
        if (typeof (idOrName) == 'number') {
            return this._identifierMap.has(idOrName);
        } else if (typeof (idOrName) == 'string') {
            return this._nameMap.has(idOrName);
        } else {
            throw new Error('IdOrName must either be a number or a string');
        }
    }

    private static _initialize() {

        for (let key of Object.keys(WellKnownMimeTypes)) {
            if (WellKnownMimeTypes[key].name != undefined) {
                let type = WellKnownMimeTypes[key];
                WellKnownMimeTypes._identifierMap.set(type.identifier, type);
                WellKnownMimeTypes._nameMap.set(type.name, type);
            }
        }
        WellKnownMimeTypes.initialized = true;
    }

}