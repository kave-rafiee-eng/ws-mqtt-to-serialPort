import type { FwuMode } from "./constants.ts";

/**
 * FWU payload (PCG payload when port is FWU). No CRC here; CRC belongs to PCG.
 * Address is 16 bytes on the wire. Data is a fixed 256-byte firmware block.
 * Device replies: WRITE (data) for READ, ACK for WRITE.
 */
export type ParsedFwu =
  | { pid: number; mode: FwuMode.READ; address: Uint8Array }
  | {
      pid: number;
      mode: FwuMode.WRITE;
      address: Uint8Array;
      data: Uint8Array;
    }
  | { pid: number; mode: FwuMode.ACK; address: Uint8Array };

export type FwuParseErrorReason =
  | "TOO_SHORT"
  | "UNKNOWN_MODE"
  | "LENGTH_MISMATCH"
  | "ADDRESS_LENGTH"
  | "DATA_LENGTH";

export type FwuParseError = {
  reason: FwuParseErrorReason;
  length?: number;
  minLength?: number;
  expectedLength?: number;
  mode?: number;
};

export type FwuParseResult =
  | { ok: true; fwu: ParsedFwu }
  | { ok: false; error: FwuParseError };
