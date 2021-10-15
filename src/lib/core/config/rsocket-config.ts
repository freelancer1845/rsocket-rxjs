import { Payload } from "../protocol/payload";



export interface RSocketConfig {
    majorVersion: number;
    minorVersion: number,
    metadataMimeType: string;
    dataMimeType:string;
    keepaliveTime: number;
    maxLifetime: number;
    resumeIdentificationToken?: Uint8Array;
    honorsLease: boolean;
    setupPayload: Payload;
    fragmentSize: number;
}