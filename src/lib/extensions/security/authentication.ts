

export type AuthType = 'simple' | 'bearer' | 'unknown';

export interface Authentication {
    type: AuthType;
    typeString?: string;
    token?: string;
    username?: string;
    password?: string;
    customData?: Uint8Array;
}
