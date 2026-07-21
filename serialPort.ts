import { SerialPort } from "serialport";

type DataCallback = (data: Uint8Array) => void;

export class SerialPortManager {
  private port: SerialPort | null = null;
  private sendBuf: Uint8Array | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private onDataReceived: DataCallback | null = null;

  constructor(
    private productId = "7523",
    private baudRate = 38400,
    private flushDelayMs = 20,
  ) {}

  setOnDataReceived(cb: DataCallback): void {
    this.onDataReceived = cb;
  }

  write(data: Buffer | Uint8Array): void {
    if (!this.port) return console.log("Serial port not ready");

    const message = Buffer.from(data);
    this.port.write(message, (err) => {
      if (err) return console.log("Error:", err.message);
      console.log("Message sent to serial");
      // console.log(message);
    });
  }

  async connect(): Promise<void> {
    const ports = await SerialPort.list();
    console.log(ports);

    for (const p of ports) {
      if (p.productId !== this.productId) continue;

      this.port = new SerialPort({
        path: p.path,
        baudRate: this.baudRate,
      });

      this.port.on("open", () => console.log("Serial port opened"));
      this.port.on("readable", () => this.handleReadable());
    }
  }

  private handleReadable(): void {
    if (!this.port) return;

    let chunk: Buffer | null;
    while ((chunk = this.port.read()) !== null) {
      const incoming = new Uint8Array(chunk);
      if (this.sendBuf === null) {
        this.sendBuf = incoming;
      } else {
        const merged = new Uint8Array(this.sendBuf.length + incoming.length);
        merged.set(this.sendBuf, 0);
        merged.set(incoming, this.sendBuf.length);
        this.sendBuf = merged;
      }
    }

    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      if (this.sendBuf !== null) {
        // console.log("Recived Data From USB (merged):");
        // console.log(this.sendBuf);
        this.onDataReceived?.(this.sendBuf);
        this.sendBuf = null;
      }
      this.flushTimer = null;
    }, this.flushDelayMs);
  }
}
