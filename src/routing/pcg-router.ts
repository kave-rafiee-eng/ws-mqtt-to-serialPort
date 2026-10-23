import { PcgSenderType } from "../protocols/pcg/constants.ts";
import { Pcg } from "../protocols/pcg/pcgParserBuilder.ts";
import type { Esp32Simulator } from "../device/esp32-simulator.ts";
import type { PendingToSerialQueue } from "../queue/pending-to-serial.ts";
import type { MqttTransport } from "../transport/mqtt-transport.ts";

const MQTT_PUB_SUFFIX: Partial<Record<PcgSenderType, string>> = {
  [PcgSenderType.CLIENT]: "client",
  [PcgSenderType.SERVER_UPDATE]: "server_update",
  [PcgSenderType.SERVER_RECORD]: "server_record",
};

function mqttPubTopic(
  deviceSerial: number,
  receiverType: number,
): string | null {
  const suffix = MQTT_PUB_SUFFIX[receiverType as PcgSenderType];
  return suffix === undefined ? null : `${deviceSerial}/${suffix}`;
}

function isMqttPeer(address: number): boolean {
  return address in MQTT_PUB_SUFFIX;
}

/**
 * Routes PCG frames by receiver:
 * - serial → ESP32: local simulator
 * - serial → CLIENT / SERVER_UPDATE / SERVER_RECORD: MQTT (topic by destination)
 * - MQTT → ADVANCE: pending queue (flushed on ESP32 SYNCK)
 * - MQTT → ESP32: local simulator
 */
export class PcgRouter {
  private readonly pcg = new Pcg();

  constructor(
    private readonly deviceSerial: number,
    private readonly mqtt: MqttTransport,
    private readonly pendingQueue: PendingToSerialQueue,
    private readonly esp32: Esp32Simulator,
  ) {}

  handleFromSerial(raw: Uint8Array): void {
    const parsed = this.pcg.parse(raw);
    if (!parsed.ok) {
      console.log("[ROUTER] serial parse failed:", parsed.error);
      return;
    }

    const { pcg } = parsed;
    if (pcg.senderType !== PcgSenderType.ADVANCE) {
      console.log("[ROUTER] serial sender rejected:", pcg.senderType);
      return;
    }

    if (pcg.receiverType === PcgSenderType.ESP32) {
      console.log("[ROUTER] serial → ESP32 simulator");
      this.esp32.handle(pcg);
      return;
    }

    const topic = mqttPubTopic(pcg.receiverType, this.deviceSerial);
    if (topic !== null) {
      console.log(`[ROUTER] serial → MQTT topic=${topic}`);
      this.mqtt.write(raw, topic);
      return;
    }

    console.log("[ROUTER] serial destination ignored:", pcg.receiverType);
  }

  handleFromMqtt(raw: Uint8Array): void {
    const parsed = this.pcg.parse(raw);
    if (!parsed.ok) {
      console.log("[ROUTER] mqtt parse failed:", parsed.error);
      return;
    }

    const { pcg } = parsed;
    if (!isMqttPeer(pcg.senderType)) {
      console.log("[ROUTER] mqtt sender rejected:", pcg.senderType);
      return;
    }

    if (pcg.receiverType === PcgSenderType.ADVANCE) {
      console.log("[ROUTER] mqtt → pending serial queue");
      this.pendingQueue.push(raw);
      return;
    }

    if (pcg.receiverType === PcgSenderType.ESP32) {
      console.log("[ROUTER] mqtt → ESP32 simulator");
      this.esp32.handle(pcg);
      return;
    }

    console.log("[ROUTER] mqtt destination ignored:", pcg.receiverType);
  }
}
