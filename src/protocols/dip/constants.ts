/** DIP command byte inside the fixed 3-byte payload. */
export enum DipCommand {
  SYNCK_REQUEST = 1,
}

export const DipSize = {
  PAYLOAD: 3,
  SERIAL: 2,
  COMMAND: 1,
} as const;

export const DipOffset = {
  SERIAL_HI: 0,
  SERIAL_LO: 1,
  COMMAND: 2,
} as const;

export const MIN_PACKET_SIZE = DipSize.PAYLOAD;
export const PACKET_SIZE = DipSize.PAYLOAD;
