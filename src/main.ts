import { loadConfig } from "./config/env.ts";
import { Esp32Simulator } from "./device/esp32-simulator.ts";
import { readDeviceSerial } from "./device/read-device-serial.ts";
import { PendingToSerialQueue } from "./queue/pending-to-serial.ts";
import { PcgRouter } from "./routing/pcg-router.ts";
import { MqttTransport } from "./transport/mqtt-transport.ts";
import { SerialTransport } from "./transport/serial-transport.ts";

const config = loadConfig();

async function main(): Promise<void> {
  const serial = new SerialTransport(
    config.serial.productId,
    config.serial.baudRate,
    config.serial.flushDelayMs,
    config.serial.pollIntervalMs,
  );

  console.log("1) Waiting for USB serial port...");
  await serial.start();

  console.log("2) Reading device serial via RTR...");
  const deviceSerial = await readDeviceSerial(
    serial,
    config.rtr.resendIntervalMs,
  );

  const subTopic = `${deviceSerial}/pub`;

  console.log("3) Starting MQTT...");
  const mqtt = new MqttTransport(config.mqtt.brokerUrl);

  const pendingQueue = new PendingToSerialQueue(config.queueMode);
  const esp32 = new Esp32Simulator(
    pendingQueue,
    serial,
    mqtt,
    deviceSerial,
    config.synckDelayMs,
  );
  const router = new PcgRouter(deviceSerial, mqtt, pendingQueue, esp32);

  serial.setOnDataReceived((data) => router.handleFromSerial(data));
  mqtt.setOnDataReceived((data) => router.handleFromMqtt(data));
  await mqtt.start(subTopic);

  console.log(
    `Router ready — serial→ESP32/MQTT, MQTT→queue (flush on SYNCK), sub ${subTopic}, pub {serial}/client|server_update|server_record`,
  );
}

main().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
