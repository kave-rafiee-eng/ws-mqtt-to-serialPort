import type { RtrMode } from "./constants.ts";

/** One register in a read request: address only, big-endian on the wire. */
export type RtrReadRegister = {
  address: number;
};

/** One register in a write request or any device reply: address + value, big-endian. */
export type RtrWriteRegister = {
  address: number;
  value: number;
};

/**
 * RTR payload (PCG payload when port is RTR). No CRC here; CRC belongs to PCG.
 * Device responses always use WRITE, including replies to a READ.
 */
export type ParsedRtr =
  | { mode: RtrMode.READ; registers: RtrReadRegister[] }
  | { mode: RtrMode.WRITE; registers: RtrWriteRegister[] };

export type RtrParseErrorReason =
  | "TOO_SHORT"
  | "UNKNOWN_MODE"
  | "LENGTH_MISMATCH";

export type RtrParseError = {
  reason: RtrParseErrorReason;
  length?: number;
  minLength?: number;
  expectedLength?: number;
  mode?: number;
  numOfRegisters?: number;
};

export type RtrParseResult =
  | { ok: true; rtr: ParsedRtr }
  | { ok: false; error: RtrParseError };
