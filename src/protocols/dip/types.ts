/** DIP payload (PCG payload when port is DIP). No CRC here; CRC belongs to PCG. */
export type ParsedDip = {
  serial: number;
  command: number;
};

export type DipParseErrorReason = "TOO_SHORT" | "LENGTH_MISMATCH";

export type DipParseError = {
  reason: DipParseErrorReason;
  length?: number;
  expectedLength?: number;
  minLength?: number;
};

export type DipParseResult =
  | { ok: true; dip: ParsedDip }
  | { ok: false; error: DipParseError };
