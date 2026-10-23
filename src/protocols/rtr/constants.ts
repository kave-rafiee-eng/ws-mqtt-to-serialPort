/** RTR mode byte. Advance replies to both read and write with WRITE. */
export enum RtrMode {
  READ = 1,
  WRITE = 2,
}

export const RtrSize = {
  HEADER: 3,
  REGISTER_READ: 2,
  REGISTER_WRITE: 4,
} as const;

export const RtrOffset = {
  PID: 0,
  MODE: 1,
  NUM_OF_REGISTERS: 2,
} as const;

export const MIN_PACKET_SIZE = RtrSize.HEADER;
export const MAX_REGISTER_COUNT = 0xff;
