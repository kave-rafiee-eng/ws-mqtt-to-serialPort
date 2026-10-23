import { DipCommand } from "../protocols/dip/constants.ts";
import { Dip } from "../protocols/dip/dipParserBuilder.ts";
import { FwuMode, FwuSize } from "../protocols/fwu/constants.ts";
import { Fwu } from "../protocols/fwu/fwuParserBuilder.ts";
import { PcgPort, PcgSenderType } from "../protocols/pcg/constants.ts";
import { Pcg } from "../protocols/pcg/pcgParserBuilder.ts";
import type { ParsedPcg } from "../protocols/pcg/types.ts";
import type { PendingToSerialQueue } from "../queue/pending-to-serial.ts";
import type { MqttTransport } from "../transport/mqtt-transport.ts";
import type { SerialTransport } from "../transport/serial-transport.ts";

const MQTT_PUB_SUFFIX: Partial<Record<PcgSenderType, string>> = {
  [PcgSenderType.CLIENT]: "client",
  [PcgSenderType.SERVER_UPDATE]: "server_update",
  [PcgSenderType.SERVER_RECORD]: "server_record",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addressKey(address: Uint8Array): string {
  return Buffer.from(address).toString("hex");
}

/**
 * Local stand-in for the ESP32 node.
 * - DIP SYNCK: release one pending MQTT frame to serial.
 * - FWU READ/WRITE: virtual flash (256-byte blocks keyed by 16-byte address).
 */
export class Esp32Simulator {
  private readonly dip = new Dip();
  private readonly fwu = new Fwu();
  private readonly pcg = new Pcg();
  /** Virtual flash: hex(address) → 256-byte block */
  private readonly memory = new Map<string, Uint8Array>();
  private handling = false;

  constructor(
    private readonly queue: PendingToSerialQueue,
    private readonly serial: SerialTransport,
    private readonly mqtt: MqttTransport,
    private readonly deviceSerial: number,
    private readonly synckDelayMs: number,
  ) {}

  handle(pcg: ParsedPcg): void {
    if (pcg.receiverPort === PcgPort.DIP) {
      void this.handleDip(pcg.payload);
      return;
    }

    if (pcg.receiverPort === PcgPort.FWU) {
      this.handleFwu(pcg);
      return;
    }

    console.log("[ESP32-SIM] unhandled port:", pcg.receiverPort);
  }

  private handleFwu(request: ParsedPcg): void {
    const parsed = this.fwu.parse(request.payload);
    if (!parsed.ok) {
      console.log("[ESP32-SIM] FWU rejected:", parsed.error);
      return;
    }

    const { fwu } = parsed;
    const key = addressKey(fwu.address);

    if (fwu.mode === FwuMode.WRITE) {
      this.memory.set(key, new Uint8Array(fwu.data));
      console.log(
        `[ESP32-SIM] FWU WRITE pid=${request.pid} addr=${key} bytes=${fwu.data.length}`,
      );
      const ack = this.fwu.build({
        mode: FwuMode.ACK,
        address: fwu.address,
      });
      this.reply(request, ack);
      return;
    }

    if (fwu.mode === FwuMode.READ) {
      const stored = this.memory.get(key);
      const data = stored ?? new Uint8Array(FwuSize.DATA);
      console.log(
        `[ESP32-SIM] FWU READ pid=${request.pid} addr=${key} hit=${stored !== undefined}`,
      );
      const replyPayload = this.fwu.build({
        mode: FwuMode.WRITE,
        address: fwu.address,
        data,
      });
      this.reply(request, replyPayload);
      return;
    }

    console.log("[ESP32-SIM] FWU mode ignored:", fwu.mode);
  }

  /** Swap sender/receiver and send back on the same transport the request used. */
  private reply(request: ParsedPcg, fwuPayload: Uint8Array): void {
    const frame = this.pcg.build(
      request.pid,
      PcgSenderType.ESP32,
      0,
      request.senderType,
      PcgPort.FWU,
      fwuPayload,
    );

    if (request.senderType === PcgSenderType.ADVANCE) {
      this.serial.write(frame);
      return;
    }

    const suffix = MQTT_PUB_SUFFIX[request.senderType];
    if (suffix === undefined) {
      console.log(
        "[ESP32-SIM] cannot reply to sender type:",
        request.senderType,
      );
      return;
    }

    this.mqtt.write(frame, `${this.deviceSerial}/${suffix}`);
  }

  private async handleDip(payload: Uint8Array): Promise<void> {
    const parsed = this.dip.parse(payload);
    if (!parsed.ok) {
      console.log("[ESP32-SIM] DIP rejected:", parsed.error);
      return;
    }

    if (parsed.dip.command !== DipCommand.SYNCK_REQUEST) {
      console.log("[ESP32-SIM] DIP command ignored:", parsed.dip.command);
      return;
    }

    if (this.handling) return;
    this.handling = true;

    try {
      console.log(
        `[ESP32-SIM] SYNCK serial=${parsed.dip.serial}, pending=${this.queue.length}`,
      );
      const pending = this.queue.popOne();
      if (pending === undefined) return;

      await delay(this.synckDelayMs);
      this.serial.write(pending);
    } finally {
      this.handling = false;
    }
  }
}
