export type QueueMode = "lifo" | "fifo";

/** Holds MQTT→Advance frames until ESP32 SYNCK opens the serial window. */
export class PendingToSerialQueue {
  private readonly items: Uint8Array[] = [];

  constructor(private readonly mode: QueueMode) {}

  push(raw: Uint8Array): void {
    this.items.push(raw);
  }

  popOne(): Uint8Array | undefined {
    if (this.items.length === 0) return undefined;
    return this.mode === "fifo" ? this.items.shift() : this.items.pop();
  }

  get length(): number {
    return this.items.length;
  }
}
