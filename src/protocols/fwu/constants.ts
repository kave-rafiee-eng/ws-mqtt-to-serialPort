/**
 * FWU mode byte.
 * Host → device: READ / WRITE.
 * Device → host: WRITE (read data) / ACK (write confirmed).
 */
export enum FwuMode {
  READ = 1,
  WRITE = 2,
  ACK = 3,
}

export const FwuSize = {
  HEADER: 2,
  ADDRESS: 16,
  DATA: 256,
} as const;

export const FwuOffset = {
  PID: 0,
  MODE: 1,
  ADDRESS: 2,
  DATA: 2 + FwuSize.ADDRESS,
} as const;

/** READ request / ACK reply: pid + mode + address */
export const PACKET_SIZE_READ =
  FwuSize.HEADER + FwuSize.ADDRESS;

/** Same wire length as READ; used for WRITE acknowledgment. */
export const PACKET_SIZE_ACK = PACKET_SIZE_READ;

/** WRITE request / READ reply: pid + mode + address + 256 data */
export const PACKET_SIZE_WRITE =
  FwuSize.HEADER + FwuSize.ADDRESS + FwuSize.DATA;

export const MIN_PACKET_SIZE = PACKET_SIZE_READ;
