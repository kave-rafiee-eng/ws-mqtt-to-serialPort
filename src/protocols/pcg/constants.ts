export enum PcgSenderType {
  ADVANCE = 1,
  ESP32 = 2,
  CLIENT = 3,
  SERVER_UPDATE = 4,
  SERVER_RECORD = 5,
}

export enum PcgPort {
  DIP = 0,
  RTR = 1,
  FWU = 2,
  MODBUS = 3,
}

export const PcgSize = {
  CRC: 2,
  HEADER: 6,
} as const;

export const PcgOffset = {
  PID: 0,
  SENDER_TYPE: 1,
  SENDER_SERIAL_LOW: 2,
  SENDER_SERIAL_HIGH: 3,
  RECEIVER_TYPE: 4,
  RECEIVER_PORT: 5,
} as const;

export const MIN_PACKET_SIZE = PcgSize.CRC + PcgSize.HEADER;
