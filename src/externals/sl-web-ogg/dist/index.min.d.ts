export type { EncodeOptions, EncodeTag } from "./types/types";

export function encodeAudioBuffer(
    audioData: Float32Array[],
    sampleRate: number,
    encodeOptions?: Partial<import("./types/types").EncodeOptions>
): Promise<Uint8Array[]>;
