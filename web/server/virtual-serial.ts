import { EventEmitter } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
export interface VirtualPort {
  path: string;
  label: string;
}
/** App-owned registration: an exited child cannot leave a stale port entry. */
export class VirtualSerialSimulator extends EventEmitter {
  private child?: ChildProcessWithoutNullStreams;
  private registered?: VirtualPort;
  private closing = false;
  get port() {
    return this.registered;
  }
  get pid() {
    return this.child?.pid;
  }
  async start() {
    if (this.child) throw Error("Virtual serial simulator already started");
    const executable = fileURLToPath(
      new URL("../../build/host/pendulum-sim", import.meta.url),
    );
    const child = spawn(executable, ["--pty"], { stdio: "pipe" });
    this.child = child;
    child.stderr.on("data", (data) => console.error(String(data).trimEnd()));
    child.on("close", () => {
      const path = this.registered?.path;
      this.registered = undefined;
      if (!this.closing)
        this.emit("lost", Error("Virtual serial simulator exited"), path);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        let buffer = "",
          settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          child.stdout.off("data", ready);
          child.off("error", rejectStart);
          child.off("close", exited);
          error ? reject(error) : resolve();
        };
        const rejectStart = (error: Error) => finish(error);
        const exited = () =>
          finish(Error("Virtual serial simulator exited before readiness"));
        const ready = (data: Buffer) => {
          buffer += data.toString();
          if (buffer.length > 4096) {
            finish(Error("Oversized virtual serial readiness message"));
            return;
          }
          const newline = buffer.indexOf("\n");
          if (newline < 0) return;
          try {
            const info = JSON.parse(buffer.slice(0, newline));
            if (
              info.type !== "serial_ready" ||
              typeof info.path !== "string" ||
              !/^\/dev\/(?:ttys[\w]+|pts\/\d+)$/.test(info.path)
            )
              throw Error("Invalid virtual serial readiness message");
            this.registered = {
              path: info.path,
              label: `Local C simulator · virtual serial · ${info.path}`,
            };
            finish();
          } catch (error) {
            finish(
              error instanceof Error
                ? error
                : Error("Invalid virtual serial readiness message"),
            );
          }
        };
        const timer = setTimeout(
          () =>
            finish(
              Error(
                "Virtual serial simulator startup timed out; run just native",
              ),
            ),
          3000,
        );
        child.once("error", rejectStart);
        child.once("close", exited);
        child.stdout.on("data", ready);
      });
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  async close() {
    this.closing = true;
    this.registered = undefined;
    const child = this.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => child.kill("SIGKILL"), 1000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill("SIGTERM");
    });
  }
}
