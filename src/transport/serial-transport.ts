import { SerialPort } from "serialport";
import type { Transport, DataCallback } from "./types.ts";

function normalizeProductId(id: string | undefined): string {
  return (id ?? "").replace(/^0x/i, "").toLowerCase();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SerialTransport implements Transport {
  private port: SerialPort | null = null;
  private sendBuf: Uint8Array | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private onDataReceived: DataCallback | null = null;

  constructor(
    private readonly productId: string,
    private readonly baudRate: number,
    private readonly flushDelayMs: number,
    private readonly pollIntervalMs: number,
  ) {}

  setOnDataReceived(cb: DataCallback | null): void {
    this.onDataReceived = cb;
  }

  write(data: Buffer | Uint8Array): void {
    if (!this.port?.isOpen) {
      console.log("Serial port not ready");
      return;
    }

    const message = Buffer.from(data);
    this.port.write(message, (err) => {
      if (err) {
        console.log("Serial write error:", err.message);
        return;
      }
      this.port?.drain((drainErr) => {
        if (drainErr) {
          console.log("Serial drain error:", drainErr.message);
        }
      });
    });
  }

  /** Poll USB until matching productId appears, then open the port. */
  async start(): Promise<void> {
    const wanted = normalizeProductId(this.productId);

    while (!this.port?.isOpen) {
      const ports = await SerialPort.list();
      //console.log(ports);
      const match = ports.find(
        (p) => normalizeProductId(p.productId) === wanted,
      );

      if (!match) {
        console.log(`Waiting for USB serial (productId=${this.productId})...`);
        await delay(this.pollIntervalMs);
        continue;
      }

      console.log(`Opening serial ${match.path}`);
      try {
        await this.openPort(match.path);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`Failed to open ${match.path}: ${message}`);
        await delay(this.pollIntervalMs);
      }
    }
  }

  private openPort(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = new SerialPort({
        path,
        baudRate: this.baudRate,
        autoOpen: false,
      });

      port.open((err) => {
        if (err) {
          reject(err);
          return;
        }
        this.port = port;
        console.log("Serial port opened");
        resolve();
      });

      port.on("readable", () => this.handleReadable());
      port.on("error", (err) => {
        console.log("Serial error:", err.message);
      });
      port.on("close", () => {
        console.log("Serial port closed");
        this.port = null;
      });
    });
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
        this.onDataReceived?.(this.sendBuf);
        this.sendBuf = null;
      }
      this.flushTimer = null;
    }, this.flushDelayMs);
  }
}
