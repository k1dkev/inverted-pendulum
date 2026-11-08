import { EventEmitter } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SerialPort } from "serialport";

export class Transport extends EventEmitter {
  private serial?: SerialPort;
  private child?: ChildProcessWithoutNullStreams;
  private closing = false;
  static async ports(mock: boolean) {
    const ports = await SerialPort.list();
    return [
      ...ports.map((p) => ({
        path: p.path,
        label: [p.path, p.manufacturer, p.serialNumber]
          .filter(Boolean)
          .join(" · "),
      })),
      ...(mock
        ? [
            {
              path: "native-simulation",
              label: "Native C simulator · no USB required",
            },
          ]
        : []),
    ];
  }
  async open(path: string, mock: boolean) {
    if (path === "native-simulation") {
      if (!mock) throw Error("Native simulation is disabled");
      const executable = fileURLToPath(
        new URL("../../build/host/pendulum-sim", import.meta.url),
      );
      /* Relative to web/server, the repository build directory is two levels up. */
      this.child = spawn(executable, [], { stdio: "pipe" });
      this.child.stdout.on("data", (data) => this.emit("data", data));
      this.child.stderr.on("data", (data) => console.error(String(data)));
      this.child.on("close", () => {
        if (!this.closing) this.emit("lost", Error("Native peer exited"));
      });
      await new Promise<void>((resolve, reject) => {
        this.child!.once("spawn", resolve);
        this.child!.once("error", reject);
      });
      return;
    }
    const available = await SerialPort.list();
    if (!available.some((p) => p.path === path))
      throw Error("Select an available serial port");
    this.serial = new SerialPort({
      path,
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      rtscts: false,
      autoOpen: false,
    });
    this.serial.on("data", (data) => this.emit("data", data));
    this.serial.on("error", (error) => {
      if (!this.closing) this.emit("lost", error);
    });
    this.serial.on("close", () => {
      if (!this.closing) this.emit("lost", Error("Serial port disconnected"));
    });
    await new Promise<void>((resolve, reject) =>
      this.serial!.open((error) => (error ? reject(error) : resolve())),
    );
    await new Promise<void>((resolve, reject) =>
      this.serial!.flush((error) => (error ? reject(error) : resolve())),
    );
  }
  write(bytes: Buffer) {
    const stream = this.serial ?? this.child?.stdin;
    if (
      !stream ||
      this.closing ||
      stream.destroyed ||
      stream.writableLength > 4096
    )
      throw Error("Serial writer unavailable or backlogged");
    stream.write(bytes, (error: Error | null | undefined) => {
      if (error && !this.closing) this.emit("lost", error);
    });
  }
  async close() {
    this.closing = true;
    this.child?.stdin.end();
    this.child?.kill();
    if (this.serial?.isOpen)
      await new Promise<void>((resolve) => this.serial!.close(() => resolve()));
  }
}
