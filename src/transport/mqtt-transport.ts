import mqtt, { type MqttClient } from "mqtt";
import type { DataCallback } from "./types.ts";

export class MqttTransport {
  private client: MqttClient | null = null;
  private onMessageReceived: DataCallback | null = null;
  private subTopic = "";

  constructor(private readonly brokerUrl: string) {}

  setOnDataReceived(cb: DataCallback | null): void {
    this.onMessageReceived = cb;
  }

  write(data: Buffer | Uint8Array, topic: string): void {
    if (!this.client?.connected || !topic) {
      console.log("MQTT not ready");
      return;
    }
    this.client.publish(topic, Buffer.from(data));
  }

  /** Connect after device serial is known. Subscribe stays fixed on `{serial}/pub`. */
  start(subTopic: string): Promise<void> {
    this.subTopic = subTopic;

    return new Promise((resolve, reject) => {
      let settled = false;
      console.log(`MQTT connecting to ${this.brokerUrl}`);
      const client = mqtt.connect(this.brokerUrl);
      this.client = client;

      const fail = (err: Error): void => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      const ok = (): void => {
        if (settled) return;
        settled = true;
        resolve();
      };

      client.on("connect", () => {
        console.log("MQTT client connected");
        client.subscribe(this.subTopic, (err) => {
          if (err) {
            fail(err);
            return;
          }
          console.log(`MQTT subscribed: ${this.subTopic}`);
          ok();
        });
      });

      client.on("message", (_topic, message) => {
        this.onMessageReceived?.(new Uint8Array(message));
      });

      client.on("close", () => {
        console.log("MQTT client disconnected");
      });

      client.on("error", (err) => {
        console.log("MQTT error:", err.message);
        fail(err);
      });
    });
  }
}
