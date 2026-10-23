/**
 * RTR — payload inside a PCG frame (port RTR).
 * Header: mode, register count.
 * READ registers are address only (2 bytes). WRITE registers are address + value (4 bytes).
 * Multi-byte fields are big-endian. Advance answers both modes with a WRITE payload.
 */
import {
  MAX_REGISTER_COUNT,
  MIN_PACKET_SIZE,
  RtrMode,
  RtrOffset,
  RtrSize,
} from "./constants.ts";
import type {
  ParsedRtr,
  RtrParseResult,
  RtrReadRegister,
  RtrWriteRegister,
} from "./types.ts";

function readU16BE(data: Uint8Array, offset: number): number {
  return (data[offset] << 8) | data[offset + 1];
}

function writeU16BE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = (value >> 8) & 0xff;
  out[offset + 1] = value & 0xff;
}

export class Rtr {
  parse(data: Uint8Array): RtrParseResult {
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

    const mode = data[RtrOffset.MODE];
    const numOfRegisters = data[RtrOffset.NUM_OF_REGISTERS];

    if (mode === RtrMode.READ) {
      const expectedLength =
        RtrSize.HEADER + numOfRegisters * RtrSize.REGISTER_READ;
      if (data.length !== expectedLength) {
        return {
          ok: false,
          error: {
            reason: "LENGTH_MISMATCH",
            length: data.length,
            expectedLength,
            mode,
            numOfRegisters,
          },
        };
      }

      const registers: RtrReadRegister[] = [];
      for (let i = 0; i < numOfRegisters; i++) {
        const offset = RtrSize.HEADER + i * RtrSize.REGISTER_READ;
        registers.push({ address: readU16BE(data, offset) });
      }

      return { ok: true, rtr: { mode: RtrMode.READ, registers } };
    }

    if (mode === RtrMode.WRITE) {
      const expectedLength =
        RtrSize.HEADER + numOfRegisters * RtrSize.REGISTER_WRITE;
      if (data.length !== expectedLength) {
        return {
          ok: false,
          error: {
            reason: "LENGTH_MISMATCH",
            length: data.length,
            expectedLength,
            mode,
            numOfRegisters,
          },
        };
      }

      const registers: RtrWriteRegister[] = [];
      for (let i = 0; i < numOfRegisters; i++) {
        const offset = RtrSize.HEADER + i * RtrSize.REGISTER_WRITE;
        registers.push({
          address: readU16BE(data, offset),
          value: readU16BE(data, offset + 2),
        });
      }

      return { ok: true, rtr: { mode: RtrMode.WRITE, registers } };
    }

    return {
      ok: false,
      error: {
        reason: "UNKNOWN_MODE",
        mode,
        length: data.length,
        numOfRegisters,
      },
    };
  }

  build(rtr: ParsedRtr): Uint8Array {
    const count = rtr.registers.length;
    if (count > MAX_REGISTER_COUNT) {
      throw new RangeError(
        `RTR register count ${count} exceeds ${MAX_REGISTER_COUNT}`,
      );
    }

    if (rtr.mode === RtrMode.READ) {
      const out = new Uint8Array(
        RtrSize.HEADER + count * RtrSize.REGISTER_READ,
      );
      out[RtrOffset.MODE] = RtrMode.READ;
      out[RtrOffset.NUM_OF_REGISTERS] = count;
      for (let i = 0; i < count; i++) {
        writeU16BE(
          out,
          RtrSize.HEADER + i * RtrSize.REGISTER_READ,
          rtr.registers[i].address,
        );
      }
      return out;
    }

    const out = new Uint8Array(
      RtrSize.HEADER + count * RtrSize.REGISTER_WRITE,
    );
    out[RtrOffset.MODE] = RtrMode.WRITE;
    out[RtrOffset.NUM_OF_REGISTERS] = count;
    for (let i = 0; i < count; i++) {
      const offset = RtrSize.HEADER + i * RtrSize.REGISTER_WRITE;
      writeU16BE(out, offset, rtr.registers[i].address);
      writeU16BE(out, offset + 2, rtr.registers[i].value);
    }
    return out;
  }
}
