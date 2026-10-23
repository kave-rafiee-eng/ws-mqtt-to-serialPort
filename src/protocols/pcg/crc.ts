/** Modbus CRC-16; appended as little-endian: low byte then high byte. */
export function modbusCrc16(buf: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x0001) {
        crc >>= 1;
        crc ^= 0xa001;
      } else {
        crc >>= 1;
      }
    }
    crc &= 0xffff;
  }
  return crc;
}
