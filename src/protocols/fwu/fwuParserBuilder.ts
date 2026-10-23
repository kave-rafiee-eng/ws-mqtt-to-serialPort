/**
 * FWU — payload inside a PCG frame (port FWU). Firmware update blocks.
 * Header: mode. Then 16-byte address; WRITE also carries 256-byte data.
 * Device replies: WRITE (data) for READ, ACK for WRITE.
 * Packet correlation uses PCG pid (not present in this payload).
 */
import {
  FwuMode,
  FwuOffset,
  FwuSize,
  MIN_PACKET_SIZE,
  PACKET_SIZE_ACK,
  PACKET_SIZE_READ,
  PACKET_SIZE_WRITE,
} from "./constants.ts";
import type { FwuParseResult, ParsedFwu } from "./types.ts";

export class Fwu {
  parse(data: Uint8Array): FwuParseResult {
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

    const mode = data[FwuOffset.MODE];
    const address = data.slice(
      FwuOffset.ADDRESS,
      FwuOffset.ADDRESS + FwuSize.ADDRESS,
    );

    if (mode === FwuMode.READ) {
      if (data.length !== PACKET_SIZE_READ) {
        return {
          ok: false,
          error: {
            reason: "LENGTH_MISMATCH",
            length: data.length,
            expectedLength: PACKET_SIZE_READ,
            mode,
          },
        };
      }
      return { ok: true, fwu: { mode: FwuMode.READ, address } };
    }

    if (mode === FwuMode.ACK) {
      if (data.length !== PACKET_SIZE_ACK) {
        return {
          ok: false,
          error: {
            reason: "LENGTH_MISMATCH",
            length: data.length,
            expectedLength: PACKET_SIZE_ACK,
            mode,
          },
        };
      }
      return { ok: true, fwu: { mode: FwuMode.ACK, address } };
    }

    if (mode === FwuMode.WRITE) {
      if (data.length !== PACKET_SIZE_WRITE) {
        return {
          ok: false,
          error: {
            reason: "LENGTH_MISMATCH",
            length: data.length,
            expectedLength: PACKET_SIZE_WRITE,
            mode,
          },
        };
      }
      const block = data.slice(
        FwuOffset.DATA,
        FwuOffset.DATA + FwuSize.DATA,
      );
      return {
        ok: true,
        fwu: { mode: FwuMode.WRITE, address, data: block },
      };
    }

    return {
      ok: false,
      error: {
        reason: "UNKNOWN_MODE",
        mode,
        length: data.length,
      },
    };
  }

  build(fwu: ParsedFwu): Uint8Array {
    if (fwu.address.length !== FwuSize.ADDRESS) {
      throw new RangeError(
        `FWU address length ${fwu.address.length} must be ${FwuSize.ADDRESS}`,
      );
    }

    if (fwu.mode === FwuMode.READ || fwu.mode === FwuMode.ACK) {
      const out = new Uint8Array(
        fwu.mode === FwuMode.ACK ? PACKET_SIZE_ACK : PACKET_SIZE_READ,
      );
      out[FwuOffset.MODE] = fwu.mode;
      out.set(fwu.address, FwuOffset.ADDRESS);
      return out;
    }

    if (fwu.data.length !== FwuSize.DATA) {
      throw new RangeError(
        `FWU data length ${fwu.data.length} must be ${FwuSize.DATA}`,
      );
    }

    const out = new Uint8Array(PACKET_SIZE_WRITE);
    out[FwuOffset.MODE] = FwuMode.WRITE;
    out.set(fwu.address, FwuOffset.ADDRESS);
    out.set(fwu.data, FwuOffset.DATA);
    return out;
  }
}
