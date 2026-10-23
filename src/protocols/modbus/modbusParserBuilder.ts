/**
 * Modbus — ADU without CRC inside a PCG frame (port MODBUS).
 * Wire: slaveId, functionCode, data. Multi-byte fields are big-endian.
 * Supports 0x03 / 0x06 / 0x10 and exception responses (FC | 0x80).
 */
import {
  MAX_REGISTER_QUANTITY,
  MIN_PACKET_SIZE,
  MODBUS_EXCEPTION_FLAG,
  ModbusFunctionCode,
  ModbusOffset,
  ModbusSize,
  PACKET_SIZE_EXCEPTION,
  PACKET_SIZE_FIXED_DATA,
} from "./constants.ts";
import type { ModbusParseResult, ParsedModbus } from "./types.ts";

function readU16BE(data: Uint8Array, offset: number): number {
  return (data[offset] << 8) | data[offset + 1];
}

function writeU16BE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = (value >> 8) & 0xff;
  out[offset + 1] = value & 0xff;
}

function readRegisters(
  data: Uint8Array,
  offset: number,
  count: number,
): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(readU16BE(data, offset + i * ModbusSize.REGISTER));
  }
  return values;
}

function writeRegisters(
  out: Uint8Array,
  offset: number,
  values: number[],
): void {
  for (let i = 0; i < values.length; i++) {
    writeU16BE(out, offset + i * ModbusSize.REGISTER, values[i]);
  }
}

export class Modbus {
  parse(data: Uint8Array): ModbusParseResult {
    if (data.length < MIN_PACKET_SIZE) {
      return {
        ok: false,
        error: {
          reason: "TOO_SHORT",
          length: data.length,
          minLength: MIN_PACKET_SIZE,
        },
      };
    }

    const slaveId = data[ModbusOffset.SLAVE_ID];
    const functionCode = data[ModbusOffset.FUNCTION_CODE];

    if (functionCode & MODBUS_EXCEPTION_FLAG) {
      if (data.length !== PACKET_SIZE_EXCEPTION) {
        return {
          ok: false,
          error: {
            reason: "LENGTH_MISMATCH",
            length: data.length,
            expectedLength: PACKET_SIZE_EXCEPTION,
            functionCode,
          },
        };
      }
      return {
        ok: true,
        modbus: {
          slaveId,
          functionCode,
          kind: "exception",
          exceptionCode: data[ModbusOffset.DATA],
        },
      };
    }

    if (functionCode === ModbusFunctionCode.READ_HOLDING_REGISTERS) {
      return this.parseReadHolding(slaveId, data);
    }

    if (functionCode === ModbusFunctionCode.WRITE_SINGLE_REGISTER) {
      return this.parseWriteSingle(slaveId, data);
    }

    if (functionCode === ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS) {
      return this.parseWriteMultiple(slaveId, data);
    }

    return {
      ok: false,
      error: {
        reason: "UNKNOWN_FUNCTION",
        functionCode,
        length: data.length,
      },
    };
  }

  build(modbus: ParsedModbus): Uint8Array {
    if (modbus.kind === "exception") {
      const out = new Uint8Array(PACKET_SIZE_EXCEPTION);
      out[ModbusOffset.SLAVE_ID] = modbus.slaveId;
      out[ModbusOffset.FUNCTION_CODE] = modbus.functionCode;
      out[ModbusOffset.DATA] = modbus.exceptionCode;
      return out;
    }

    if (
      modbus.functionCode === ModbusFunctionCode.READ_HOLDING_REGISTERS &&
      modbus.kind === "request"
    ) {
      this.assertQuantity(modbus.quantity);
      const out = new Uint8Array(PACKET_SIZE_FIXED_DATA);
      out[ModbusOffset.SLAVE_ID] = modbus.slaveId;
      out[ModbusOffset.FUNCTION_CODE] =
        ModbusFunctionCode.READ_HOLDING_REGISTERS;
      writeU16BE(out, ModbusOffset.DATA, modbus.startAddress);
      writeU16BE(out, ModbusOffset.DATA + 2, modbus.quantity);
      return out;
    }

    if (
      modbus.functionCode === ModbusFunctionCode.READ_HOLDING_REGISTERS &&
      modbus.kind === "response"
    ) {
      const count = modbus.values.length;
      this.assertQuantity(count);
      const byteCount = count * ModbusSize.REGISTER;
      const out = new Uint8Array(
        ModbusSize.HEADER + ModbusSize.BYTE_COUNT + byteCount,
      );
      out[ModbusOffset.SLAVE_ID] = modbus.slaveId;
      out[ModbusOffset.FUNCTION_CODE] =
        ModbusFunctionCode.READ_HOLDING_REGISTERS;
      out[ModbusOffset.DATA] = byteCount;
      writeRegisters(out, ModbusOffset.DATA + ModbusSize.BYTE_COUNT, modbus.values);
      return out;
    }

    if (modbus.functionCode === ModbusFunctionCode.WRITE_SINGLE_REGISTER) {
      const out = new Uint8Array(PACKET_SIZE_FIXED_DATA);
      out[ModbusOffset.SLAVE_ID] = modbus.slaveId;
      out[ModbusOffset.FUNCTION_CODE] =
        ModbusFunctionCode.WRITE_SINGLE_REGISTER;
      writeU16BE(out, ModbusOffset.DATA, modbus.address);
      writeU16BE(out, ModbusOffset.DATA + 2, modbus.value);
      return out;
    }

    if (
      modbus.functionCode === ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS &&
      modbus.kind === "request"
    ) {
      const quantity = modbus.values.length;
      this.assertQuantity(quantity);
      const byteCount = quantity * ModbusSize.REGISTER;
      const out = new Uint8Array(
        ModbusSize.HEADER +
          ModbusSize.ADDR_QTY_OR_VALUE +
          ModbusSize.BYTE_COUNT +
          byteCount,
      );
      out[ModbusOffset.SLAVE_ID] = modbus.slaveId;
      out[ModbusOffset.FUNCTION_CODE] =
        ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS;
      writeU16BE(out, ModbusOffset.DATA, modbus.startAddress);
      writeU16BE(out, ModbusOffset.DATA + 2, quantity);
      out[ModbusOffset.DATA + 4] = byteCount;
      writeRegisters(out, ModbusOffset.DATA + 5, modbus.values);
      return out;
    }

    if (
      modbus.functionCode === ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS &&
      modbus.kind === "response"
    ) {
      this.assertQuantity(modbus.quantity);
      const out = new Uint8Array(PACKET_SIZE_FIXED_DATA);
      out[ModbusOffset.SLAVE_ID] = modbus.slaveId;
      out[ModbusOffset.FUNCTION_CODE] =
        ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS;
      writeU16BE(out, ModbusOffset.DATA, modbus.startAddress);
      writeU16BE(out, ModbusOffset.DATA + 2, modbus.quantity);
      return out;
    }

    throw new Error("Unreachable Modbus build variant");
  }

  private parseReadHolding(
    slaveId: number,
    data: Uint8Array,
  ): ModbusParseResult {
    if (data.length === PACKET_SIZE_FIXED_DATA) {
      const quantity = readU16BE(data, ModbusOffset.DATA + 2);
      if (quantity < 1 || quantity > MAX_REGISTER_QUANTITY) {
        return {
          ok: false,
          error: {
            reason: "INVALID_QUANTITY",
            functionCode: ModbusFunctionCode.READ_HOLDING_REGISTERS,
            quantity,
          },
        };
      }
      return {
        ok: true,
        modbus: {
          slaveId,
          functionCode: ModbusFunctionCode.READ_HOLDING_REGISTERS,
          kind: "request",
          startAddress: readU16BE(data, ModbusOffset.DATA),
          quantity,
        },
      };
    }

    if (data.length < ModbusSize.HEADER + ModbusSize.BYTE_COUNT) {
      return {
        ok: false,
        error: {
          reason: "TOO_SHORT",
          length: data.length,
          minLength: ModbusSize.HEADER + ModbusSize.BYTE_COUNT,
          functionCode: ModbusFunctionCode.READ_HOLDING_REGISTERS,
        },
      };
    }

    const byteCount = data[ModbusOffset.DATA];
    const expectedLength =
      ModbusSize.HEADER + ModbusSize.BYTE_COUNT + byteCount;
    if (data.length !== expectedLength) {
      return {
        ok: false,
        error: {
          reason: "LENGTH_MISMATCH",
          length: data.length,
          expectedLength,
          functionCode: ModbusFunctionCode.READ_HOLDING_REGISTERS,
          byteCount,
        },
      };
    }

    if (byteCount % ModbusSize.REGISTER !== 0) {
      return {
        ok: false,
        error: {
          reason: "BYTE_COUNT_MISMATCH",
          functionCode: ModbusFunctionCode.READ_HOLDING_REGISTERS,
          byteCount,
        },
      };
    }

    const quantity = byteCount / ModbusSize.REGISTER;
    if (quantity < 1 || quantity > MAX_REGISTER_QUANTITY) {
      return {
        ok: false,
        error: {
          reason: "INVALID_QUANTITY",
          functionCode: ModbusFunctionCode.READ_HOLDING_REGISTERS,
          quantity,
          byteCount,
        },
      };
    }

    return {
      ok: true,
      modbus: {
        slaveId,
        functionCode: ModbusFunctionCode.READ_HOLDING_REGISTERS,
        kind: "response",
        values: readRegisters(
          data,
          ModbusOffset.DATA + ModbusSize.BYTE_COUNT,
          quantity,
        ),
      },
    };
  }

  private parseWriteSingle(
    slaveId: number,
    data: Uint8Array,
  ): ModbusParseResult {
    if (data.length !== PACKET_SIZE_FIXED_DATA) {
      return {
        ok: false,
        error: {
          reason: "LENGTH_MISMATCH",
          length: data.length,
          expectedLength: PACKET_SIZE_FIXED_DATA,
          functionCode: ModbusFunctionCode.WRITE_SINGLE_REGISTER,
        },
      };
    }

    return {
      ok: true,
      modbus: {
        slaveId,
        functionCode: ModbusFunctionCode.WRITE_SINGLE_REGISTER,
        kind: "request",
        address: readU16BE(data, ModbusOffset.DATA),
        value: readU16BE(data, ModbusOffset.DATA + 2),
      },
    };
  }

  private parseWriteMultiple(
    slaveId: number,
    data: Uint8Array,
  ): ModbusParseResult {
    if (data.length === PACKET_SIZE_FIXED_DATA) {
      const quantity = readU16BE(data, ModbusOffset.DATA + 2);
      if (quantity < 1 || quantity > MAX_REGISTER_QUANTITY) {
        return {
          ok: false,
          error: {
            reason: "INVALID_QUANTITY",
            functionCode: ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS,
            quantity,
          },
        };
      }
      return {
        ok: true,
        modbus: {
          slaveId,
          functionCode: ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS,
          kind: "response",
          startAddress: readU16BE(data, ModbusOffset.DATA),
          quantity,
        },
      };
    }

    const minRequest =
      ModbusSize.HEADER +
      ModbusSize.ADDR_QTY_OR_VALUE +
      ModbusSize.BYTE_COUNT;
    if (data.length < minRequest) {
      return {
        ok: false,
        error: {
          reason: "TOO_SHORT",
          length: data.length,
          minLength: minRequest,
          functionCode: ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS,
        },
      };
    }

    const quantity = readU16BE(data, ModbusOffset.DATA + 2);
    const byteCount = data[ModbusOffset.DATA + 4];
    const expectedLength = minRequest + byteCount;

    if (data.length !== expectedLength) {
      return {
        ok: false,
        error: {
          reason: "LENGTH_MISMATCH",
          length: data.length,
          expectedLength,
          functionCode: ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS,
          quantity,
          byteCount,
        },
      };
    }

    if (
      quantity < 1 ||
      quantity > MAX_REGISTER_QUANTITY ||
      byteCount !== quantity * ModbusSize.REGISTER
    ) {
      return {
        ok: false,
        error: {
          reason: "BYTE_COUNT_MISMATCH",
          functionCode: ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS,
          quantity,
          byteCount,
        },
      };
    }

    return {
      ok: true,
      modbus: {
        slaveId,
        functionCode: ModbusFunctionCode.WRITE_MULTIPLE_REGISTERS,
        kind: "request",
        startAddress: readU16BE(data, ModbusOffset.DATA),
        values: readRegisters(data, ModbusOffset.DATA + 5, quantity),
      },
    };
  }

  private assertQuantity(quantity: number): void {
    if (quantity < 1 || quantity > MAX_REGISTER_QUANTITY) {
      throw new RangeError(
        `Modbus register quantity ${quantity} must be 1..${MAX_REGISTER_QUANTITY}`,
      );
    }
  }
}
