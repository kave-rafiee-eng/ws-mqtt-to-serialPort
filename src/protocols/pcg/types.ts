/** PCG layer — parsed packet (header fields + payload, without CRC bytes). */

import { PcgPort, PcgSenderType } from "./constants.ts";

export type ParsedPcg = {
  senderType: PcgSenderType;
  senderSerialLow: number;
  senderSerialHigh: number;
  receiverType: PcgSenderType;
  receiverPort: PcgPort;
  payload: Uint8Array;
};

export type PcgParseErrorReason = "TOO_SHORT" | "CRC_MISMATCH";

export type PcgParseError = {
  reason: PcgParseErrorReason;
  length?: number;
  minLength?: number;
  receivedCrc?: number;
  expectedCrc?: number;
};

export type PcgParseResult =
  | { ok: true; pcg: ParsedPcg }
  | { ok: false; error: PcgParseError };
