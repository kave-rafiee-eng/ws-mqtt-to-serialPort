/**
 * PCG — layer 1 - header (pid, sender type/serial, receiver type/port) + payload + CRC16 Modbus LE.
 */
import { MIN_PACKET_SIZE, PcgOffset, PcgSize } from "./constants.ts";
import { modbusCrc16 } from "./crc.ts";
import type { ParsedPcg, PcgParseResult } from "./types.ts";

export class Pcg {
  parse(data: Uint8Array): PcgParseResult {
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

    const crcL = data[data.length - 2];
    const crcH = data[data.length - 1];
    const receivedCrc = (crcH << 8) | crcL;
    const body = data.slice(0, data.length - PcgSize.CRC);
    const expectedCrc = modbusCrc16(body);

    if (expectedCrc !== receivedCrc) {
      return {
        ok: false,
        error: {
          reason: "CRC_MISMATCH",
          receivedCrc,
          expectedCrc,
        },
      };
    }

    const pcg: ParsedPcg = {
      pid: data[PcgOffset.PID],
      senderType: data[PcgOffset.SENDER_TYPE],
      senderSerialLow: data[PcgOffset.SENDER_SERIAL_LOW],
      senderSerialHigh: data[PcgOffset.SENDER_SERIAL_HIGH],
      receiverType: data[PcgOffset.RECEIVER_TYPE],
      receiverPort: data[PcgOffset.RECEIVER_PORT],
      payload: data.slice(PcgSize.HEADER, data.length - PcgSize.CRC),
    };

    return { ok: true, pcg };
  }

  build(
    pid: number,
    senderType: number,
    senderSerial: number,
    receiverType: number,
    receiverPort: number,
    payload: Uint8Array,
  ): Uint8Array {
    const bodyLen = PcgSize.HEADER + payload.length;
    const out = new Uint8Array(bodyLen + PcgSize.CRC);
    out[PcgOffset.PID] = pid;
    out[PcgOffset.SENDER_TYPE] = senderType;
    out[PcgOffset.SENDER_SERIAL_LOW] = senderSerial & 0xff;
    out[PcgOffset.SENDER_SERIAL_HIGH] = (senderSerial >> 8) & 0xff;
    out[PcgOffset.RECEIVER_TYPE] = receiverType;
    out[PcgOffset.RECEIVER_PORT] = receiverPort;
    out.set(payload, PcgSize.HEADER);

    const crc = modbusCrc16(out.slice(0, bodyLen));
    out[bodyLen] = crc & 0xff;
    out[bodyLen + 1] = (crc >> 8) & 0xff;

    return out;
  }

  /**
   * Split a serial chunk that may contain multiple back-to-back PCG frames.
   * Takes the shortest CRC-valid frame at each offset (idle gaps are not reliable).
   */
  splitFrames(data: Uint8Array): Uint8Array[] {
    const frames: Uint8Array[] = [];
    let offset = 0;

    while (offset + MIN_PACKET_SIZE <= data.length) {
      let found = false;

      for (let end = offset + MIN_PACKET_SIZE; end <= data.length; end++) {
        const slice = data.subarray(offset, end);
        const body = slice.subarray(0, slice.length - PcgSize.CRC);
        const receivedCrc =
          slice[slice.length - 2] | (slice[slice.length - 1] << 8);

        if (modbusCrc16(body) === receivedCrc) {
          frames.push(data.slice(offset, end));
          offset = end;
          found = true;
          break;
        }
      }

      if (!found) {
        offset += 1;
      }
    }

    return frames;
  }
}
