import mqtt from "mqtt";

const PUB_TOPIC = "873/sub";
const SUB_TOPIC = "873/pub";

const client = mqtt.connect("mqtt://localhost:1883");

type MessageCallback = (message: Buffer) => void;

let Cb_MqttMessArrived: MessageCallback | null = null;

console.log("MQTT client connecting to port 1883");

export function MqttSend(data: Buffer | Uint8Array): void {
  console.log("Recived Data From USB : ");
  console.log(data);
  if (PUB_TOPIC) {
    client.publish(PUB_TOPIC, Buffer.from(data));
  }
}

export function SetCb_MqttMessArrived(CbFn: MessageCallback): void {
  Cb_MqttMessArrived = CbFn;
}

client.on("connect", () => {
  console.log("MQTT client connected");
  if (SUB_TOPIC) {
    client.subscribe(SUB_TOPIC);
  }
});

client.on("message", (_topic, message) => {
  if (Cb_MqttMessArrived) Cb_MqttMessArrived(message);
});

client.on("close", () => {
  console.log("MQTT client disconnected");
});
