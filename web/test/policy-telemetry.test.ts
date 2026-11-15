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
    const value = get();
    if (value !== undefined) return value;
    if (Date.now() - start > timeout)
      throw Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
test(
  "MCU-discovered policies and sparse telemetry work through the full bridge",
  { timeout: 15000 },
  async () => {
    const app = await createApp({ mock: true });
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
    const port = (app.server.address() as AddressInfo).port,
      origin = `http://127.0.0.1:${port}`;
    const open = async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
      const messages: Message[] = [];
      let id = 0;
      ws.on("message", (raw) => messages.push(JSON.parse(String(raw))));
      await once(ws, "open");
      return {
        ws,
        messages,
        latest: (type: string) =>
          messages.filter((m) => m.type === type).at(-1),
        request: async (type: string, fields: Message = {}) => {
          const requestId = ++id;
          ws.send(JSON.stringify({ v: 1, id: requestId, type, ...fields }));
          return until(() =>
            messages.find((m) => m.type === "result" && m.id === requestId),
          );
        },
      };
    };
    const owner = await open();
    let reader: Awaited<ReturnType<typeof open>> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
      assert.equal(
        (await owner.request("connect", { path: "native-simulation" })).ok,
        true,
      );
      const connection = owner.latest("connection")!;
      assert.deepEqual(
        connection.policies.map((p: Message) => p.name),
        ["manual", "swingup_lqr_v1", "swingup_lqr_v2", "swingup_lqr_v3"],
      );
      assert.equal(owner.latest("telemetry_setup")!.catalog.length, 30);
      assert.equal(owner.latest("telemetry_setup")!.subscription.mask, 0);
      reader = await open();
      assert.equal((await reader.request("get_telemetry_setup")).ok, true); // no motion ownership required
      assert.equal(
        (
          await reader.request("telemetry_subscribe", {
            channels: [0, 8],
            rate_hz: 10,
          })
        ).ok,
        true,
      );
      const first = await until(() => reader!.latest("selected_telemetry"));
      assert.deepEqual(Object.keys(first.values), ["0", "8"]);
      assert.equal(first.values[8], null); // legacy diagnostics unavailable in Manual
      assert.equal(
        (
          await owner.request("telemetry_subscribe", {
            channels: [3, 16],
            rate_hz: 25,
          })
        ).ok,
        true,
      );
      const setup = owner.latest("telemetry_setup")!;
      assert.equal(
        setup.subscription.mask,
        (1 << 0) | (1 << 8) | (1 << 3) | (1 << 16),
      );
      assert.equal(setup.subscription.rate_hz, 25);
      const ownFrame = await until(() => owner.latest("selected_telemetry"));
      assert.deepEqual(Object.keys(ownFrame.values), ["3", "16"]);
      assert.ok(Math.abs(ownFrame.values[16] - 0.00267683) < 1e-9);
      const baselineBefore = owner.messages.filter(
        (m) => m.type === "telemetry",
      ).length;
      await new Promise((resolve) => setTimeout(resolve, 250));
      assert.ok(
        owner.messages.filter((m) => m.type === "telemetry").length >=
          baselineBefore + 5,
      );
      assert.deepEqual(
        Object.keys(reader.latest("selected_telemetry")!.values),
        ["0", "8"],
      );
      assert.equal(
        (
          await reader.request("telemetry_subscribe", {
            channels: [31],
            rate_hz: 10,
          })
        ).code,
        "UNKNOWN_CHANNEL",
      );
      assert.equal(
        (await reader.request("start_policy")).code,
        "NOT_CONTROL_OWNER",
      );
      assert.equal((await owner.request("acquire_control")).ok, true);
      heartbeat = setInterval(() => {
        void owner.request("keepalive").catch(() => {});
      }, 40);
      assert.equal(
        (await owner.request("select_policy", { policy_id: 9 })).code,
        "UNKNOWN_POLICY",
      );
      assert.equal(
        (await owner.request("select_policy", { policy_id: 1 })).ok,
        true,
      );
      assert.equal((await owner.request("start_policy")).code, "WRONG_STATE");
      assert.equal(
        (
          await owner.request("sim_state", {
            angle_rad: 0,
            angular_velocity_rad_s: 0,
            position_pulses: "0",
            velocity_pulses_s: 0,
            paused: false,
          })
        ).ok,
        true,
      );
      assert.equal((await owner.request("arm")).ok, true);
      assert.equal((await owner.request("start_policy")).ok, true);
      await until(() =>
        owner.latest("policy_status")?.policy.phase_name === "LQR"
          ? true
          : undefined,
      );
      assert.equal(
        (await owner.request("jog", { velocity_pulses_s: 100 })).code,
        "WRONG_STATE",
      );
      await until(() =>
        reader!.latest("selected_telemetry")?.values[8] != null
          ? true
          : undefined,
      );
      assert.equal(
        (await owner.request("select_policy", { policy_id: 0 })).ok,
        true,
      );
      await until(() => {
        const telemetry = owner.latest("telemetry"),
          connection = owner.latest("connection");
        if (telemetry?.state === "FAULT" || connection?.control !== "owned")
          throw Error(
            `Manual handoff failed: ${JSON.stringify({ telemetry, connection })}`,
          );
        return telemetry?.state === "ARMED" ? true : undefined;
      });
      await until(() =>
        reader!.latest("selected_telemetry")?.values[8] === null
          ? true
          : undefined,
      );
      assert.equal((await owner.request("disarm")).ok, true);
      // Select a domain-invalid swing-up state; the explicit policy fault reaches the UI.
      assert.equal(
        (
          await owner.request("sim_state", {
            angle_rad: 3.14,
            angular_velocity_rad_s: 0,
            position_pulses: "7550",
            velocity_pulses_s: 0,
            paused: false,
          })
        ).ok,
        true,
      );
      assert.equal(
        (await owner.request("select_policy", { policy_id: 1 })).ok,
        true,
      );
      assert.equal((await owner.request("arm")).ok, true);
      assert.equal((await owner.request("start_policy")).ok, true);
      await until(() =>
        owner.latest("telemetry")?.state === "FAULT" ? true : undefined,
      );
      await until(() =>
        owner.latest("policy_status")?.policy.error_code === 1
          ? true
          : undefined,
      );
      assert.equal(owner.latest("telemetry")!.step_velocity_pulses_s, 0);
      assert.equal(
        (
          await reader.request("telemetry_subscribe", {
            channels: [],
            rate_hz: 0,
          })
        ).ok,
        true,
      );
      assert.equal(
        owner.latest("telemetry_setup")!.subscription.mask,
        (1 << 3) | (1 << 16),
      );
      assert.equal(
        (
          await owner.request("telemetry_subscribe", {
            channels: [],
            rate_hz: 0,
          })
        ).ok,
        true,
      );
      assert.equal(owner.latest("telemetry_setup")!.subscription.rate_hz, 0);
      const optionalCount = owner.messages.filter(
        (m) => m.type === "selected_telemetry",
      ).length;
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(
        owner.messages.filter((m) => m.type === "selected_telemetry").length,
        optionalCount,
      );
      // The new policy is selectable through the same API and recenters instead
      // of faulting at the old logarithm boundary. Its channels stay valid.
      assert.equal((await owner.request("clear_fault")).ok, true);
      assert.equal(
        (
          await owner.request("sim_state", {
            angle_rad: 3.14,
            angular_velocity_rad_s: 0,
            position_pulses: "7550",
            velocity_pulses_s: 0,
            paused: false,
          })
        ).ok,
        true,
      );
      assert.equal(
        (await owner.request("select_policy", { policy_id: 2 })).ok,
        true,
      );
      assert.equal(
        (
          await owner.request("telemetry_subscribe", {
            channels: [15, 24],
            rate_hz: 25,
          })
        ).ok,
        true,
      );
      assert.equal((await owner.request("arm")).ok, true);
      assert.equal((await owner.request("start_policy")).ok, true);
      await until(() =>
        owner.latest("policy_status")?.policy.phase_name === "RECENTER"
          ? true
          : undefined,
      );
      const diagnostic = await until(() => {
        const frame = owner.latest("selected_telemetry");
        return frame?.values[24] === 0 && frame?.values[15] != null
          ? frame
          : undefined;
      });
      assert.deepEqual(Object.keys(diagnostic.values), ["15", "24"]);
      await until(() => {
        const telemetry = owner.latest("telemetry");
        if (telemetry?.state === "FAULT")
          throw Error(`Recenter fault: ${JSON.stringify(telemetry)}`);
        return owner.latest("policy_status")?.policy.phase_name === "SWING_UP"
          ? true
          : undefined;
      });
      assert.equal(owner.latest("telemetry")!.fault_bits, 0);
      assert.equal(owner.latest("telemetry")!.state, "RUNNING");
      assert.equal((await owner.request("disarm")).ok, true);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      owner.ws.terminate();
      reader?.ws.terminate();
      await app.close();
    }
  },
);
