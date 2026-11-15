import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { SerialPort } from "serialport";
import { createApp } from "../server/app";
import { VirtualSerialSimulator } from "../server/virtual-serial";
import { Parser, Type, encode, telemetry } from "../server/protocol";
type Message = Record<string, any>;
async function until<T>(get: () => T | undefined, timeout = 3000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = get();
    if (value !== undefined) return value;
    if (Date.now() - start > timeout)
      throw Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
test(
  "native PTY → real SerialPort → WebSocket supports policies, diagnostics, reconnect and cleanup",
  { timeout: 20000 },
  async () => {
    const app = await createApp({ virtualSerial: true });
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
    const port = (app.server.address() as AddressInfo).port,
      origin = `http://127.0.0.1:${port}`;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
    const messages: Message[] = [];
    let id = 0;
    ws.on("message", (raw) => messages.push(JSON.parse(String(raw))));
    const request = async (type: string, fields: Message = {}) => {
      const requestId = ++id;
      ws.send(JSON.stringify({ v: 1, id: requestId, type, ...fields }));
      return until(() =>
        messages.find((m) => m.type === "result" && m.id === requestId),
      );
    };
    const latest = (type: string) =>
      messages.filter((m) => m.type === type).at(-1);
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const pid = app.virtualSerial!.pid!;
    try {
      await once(ws, "open");
      const ports = (await (await fetch(`${origin}/api/ports`)).json()) as {
        path: string;
        label: string;
      }[];
      const virtual = ports.find(
        (p) => p.path === app.virtualSerial!.port!.path,
      )!;
      assert.match(virtual.label, /virtual serial/);
      assert.match(virtual.path, /^\/dev\//);
      assert.equal(
        ports.some((p) => p.path === "native-simulation"),
        false,
      ); // pipe transport disabled
      assert.equal(
        (await request("connect", { path: "/dev/pts/999999" })).ok,
        false,
      );
      assert.equal((await request("connect", { path: virtual.path })).ok, true);
      await until(() => latest("telemetry"));
      assert.equal(latest("connection")!.simulation_runner, "native-pty");
      assert.equal(latest("telemetry")!.mode, "SIMULATION");
      assert.ok(
        latest("connection")!.policies.some(
          (p: Message) => p.name === "swingup_lqr_v2",
        ),
      );
      const firstSession = latest("connection")!.session_id;
      assert.equal(
        (await request("control_subscribe", { enabled: true })).ok,
        true,
      );
      assert.equal((await request("acquire_control")).ok, true);
      heartbeat = setInterval(() => {
        void request("keepalive").catch(() => {});
      }, 40);
      assert.equal(
        (
          await request("console_command", {
            line: "sim state 180 0 0 0 running",
          })
        ).ok,
        true,
      );
      assert.equal((await request("arm")).ok, true);
      assert.equal(
        (await request("console_command", { line: "jog 20 150" })).ok,
        true,
      );
      await until(() =>
        Number(latest("telemetry")?.step_position_pulses) > 0
          ? true
          : undefined,
      );
      await until(() =>
        latest("telemetry")?.state === "ARMED" ? true : undefined,
      );
      assert.equal((await request("disarm")).ok, true);
      assert.equal((await request("sim_reset")).ok, true);
      assert.equal((await request("select_policy", { policy_id: 2 })).ok, true);
      assert.equal((await request("arm")).ok, true);
      assert.equal((await request("start_policy")).ok, true);
      // A host scheduling pause must not masquerade as an MCU overrun.
      const beforePause = latest("telemetry")!.sample_seq;
      process.kill(pid, "SIGSTOP");
      try {
        await new Promise((resolve) => setTimeout(resolve, 70));
      } finally {
        process.kill(pid, "SIGCONT");
      }
      const afterPause = await until(() => {
        const point = latest("telemetry");
        return point && point.sample_seq !== beforePause ? point : undefined;
      });
      assert.equal(afterPause.fault_bits & (1 << 4), 0);
      const control = await until(() =>
        latest("control_telemetry")?.active
          ? latest("control_telemetry")
          : undefined,
      );
      assert.ok(
        Number.isFinite(control.raw_u_mm_s2) &&
          Number.isFinite(control.limited_u_mm_s2),
      );
      assert.equal(control.policy_id, 2);
      assert.equal(
        (
          await request("telemetry_subscribe", {
            channels: [15, 24],
            rate_hz: 25,
          })
        ).ok,
        true,
      );
      await until(() =>
        latest("selected_telemetry")?.values[24] === 0 ? true : undefined,
      );
      assert.ok(
        messages.some((m) => m.type === "log" && m.entry.source === "mcu"),
      );
      assert.equal((await request("disarm")).ok, true);
      assert.equal((await request("disconnect")).ok, true);
      clearInterval(heartbeat);
      heartbeat = undefined;
      assert.equal(app.virtualSerial!.port!.path, virtual.path); // process lives across serial closes
      assert.equal((await request("connect", { path: virtual.path })).ok, true);
      assert.notEqual(latest("connection")!.session_id, firstSession);
      await until(() =>
        latest("telemetry")?.state === "IDLE" ? true : undefined,
      );
      assert.equal((await request("acquire_control")).ok, true);
      heartbeat = setInterval(() => {
        void request("keepalive").catch(() => {});
      }, 40);
      assert.equal((await request("arm")).ok, true);
      assert.equal((await request("start_policy")).ok, true);
      // Killing the process invalidates registration and revokes active control.
      process.kill(pid, "SIGTERM");
      await until(() =>
        latest("connection")?.serial === "disconnected" ? true : undefined,
      );
      assert.equal(latest("connection")!.control, "available");
      const after = (await (await fetch(`${origin}/api/ports`)).json()) as {
        path: string;
      }[];
      assert.ok(!after.some((p) => p.path === virtual.path));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      ws.terminate();
      await app.close();
    }
    assert.throws(() => process.kill(pid, 0));
  },
);

test(
  "native virtual serial stays responsive through an unread TX backlog and enforces its lease",
  { timeout: 15000 },
  async () => {
    const simulator = new VirtualSerialSimulator();
    await simulator.start();
    let serial: SerialPort | undefined;
    try {
      const packets: ReturnType<Parser["push"]> = [];
      const parser = new Parser();
      serial = new SerialPort({
        path: simulator.port!.path,
        baudRate: 115200,
        highWaterMark: 64,
        autoOpen: false,
      });
      serial.on("data", (bytes) => packets.push(...parser.push(bytes)));
      await new Promise<void>((resolve, reject) =>
        serial!.open((error) => (error ? reject(error) : resolve())),
      );
      const session = 123456789n;
      let id = 0;
      const command = async (type: number, payload = Buffer.alloc(0)) => {
        const requestId = ++id;
        serial!.write(
          encode({
            type,
            id: requestId,
            session: type === Type.HELLO ? 0n : session,
            payload,
          }),
        );
        return until(() =>
          packets.find(
            (p) =>
              p.payload.length >= 4 &&
              p.payload.readUInt32LE(0) === requestId &&
              [
                Type.RESPONSE,
                Type.HELLO_INFO,
                Type.STATUS,
                Type.SUBSCRIPTION,
              ].includes(p.type as any),
          ),
        );
      };
      const hello = Buffer.alloc(8);
      hello.writeBigUInt64LE(session);
      assert.equal((await command(Type.HELLO, hello)).type, Type.HELLO_INFO);
      assert.equal((await command(Type.ARM)).payload.readUInt16LE(4), 0);
      const subscription = Buffer.alloc(8);
      subscription.writeUInt32LE((1 << 25) - 1);
      subscription.writeUInt16LE(25, 4);
      assert.equal(
        (await command(Type.SUBSCRIBE, subscription)).type,
        Type.SUBSCRIPTION,
      );
      // Keep the OS endpoint open while suspending reads, so kernel queues fill.
      serial.pause();
      await new Promise((resolve) => setTimeout(resolve, 4000));
      serial.resume();
      const status = await command(Type.GET_STATUS);
      const state = telemetry(status.payload.subarray(4), session);
      assert.equal(state.state, "FAULT");
      assert.ok(state.fault_bits & (1 << 5));
      assert.equal(state.step_velocity_pulses_s, 0);
      assert.ok(
        state.dropped_samples > 0,
        "TX backlog should drop telemetry without blocking the device clock",
      );
      assert.equal(simulator.port !== undefined, true);
    } finally {
      if (serial?.isOpen)
        await new Promise<void>((resolve) => serial!.close(() => resolve()));
      await simulator.close();
    }
  },
);

test("closing the web server terminates its live virtual serial child", async () => {
  const app = await createApp({ virtualSerial: true });
  const pid = app.virtualSerial!.pid!;
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  await app.close();
  assert.equal(app.virtualSerial!.port, undefined);
  assert.throws(() => process.kill(pid, 0));
});

test(
  "native PTY cleans up when its owning server pipe disappears",
  { timeout: 5000 },
  async () => {
    const executable = fileURLToPath(
      new URL("../../build/host/pendulum-sim", import.meta.url),
    );
    const child = spawn(executable, ["--pty"], { stdio: "pipe" });
    try {
      const [ready] = await once(child.stdout, "data");
      assert.equal(JSON.parse(String(ready)).type, "serial_ready");
      const closed = once(child, "close");
      child.stdin.end();
      const [code] = await closed;
      assert.equal(code, 0);
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }
  },
);
