export const MAX_LOCAL_RECORDING_BYTES = 256 * 1024 * 1024;
export const RECORDING_FINAL_CHUNK_RESERVE_BYTES = 16 * 1024 * 1024;

export type RecordingChunkResult = { accepted: boolean; shouldStop: boolean };
export type RecordingLimitReason = "bytes" | "duration" | null;
export type RecordingCompletion = { kind: "failed" } | { kind: "empty" } | { kind: "download"; reason: RecordingLimitReason };

export function canStartRecording(stateIdle: boolean, recorderAttached: boolean, permissionPending: boolean): boolean {
  return stateIdle && !recorderAttached && !permissionPending;
}

export class RecordingCaptureEpoch {
  private current = 0;

  begin(): number {
    this.current += 1;
    return this.current;
  }

  invalidate(): void {
    this.current += 1;
  }

  isCurrent(epoch: number): boolean {
    return this.current === epoch;
  }
}

export function recordingCompletion(chunkRejected: boolean, blobBytes: number, reason: RecordingLimitReason): RecordingCompletion {
  if (chunkRejected) return { kind: "failed" };
  if (blobBytes <= 0) return { kind: "empty" };
  return { kind: "download", reason };
}

/** Keeps accepted MediaRecorder slices bounded and reserves room for final encoder output. */
export class BoundedRecordingBuffer {
  private chunks: Blob[] = [];
  private bytes = 0;

  constructor(
    private readonly maxBytes = MAX_LOCAL_RECORDING_BYTES,
    private readonly finalChunkReserveBytes = RECORDING_FINAL_CHUNK_RESERVE_BYTES,
  ) {}

  append(chunk: Blob): RecordingChunkResult {
    if (this.bytes + chunk.size > this.maxBytes) return { accepted: false, shouldStop: true };
    this.chunks.push(chunk);
    this.bytes += chunk.size;
    return { accepted: true, shouldStop: this.bytes >= this.maxBytes - this.finalChunkReserveBytes };
  }

  toBlob(type: string): Blob {
    return new Blob(this.chunks, { type });
  }

  clear(): void {
    this.chunks = [];
    this.bytes = 0;
  }

  get sizeBytes(): number {
    return this.bytes;
  }
}
