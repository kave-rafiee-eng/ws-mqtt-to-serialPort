import { MqttServer } from "./mqttServer.js";
import { SerialPortManager } from "./serialPort.js";

enum PcgAddress {
  ADVANCE = 1,
  ESP32 = 2,
  CLIENT = 3,
}

enum PcgPort {
  DEVICE = 0,
  RTR = 1,
}

enum PcgSize {
  CRC = 2,
  HEADER = 3, // sender_id, receiver_id, port
}

enum PcgOffset {
  SENDER_ID = 0,
  RECEIVER_ID = 1,
  RECEIVER_PORT = 2,
}

enum PcgDeviceSize {
  FULL = 3,
}

enum PcgDeviceRequest {
  SYNCK = 1,
}

const LOG_SERIAL = "[SERIAL]";
const LOG_PCG_DEVICE = "[PCG-DEVICE]";
const LOG_MQTT = "[MQTT]";

const MIN_PACKET_SIZE = PcgSize.CRC + PcgSize.HEADER;

function Delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ParsedPacket = {
  senderId: number;
  receiverId: number;
  receiverPort: number;
  payload: Uint8Array;
};

export class PcgProtocol {
  private stackMqttForAdvance: Uint8Array[] = [];

  constructor(
    private serialPort: SerialPortManager,
    private mqttServer: MqttServer,
  ) {}

  start(): void {
    this.serialPort.setOnDataReceived((data) => this.handleSerialData(data));
    this.mqttServer.setOnMessageReceived((data) =>
      this.handleMqttData(new Uint8Array(data)),
    );
    this.serialPort.connect();
  }

  private handleSerialData(data: Uint8Array): void {
    const packet = this.parsePacket(data, LOG_SERIAL);
    if (!packet) return;

    if (packet.senderId !== PcgAddress.ADVANCE) {
      console.log(LOG_SERIAL, "senderID rejected:", {
        recieviedId: packet.senderId,
        expectedID: PcgAddress.ADVANCE,
      });
      return;
    }

    if (packet.receiverId === PcgAddress.CLIENT) {
      console.log(LOG_SERIAL, "msg for client");
      this.mqttServer.publish(data);
      return;
    }

    if (
      packet.receiverId === PcgAddress.ESP32 &&
      packet.receiverPort === PcgPort.DEVICE
    ) {
      this.handleDeviceRequest(packet.payload);
    }
  }

  private handleMqttData(data: Uint8Array): void {
    const packet = this.parsePacket(data, LOG_MQTT);
    if (!packet) return;

    if (packet.senderId !== PcgAddress.CLIENT) {
      console.log(LOG_MQTT, "senderID rejected:", {
        recieviedId: packet.senderId,
        expectedID: PcgAddress.CLIENT,
      });
      return;
    }

    if (packet.receiverId === PcgAddress.ADVANCE) {
      console.log(LOG_MQTT, "add msg to stck advance");
      this.stackMqttForAdvance.push(data);
    }
  }

  private async handleDeviceRequest(pcgDeviceData: Uint8Array) {
    if (pcgDeviceData.length !== PcgDeviceSize.FULL) {
      console.log(LOG_PCG_DEVICE, "msg rejected", {
        length: pcgDeviceData.length,
        expectedLength: PcgDeviceSize.FULL,
      });
      return;
    }

    const request = pcgDeviceData[2];

    if (request === PcgDeviceRequest.SYNCK) {
      console.log(LOG_PCG_DEVICE, "SYNCK msg recevied");
      if (this.stackMqttForAdvance.length > 0) {
        await Delay(10);
        this.serialPort.write(this.stackMqttForAdvance.pop()!);
      }
    }
  }

  private parsePacket(data: Uint8Array, logTag: string): ParsedPacket | null {
    if (data.length < MIN_PACKET_SIZE) {
      console.log(logTag, "data rejected to short.", {
        length: data.length,
        minLength: MIN_PACKET_SIZE,
      });
      return null;
    }

    // console.log(logTag, data);

    const crcL = data[data.length - 2];
    const crcH = data[data.length - 1];
    const receivedCrc = (crcH << 8) | crcL;
    const crc = modbusCrc16(data.slice(0, data.length - 2));

    if (crc !== receivedCrc) {
      console.log(logTag, "CRC rejected:", {
        receivedCrc,
        expectedCrc: crc,
      });
      return null;
    }

    return {
      senderId: data[PcgOffset.SENDER_ID],
      receiverId: data[PcgOffset.RECEIVER_ID],
      receiverPort: data[PcgOffset.RECEIVER_PORT],
      payload: data.slice(PcgSize.HEADER, data.length - PcgSize.CRC),
    };
  }
}

function modbusCrc16(buf: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x0001) {
        crc >>= 1;
        crc ^= 0xa001;
      } else {
        crc >>= 1;
      }
    }
    crc &= 0xffff;
  }
  return crc;
}
