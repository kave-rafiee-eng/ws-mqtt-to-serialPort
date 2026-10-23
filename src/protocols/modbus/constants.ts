/** Modbus function codes (holding-register subset). */
export enum ModbusFunctionCode {
  READ_HOLDING_REGISTERS = 0x03,
  WRITE_SINGLE_REGISTER = 0x06,
  WRITE_MULTIPLE_REGISTERS = 0x10,
}

/** Exception bit ORed onto the request function code. */
export const MODBUS_EXCEPTION_FLAG = 0x80;

/** Common Modbus exception codes. */
export enum ModbusExceptionCode {
  ILLEGAL_FUNCTION = 0x01,
  ILLEGAL_DATA_ADDRESS = 0x02,
  ILLEGAL_DATA_VALUE = 0x03,
  SLAVE_DEVICE_FAILURE = 0x04,
}

export const ModbusSize = {
  HEADER: 2,
  /** Fixed data for 0x03 request / 0x06 request|response / 0x10 response */
  ADDR_QTY_OR_VALUE: 4,
  BYTE_COUNT: 1,
  EXCEPTION_CODE: 1,
  REGISTER: 2,
} as const;

export const ModbusOffset = {
  SLAVE_ID: 0,
  FUNCTION_CODE: 1,
  DATA: 2,
} as const;

/** Max registers per 0x03 / 0x10 (Modbus spec). */
export const MAX_REGISTER_QUANTITY = 125;

export const MIN_PACKET_SIZE = ModbusSize.HEADER;

/** Full ADU length for 0x03 request and 0x06 request/response / 0x10 response. */
export const PACKET_SIZE_FIXED_DATA =
  ModbusSize.HEADER + ModbusSize.ADDR_QTY_OR_VALUE;

/** Exception ADU: slave + (FC|0x80) + exceptionCode. */
export const PACKET_SIZE_EXCEPTION =
  ModbusSize.HEADER + ModbusSize.EXCEPTION_CODE;
