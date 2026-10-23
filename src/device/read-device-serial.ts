import { PcgSenderType, PcgPort } from "../protocols/pcg/constants.ts";
import { Pcg } from "../protocols/pcg/pcgParserBuilder.ts";
import { RtrMode } from "../protocols/rtr/constants.ts";
import { Rtr } from "../protocols/rtr/rtrParserBuilder.ts";
import type { SerialTransport } from "../transport/serial-transport.ts";

/** Advance register that returns Device.Serial (see PCG_rtr.c case 10100). */
export const DEVICE_SERIAL_REGISTER = 10100;

/**
 * Send RTR READ for device serial and wait for a WRITE reply with the same PCG PID.
 * Resends until a valid response arrives (same idea as ESP32 rtrReadRegister(..., 0)).
 */
export function readDeviceSerial(
  serial: SerialTransport,
  resendIntervalMs: number,
): Promise<number> {
  const pcg = new Pcg();
  const rtr = new Rtr();
  const pid = Math.floor(Math.random() * 256);

  const request = pcg.build(
    pid,
    PcgSenderType.ESP32,
    0,
    PcgSenderType.ADVANCE,
    PcgPort.RTR,
    rtr.build({
      mode: RtrMode.READ,
      registers: [{ address: DEVICE_SERIAL_REGISTER }],
    }),
  );

  return new Promise((resolve) => {
    let settled = false;

    const tryParse = (data: Uint8Array): void => {
      const pcgResult = pcg.parse(data);
      if (!pcgResult.ok) return;
      if (pcgResult.pcg.pid !== pid) return;
      if (pcgResult.pcg.receiverPort !== PcgPort.RTR) return;
      if (pcgResult.pcg.senderType !== PcgSenderType.ADVANCE) return;

      const rtrResult = rtr.parse(pcgResult.pcg.payload);
      if (!rtrResult.ok) return;
      if (rtrResult.rtr.mode !== RtrMode.WRITE) return;

      const reg = rtrResult.rtr.registers.find(
        (r) => r.address === DEVICE_SERIAL_REGISTER,
      );
      if (!reg) return;

      settled = true;
      clearInterval(resendTimer);
      serial.setOnDataReceived(null);
      console.log(`Device serial: ${reg.value}`);
      resolve(reg.value);
    };

    serial.setOnDataReceived(tryParse);
    serial.write(request);
    console.log(
      `RTR read serial reg ${DEVICE_SERIAL_REGISTER}, pid=0x${pid.toString(16)}`,
    );

    const resendTimer = setInterval(() => {
      if (settled) return;
      console.log("RTR: no valid reply, resending...");
      serial.write(request);
    }, resendIntervalMs);
  });
}
