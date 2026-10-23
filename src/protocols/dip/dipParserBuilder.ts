/**
 * DIP — payload inside a PCG frame (port DIP / DEVICE).
 * Fixed 3 bytes: device serial (big-endian u16) + command (e.g. synck request = 1).
 */
import {
  DipOffset,
  MIN_PACKET_SIZE,
  PACKET_SIZE,
} from "./constants.ts";
import type { DipParseResult, ParsedDip } from "./types.ts";

export class Dip {
  parse(data: Uint8Array): DipParseResult {
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

    if (data.length !== PACKET_SIZE) {
      return {
        ok: false,
        error: {
          reason: "LENGTH_MISMATCH",
          length: data.length,
          expectedLength: PACKET_SIZE,
        },
      };
    }

    const dip: ParsedDip = {
      serial:
        (data[DipOffset.SERIAL_HI] << 8) | data[DipOffset.SERIAL_LO],
      command: data[DipOffset.COMMAND],
    };

    return { ok: true, dip };
  }

  build(serial: number, command: number): Uint8Array {
    const out = new Uint8Array(PACKET_SIZE);
    out[DipOffset.SERIAL_HI] = (serial >> 8) & 0xff;
    out[DipOffset.SERIAL_LO] = serial & 0xff;
    out[DipOffset.COMMAND] = command & 0xff;
    return out;
  }
}
