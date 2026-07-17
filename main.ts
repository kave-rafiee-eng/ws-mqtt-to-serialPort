import { SerialPort } from "serialport";

// import { WsSend, SetCb_WsMessArrived } from "./wsServer.js";
import { MqttSend, SetCb_MqttMessArrived } from "./mqttServer.js";

// SetCb_WsMessArrived(WsMessArrived);
SetCb_MqttMessArrived(WsMessArrived);

let port: SerialPort | null = null;

function WsMessArrived(data: Buffer): void {
  console.log("wsMssArived:", data);

  if (!port) return console.log("Serial port not ready");

  const message = Buffer.from(data);
  port.write(message, (err) => {
    if (err) return console.log("Error:", err.message);
    console.log("Message sent to serial");
  });
}

let sendBuf: Uint8Array | null = null;
let timer: boolean | null = null;

SerialPort.list().then((ports) => {
  console.log(ports);

  ports.forEach((p) => {
    if (p.serialNumber === "6&2E9A18CE&0&3") {
      port = new SerialPort({
        path: p.path,
        baudRate: 38400,
      });

      port.on("open", () => console.log("Serial port opened"));

      port.on("data", (data) => {
        const incoming = new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength,
        );

        if (sendBuf === null) {
          sendBuf = incoming;
        } else {
          const tmp = new Uint8Array(sendBuf.length + incoming.length);
          tmp.set(sendBuf, 0);
          tmp.set(incoming, sendBuf.length);
          sendBuf = tmp;
        }

        if (timer == null) {
          timer = true;
          setTimeout(() => {
            // WsSend(sendBuf!);
            MqttSend(sendBuf!);
            sendBuf = null;
            timer = null;
          }, 100);
        }
      });
    }
  });
});

const intervalID = setInterval(async () => {}, 1000);
