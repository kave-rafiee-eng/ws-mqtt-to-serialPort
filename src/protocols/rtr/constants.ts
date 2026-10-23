/** RTR mode byte. Advance replies to both read and write with WRITE. */
export enum RtrMode {
  READ = 1,
  WRITE = 2,
}

export const RtrSize = {
  HEADER: 2,
  REGISTER_READ: 2,
  REGISTER_WRITE: 4,
} as const;

export const RtrOffset = {
  MODE: 0,
  NUM_OF_REGISTERS: 1,
} as const;

export const MIN_PACKET_SIZE = RtrSize.HEADER;
export const MAX_REGISTER_COUNT = 0xff;
