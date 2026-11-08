import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsolePanel } from "../client/ConsolePanel";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { parseCommand } from "../shared/commands";
import { LogStore, deviceLog } from "../server/logging";
import { createApp } from "../server/app";

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
test("console grammar rejects malformed and unbounded commands; units are explicit", () => {
  assert.deepEqual(parseCommand("jog -20 500"), {
    type: "console_jog",
    fields: { velocity_mm_s: -20, duration_ms: 500 },
  });
  assert.equal(
    parseCommand("sim state 180 0 20 0 paused").fields.angle_rad,
    Math.PI,
  );
  assert.equal(parseCommand("log level warn").fields.level, 30);
  assert.deepEqual(
    parseCommand("telemetry subscribe 0,8,10 10").fields.channels,
    [0, 8, 10],
  );
  for (const line of [
    "jog 10 5001",
    "jog 10 0",
    "jog NaN 50",
    "jog 20 Infinity",
    "arm; disarm",
    "arm\ndisarm",
    "status extra",
    "sim state 0 0 0 0 unknown",
    "telemetry subscribe 0,banana 10",
    "log level trace",
    "x".repeat(513),
  ])
    assert.throws(() => parseCommand(line));
});
test("structured log store is bounded and NDJSON preserves independent records", () => {
  const store = new LogStore();
  for (let i = 0; i < 1100; i++)
    store.append({
      level: "info",
      source: "bridge",
      message: "test",
      fields: { i },
    });
  assert.equal(store.snapshot().length, 1000);
  assert.equal(store.snapshot()[0].id, 101);
  assert.ok(Buffer.byteLength(JSON.stringify(store.recent())) <= 32768);
  const records = store
    .ndjson()
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(records.at(-1).fields.i, 1099);
  const wire = Buffer.alloc(32);
  wire.writeBigUInt64LE(12345678901234n);
  wire[12] = 40;
  wire[13] = 2;
  wire.writeUInt16LE(8, 14);
  wire.writeUInt32LE(1, 16);
  wire.writeUInt32LE(3, 20);
  wire.writeUInt32LE(1, 24);
  const decoded = deviceLog(wire);
  assert.equal(decoded.device_time_us, "12345678901234");
  assert.equal(decoded.level, "error");
  assert.equal(decoded.fields.error_code, 1);
  wire.writeUInt16LE(0, 14);
  assert.deepEqual(deviceLog(wire).fields.args, [1, 3, 1]);
});
test("console renders escaped log/command text with accessible controls", () => {
  const markup = renderToStaticMarkup(
    createElement(ConsolePanel, {
      logs: [
        {
          id: 1,
          timestamp: "2026-11-08T15:00:00.000Z",
          level: "warn",
          source: "mcu",
          message: "<script>test</script>",
          fields: { code: 11 },
        },
      ],
      commands: [
        {
          key: 1,
          id: 1,
          line: "<b>status</b>",
          status: "error",
          code: "UNKNOWN_COMMAND",
        },
      ],
      submit: () => {},
      ready: true,
      owned: false,
    }),
  );
  assert.ok(markup.includes("&lt;script&gt;test&lt;/script&gt;"));
  assert.ok(!markup.includes("<script>test</script>"));
  assert.ok(
    markup.includes('id="console-command"') &&
      markup.includes('href="/api/logs"'),
  );
  assert.ok(markup.includes("READ ONLY") && markup.includes("UNKNOWN_COMMAND"));
});
test(
  "browser commands share ownership, MCU logs and bounded jogs through the native peer",
  { timeout: 20000 },
  async () => {
    const app = await createApp({ mock: true });
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
    const port = (app.server.address() as AddressInfo).port,
      origin = `http://127.0.0.1:${port}`;
    const open = async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
      let id = 0;
      const messages: Message[] = [];
      ws.on("message", (raw) => messages.push(JSON.parse(String(raw))));
      await once(ws, "open");
      const request = async (type: string, fields: Message = {}) => {
        const requestId = ++id;
        ws.send(JSON.stringify({ v: 1, id: requestId, type, ...fields }));
        return until(() =>
          messages.find((m) => m.type === "result" && m.id === requestId),
        );
      };
      return {
        ws,
        messages,
        request,
        command: (line: string) => request("console_command", { line }),
        latest: (type: string) =>
          messages.filter((m) => m.type === type).at(-1),
      };
    };
    const owner = await open();
    let reader: Awaited<ReturnType<typeof open>> | undefined,
      heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
      assert.equal((await owner.command("help")).ok, true);
      assert.equal((await owner.command("status")).code, "NOT_CONNECTED");
      assert.equal(
        (await owner.request("connect", { path: "native-simulation" })).ok,
        true,
      );
      assert.equal((await owner.command("status")).ok, true);
      assert.equal(owner.latest("console_output")!.data.mode, "SIMULATION");
      reader = await open();
      assert.ok(await until(() => reader!.latest("log_history")));
      assert.equal((await reader.command("status")).ok, true);
      assert.equal((await reader.command("arm")).code, "NOT_CONTROL_OWNER");
      assert.equal(
        (await reader.command("log level off")).code,
        "NOT_CONTROL_OWNER",
      );
      assert.equal((await owner.command("control acquire")).ok, true);
      heartbeat = setInterval(() => {
        void owner.request("keepalive").catch(() => {});
      }, 40);
      assert.equal((await owner.command("log config")).ok, true);
      assert.equal(owner.latest("console_output")!.data.level, 20);
      assert.equal((await owner.command("log level warn")).ok, true);
      assert.equal(owner.latest("console_output")!.data.level, 30);
      assert.equal((await owner.command("log level info")).ok, true);
      assert.equal(
        (await owner.command("sim state 180 0 0 0 running")).ok,
        true,
      );
      assert.equal((await owner.command("policy select manual")).ok, true);
      assert.equal((await owner.command("arm")).ok, true);
      assert.equal((await owner.command("jog 20 300")).ok, true);
      await until(() =>
        owner.latest("telemetry")?.step_velocity_pulses_s > 0
          ? true
          : undefined,
      );
      await until(() =>
        owner.latest("telemetry")?.state === "ARMED" &&
        owner.latest("telemetry")?.step_velocity_pulses_s === 0
          ? true
          : undefined,
      );
      assert.ok(Number(owner.latest("telemetry")!.step_position_pulses) > 0);
      assert.equal((await owner.command("jog 20 5001")).ok, false);
      assert.equal((await owner.command("jog 500 500")).code, "LIMIT_EXCEEDED");
      // New intent interrupts a timed jog and cannot be revived by its scheduler.
      assert.equal((await owner.command("jog -20 2000")).ok, true);
      assert.equal((await owner.command("stop")).ok, true);
      await until(() =>
        owner.latest("telemetry")?.state === "ARMED" ? true : undefined,
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(owner.latest("telemetry")!.step_velocity_pulses_s, 0);
      // Stop submitted before the initial jog ACK must prevent scheduled refreshes.
      const pendingJog = owner.command("jog 20 2000"),
        pendingStop = owner.command("stop");
      assert.equal((await pendingJog).ok, true);
      assert.equal((await pendingStop).ok, true);
      await until(() =>
        owner.latest("telemetry")?.state === "ARMED" ? true : undefined,
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(owner.latest("telemetry")!.step_velocity_pulses_s, 0);
      assert.equal((await owner.command("jog 20 2000")).ok, true);
      clearInterval(heartbeat);
      heartbeat = undefined;
      await until(() =>
        owner.latest("connection")?.control === "available" ? true : undefined,
      );
      await until(() =>
        owner.latest("telemetry")?.state === "IDLE" ? true : undefined,
      );
      assert.equal(owner.latest("telemetry")!.step_velocity_pulses_s, 0);
      const logs = owner.messages
        .filter((m) => m.type === "log")
        .map((m) => m.entry);
      assert.ok(
        logs.some((entry) => entry.source === "mcu" && entry.device_time_us),
      );
      assert.ok(
        logs.some(
          (entry) => entry.source === "command" && entry.level === "warn",
        ),
      );
      assert.ok(
        logs.some(
          (entry) =>
            entry.source === "bridge" && entry.message.includes("heartbeat"),
        ),
      );
      assert.ok(
        !logs.some(
          (entry) =>
            entry.source === "command" && entry.message.startsWith("keepalive"),
        ),
      );
      const download = await fetch(`${origin}/api/logs`);
      assert.equal(download.status, 200);
      assert.match(download.headers.get("content-type")!, /ndjson/);
      const records = (await download.text())
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.ok(records.length > 5 && records.length <= 1000);
      assert.ok(
        records.every(
          (entry) => entry.timestamp && entry.source && entry.fields,
        ),
      );
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      owner.ws.terminate();
      reader?.ws.terminate();
      await app.close();
    }
  },
);
