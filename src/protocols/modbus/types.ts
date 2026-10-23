import type { ModbusFunctionCode } from "./constants.ts";

/**
 * Modbus ADU without CRC (PCG payload when port is MODBUS).
 * Wire: slaveId + functionCode + data. Multi-byte fields are big-endian.
 */
export type ParsedModbus =
  | {
      slaveId: number;
      functionCode: ModbusFunctionCode.READ_HOLDING_REGISTERS;
      kind: "request";
      startAddress: number;
      quantity: number;
    }
  | {
      slaveId: number;
      functionCode: ModbusFunctionCode.READ_HOLDING_REGISTERS;
      kind: "response";
      values: number[];
    }
  | {
      slaveId: number;
      functionCode: ModbusFunctionCode.WRITE_SINGLE_REGISTER;
      kind: "request" | "response";
      address: number;
      value: number;
    }
  | {
      slaveId: number;
      functionCode: ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS;
      kind: "request";
      startAddress: number;
      values: number[];
    }
  | {
      slaveId: number;
      functionCode: ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS;
      kind: "response";
      startAddress: number;
      quantity: number;
    }
  | {
      slaveId: number;
      functionCode: number;
      kind: "exception";
      exceptionCode: number;
    };

export type ModbusParseErrorReason =
  | "TOO_SHORT"
  | "UNKNOWN_FUNCTION"
  | "LENGTH_MISMATCH"
  | "BYTE_COUNT_MISMATCH"
  | "INVALID_QUANTITY";

export type ModbusParseError = {
  reason: ModbusParseErrorReason;
  length?: number;
  minLength?: number;
  expectedLength?: number;
  functionCode?: number;
  quantity?: number;
  byteCount?: number;
};

export type ModbusParseResult =
  | { ok: true; modbus: ParsedModbus }
  | { ok: false; error: ModbusParseError };
