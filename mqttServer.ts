import mqtt, { MqttClient } from "mqtt";

type MessageCallback = (message: Buffer) => void;

export class MqttServer {
  private client: MqttClient;
  private onMessageReceived: MessageCallback | null = null;

  constructor(
    private brokerUrl = "mqtt://109.125.149.108:1883",
    private pubTopic = "21781/sub",
    private subTopic = "21781/pub",
  ) {
    console.log("MQTT client connecting to port 1883");
    this.client = mqtt.connect(this.brokerUrl);
    this.setupEvents();
  }

  setOnMessageReceived(cb: MessageCallback): void {
    this.onMessageReceived = cb;
  }

  publish(data: Buffer | Uint8Array): void {
    console.log("send msg to mqtt");
    // console.log(data);
    if (this.pubTopic) {
      this.client.publish(this.pubTopic, Buffer.from(data));
    }
  }

  private setupEvents(): void {
    this.client.on("connect", () => {
      console.log("MQTT client connected");
      if (this.subTopic) {
        this.client.subscribe(this.subTopic);
      }
    });

    this.client.on("message", (_topic, message) => {
      this.onMessageReceived?.(message);
    });

    this.client.on("close", () => {
      console.log("MQTT client disconnected");
    });
  }
}
