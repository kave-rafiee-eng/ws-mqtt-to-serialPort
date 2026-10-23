export type DataCallback = (data: Uint8Array) => void;

export interface Transport {
  setOnDataReceived(cb: DataCallback | null): void;
  write(data: Buffer | Uint8Array): void;
}
