import type { QueueMode } from "../queue/pending-to-serial.ts";

export type AppConfig = {
  serial: {
    productId: string;
    baudRate: number;
    flushDelayMs: number;
    pollIntervalMs: number;
  };
  mqtt: {
    brokerUrl: string;
  };
  rtr: {
    resendIntervalMs: number;
  };
  synckDelayMs: number;
  queueMode: QueueMode;
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(): AppConfig {
  return {
    serial: {
      productId: process.env.SERIAL_PRODUCT_ID ?? "7523",
      baudRate: envInt("SERIAL_BAUD", 38400),
      flushDelayMs: envInt("SERIAL_FLUSH_MS", 40),
      pollIntervalMs: envInt("SERIAL_POLL_MS", 2000),
    },
    mqtt: {
      brokerUrl: process.env.MQTT_BROKER_URL ?? "mqtt://109.125.149.108:1883",
    },
    rtr: {
      resendIntervalMs: envInt("RTR_RESEND_MS", 1000),
    },
    synckDelayMs: envInt("SYNCK_DELAY_MS", 10),
    queueMode: process.env.QUEUE_MODE === "fifo" ? "fifo" : "lifo",
  };
}
