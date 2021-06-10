import { Authentication } from "./security/authentication";
import { WellKnownMimeTypes } from "./well-known-mime-types";

export interface DecodedMetadata {
    mimeType: string;
    data: any;
}


export class CompositeMetadata implements Iterable<DecodedMetadata>{

    private readonly _array: DecodedMetadata[] = [];

    get length(): number { return this._array.length; }

    public push(data: DecodedMetadata): void {
        this._array.push(data);
    }

    public get(index: number): DecodedMetadata | undefined {
        return this._array[index];
    }

    public remove(index: number): DecodedMetadata | undefined {
        const removed = this._array.splice(index, 1);
        return removed.length > 0 ? removed[0] : undefined;
    }

    public pop(): DecodedMetadata | undefined {
        return this._array.pop();
    }


    [Symbol.iterator](): Iterator<DecodedMetadata, any, undefined> {
        let idx = 0;
        return {
            next: () => {
                if (idx < this.length) {
                    return { value: this.get(idx++), done: false };
                } else {
                    return { value: undefined, done: true };
                }
            }
        }
    }

    public get route(): string | undefined {
        return this._array.find(v => v.mimeType == WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name)?.data as string;
    }

    public set route(value: string | undefined) {
        if (value != undefined) {
            this._array.push({
                mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name,
                data: value
            });
        } else {
            let routeIdx = this._array.findIndex(v => v.mimeType !== WellKnownMimeTypes.MESSAGE_X_RSOCKET_ROUTING_V0.name);
            if (routeIdx != -1) {
                this._array.splice(routeIdx, 1);
            }
        }
    }

    public get authentication(): Authentication | undefined {
        return this._array.find(v => v.mimeType === WellKnownMimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION_V0.name)?.data as Authentication;
    }

    public set authentication(auth: Authentication | undefined) {
        if (auth != undefined) {
            this._array.push({
                mimeType: WellKnownMimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION_V0.name,
                data: auth
            });
        } else {
            let authIdx = this._array.findIndex(v => v.mimeType !== WellKnownMimeTypes.MESSAGE_X_RSOCKET_AUTHENTICATION_V0.name);
            if (authIdx != -1) {
                this._array.splice(authIdx, 1);
            }
        }
    }

    public getByMimeType<T = any>(mimeType: string): T | undefined {
        return this._array.find(v => v.mimeType === mimeType).data as T;
    }

}

