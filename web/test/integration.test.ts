import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/app";

type Message = Record<string, any>;
async function until<T>(get: () => T | undefined, timeout = 2500): Promise<T> {
  const start = Date.now();
  for (;;) {
    const result = get();
    if (result !== undefined) return result;
    if (Date.now() - start > timeout)
      throw Error("Timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 10));
  }
}
test(
  "real C peer → serial codec → WebSocket: telemetry, simulation controls, jog and ownership",
  { timeout: 15000 },
  async () => {
    const app = await createApp({ mock: true });
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
    const port = (app.server.address() as AddressInfo).port,
      origin = `http://127.0.0.1:${port}`;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
    const messages: Message[] = [];
    ws.on("message", (data) => messages.push(JSON.parse(String(data))));
    let id = 0;
    const request = async (type: string, fields: Message = {}) => {
      const requestId = ++id;
      ws.send(JSON.stringify({ v: 1, type, id: requestId, ...fields }));
      return until(() =>
        messages.find((m) => m.type === "result" && m.id === requestId),
      );
    };
    const latest = () => messages.filter((m) => m.type === "telemetry").at(-1);
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
      await once(ws, "open");
      assert.equal((await fetch(`${origin}/health`)).status, 200);
      const ports = (await (await fetch(`${origin}/api/ports`)).json()) as {
        path: string;
      }[];
      assert.ok(ports.some((p) => p.path === "native-simulation"));
      assert.equal(
        (await request("connect", { path: "native-simulation" })).ok,
        true,
      );
      const first = await until(() => latest());
      assert.equal(first.mode, "SIMULATION");
      assert.ok(first.angle_rad !== null);
      const model = messages
        .filter((m) => m.type === "connection")
        .at(-1)!.simulation_parameters;
      assert.equal(model.x_min_mm, -190);
      assert.equal(model.x_max_mm, 190);
      assert.ok(Math.abs(model.inertia_kg_m2 - 0.00267683) < 1e-9);
      assert.equal((await request("acquire_control")).ok, true);
      heartbeat = setInterval(() => {
        void request("keepalive").catch(() => {});
      }, 50);
      assert.equal(
        (
          await request("sim_parameters", {
            inertia_kg_m2: 0.004,
            damping_n_m_s: 0.001,
          })
        ).ok,
        true,
      );
      const applied = messages
        .filter((m) => m.type === "connection")
        .at(-1)!.simulation_parameters;
      assert.ok(
        Math.abs(applied.inertia_kg_m2 - 0.004) < 1e-9 &&
          Math.abs(applied.damping_n_m_s - 0.001) < 1e-9,
      );
      assert.equal(
        (
          await request("sim_parameters", {
            inertia_kg_m2: 0,
            damping_n_m_s: 0,
          })
        ).code,
        "LIMIT_EXCEEDED",
      );
      assert.equal(
        (
          await request("sim_state", {
            angle_rad: 0,
            angular_velocity_rad_s: 0,
            position_pulses: "9501",
            velocity_pulses_s: 0,
            paused: true,
          })
        ).code,
        "LIMIT_EXCEEDED",
      );
      assert.equal(
        (
          await request("sim_state", {
            angle_rad: 0.5,
            angular_velocity_rad_s: 0,
            position_pulses: "-120",
            velocity_pulses_s: 0,
            paused: true,
          })
        ).ok,
        true,
      );
      await until(() => (latest()?.simulation_paused ? latest() : undefined));
      assert.equal(latest()!.step_position_pulses, "-120");
      assert.equal(latest()!.angle_rad, 0.5);
      assert.equal((await request("arm")).code, "WRONG_STATE");
      assert.equal((await request("sim_pause", { paused: false })).ok, true);
      await until(() =>
        latest() && !latest()!.simulation_paused ? latest() : undefined,
      );
      assert.equal(
        (await request("set_acceleration", { acceleration_pulses_s2: 500000 }))
          .ok,
        true,
      );
      assert.equal(
        (await request("set_acceleration", { acceleration_pulses_s2: 5000 }))
          .ok,
        true,
      );
      assert.equal(
        messages.filter((m) => m.type === "connection").at(-1)!.capabilities
          .acceleration,
        5000,
      );
      assert.equal(
        (await request("set_acceleration", { acceleration_pulses_s2: 500001 }))
          .code,
        "LIMIT_EXCEEDED",
      );
      assert.equal((await request("arm")).ok, true);
      await until(() => (latest()?.state === "ARMED" ? true : undefined));
      for (let i = 0; i < 8; i++) {
        assert.equal(
          (await request("jog", { velocity_pulses_s: 200 })).ok,
          true,
        );
        await new Promise((r) => setTimeout(r, 40));
      }
      assert.ok(latest()!.step_velocity_pulses_s > 0, JSON.stringify(latest()));
      assert.equal((await request("sim_reset")).code, "WRONG_STATE");
      // A long stop ramp must not lock out a fresh arrow/velocity target.
      assert.equal((await request("disarm")).ok, true);
      await until(() => (latest()?.state === "IDLE" ? true : undefined));
      assert.equal(
        (await request("set_acceleration", { acceleration_pulses_s2: 500 })).ok,
        true,
      );
      assert.equal((await request("arm")).ok, true);
      await until(() => (latest()?.state === "ARMED" ? true : undefined));
      for (let i = 0; i < 8; i++) {
        await request("jog", { velocity_pulses_s: 200 });
        await new Promise((r) => setTimeout(r, 40));
      }
      assert.equal((await request("stop")).ok, true);
      await until(() =>
        latest()?.state === "STOPPING" && latest()!.step_velocity_pulses_s > 0
          ? true
          : undefined,
      );
      for (let i = 0; i < 12; i++) {
        assert.equal(
          (await request("jog", { velocity_pulses_s: -200 })).ok,
          true,
        );
        await new Promise((r) => setTimeout(r, 40));
      }
      assert.ok(latest()!.step_velocity_pulses_s < 0);
      assert.equal((await request("stop")).ok, true);
      await until(() =>
        latest()?.state === "ARMED" && latest()?.step_velocity_pulses_s === 0
          ? true
          : undefined,
      );
      await new Promise((r) => setTimeout(r, 650)); // Remains armed while stationary.
      assert.equal(latest()!.state, "ARMED");
      for (let i = 0; i < 4; i++) {
        assert.equal(
          (await request("jog", { velocity_pulses_s: -200 })).ok,
          true,
        );
        await new Promise((r) => setTimeout(r, 40));
      }
      assert.ok(latest()!.step_velocity_pulses_s < 0);
      /* No more held-jog messages: bridge revokes ownership and stops motion. */
      await until(() =>
        messages.some(
          (m) => m.type === "notice" && m.message === "Jog input expired",
        )
          ? true
          : undefined,
      );
      await until(() => (latest()?.state === "IDLE" ? true : undefined));
      assert.equal(latest()!.step_velocity_pulses_s, 0);
      assert.equal(
        (await request("jog", { velocity_pulses_s: 200 })).code,
        "NOT_CONTROL_OWNER",
      );
      assert.equal((await request("acquire_control")).ok, true);
      assert.equal((await request("sim_reset")).ok, true);
      await until(() =>
        latest()?.step_position_pulses === "0" ? true : undefined,
      );
      const observer = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
      const replies: Message[] = [];
      observer.on("message", (data) => replies.push(JSON.parse(String(data))));
      await once(observer, "open");
      observer.send(JSON.stringify({ v: 1, type: "acquire_control", id: 1 }));
      assert.equal(
        (
          await until(() =>
            replies.find((m) => m.type === "result" && m.id === 1),
          )
        ).code,
        "BUSY",
      );
      observer.close();
      assert.equal(
        (
          await request("sim_state", {
            angle_rad: 0.1,
            angular_velocity_rad_s: 0,
            position_pulses: "9499",
            velocity_pulses_s: 16000,
            paused: false,
          })
        ).ok,
        true,
      );
      await until(() =>
        latest()?.step_position_pulses === "9500" && latest()?.at_right_bound
          ? true
          : undefined,
      );
      assert.equal(latest()!.step_velocity_pulses_s, 0);
      assert.equal((await request("arm")).ok, true);
      await until(() => (latest()?.state === "ARMED" ? true : undefined));
      for (let i = 0; i < 4; i++) {
        assert.equal(
          (await request("jog", { velocity_pulses_s: -200 })).ok,
          true,
        );
        await new Promise((r) => setTimeout(r, 40));
      }
      assert.ok(
        Number(latest()!.step_position_pulses) < 9500 &&
          !latest()!.at_right_bound,
      );
      assert.equal((await request("disconnect")).ok, true);
      assert.equal(
        (await request("connect", { path: "native-simulation" })).ok,
        true,
      );
      assert.equal(
        (await request("jog", { velocity_pulses_s: 200 })).code,
        "NOT_CONTROL_OWNER",
      );
    } finally {
      clearInterval(heartbeat);
      ws.terminate();
      await app.close();
    }
  },
);

test("WebSocket rejects a foreign website Origin", async () => {
  const app = await createApp();
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const port = (app.server.address() as AddressInfo).port;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    origin: "https://untrusted.example",
  });
  try {
    await assert.rejects(once(ws, "open"));
  } finally {
    ws.terminate();
    await app.close();
  }
});
