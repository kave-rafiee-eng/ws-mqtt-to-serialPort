import { MqttServer } from "./mqttServer.js";
import { SerialPortManager } from "./serialPort.js";
import { PcgProtocol } from "./pcg.js";

const mqttServer = new MqttServer();
const serialPort = new SerialPortManager();
const pcg = new PcgProtocol(serialPort, mqttServer);

pcg.start();
