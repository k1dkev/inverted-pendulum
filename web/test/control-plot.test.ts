import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CONTROL_MASK, controlTelemetry } from "../shared/control";
import { ControlPlot } from "../client/ControlPlot";
import { createApp } from "../server/app";
type Message = Record<string, any>;
async function until<T>(get: () => T | undefined, timeout = 3000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const result = get();
    if (result !== undefined) return result;
    if (Date.now() - start > timeout)
      throw Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
test("control trace preserves raw and limited u and hides stale inactive outputs", () => {
  const frame = {
    time_us: "12345678912345",
    sample_seq: 7,
    rate_hz: 25,
    values: { 6: 24000, 7: 10000, 13: 2, 14: 2 },
  };
  const point = controlTelemetry(frame);
  assert.equal(point.raw_u_mm_s2, 24000);
  assert.equal(point.limited_u_mm_s2, 10000);
  assert.equal(point.time_us, frame.time_us);
  for (const phase of [0, 3]) {
    const inactive = controlTelemetry({
      ...frame,
      values: { ...frame.values, 13: phase },
    });
    assert.equal(inactive.active, false);
    assert.equal(inactive.limited_u_mm_s2, null);
    assert.equal(inactive.raw_u_mm_s2, null);
  }
  assert.equal(
    controlTelemetry({ ...frame, values: { ...frame.values, 6: NaN } })
      .raw_u_mm_s2,
    null,
  );
  assert.equal(
    controlTelemetry({ ...frame, values: { ...frame.values, 13: 4 } }).active,
    true,
  );
  assert.equal(
    controlTelemetry({ ...frame, values: { ...frame.values, 14: 0 } }).active,
    false,
  );
});
test("overview control plot labels units, sampling, and both traces explicitly", () => {
  const markup = renderToStaticMarkup(
    createElement(ControlPlot, { samples: { current: [] }, available: true }),
  );
  assert.ok(markup.includes("Control effort · u"));
  assert.ok(markup.includes("mm/s²"));
  assert.ok(markup.includes("Limited u") && markup.includes("Raw u"));
  assert.ok(markup.includes("25 Hz") && markup.includes("100 Hz"));
  assert.ok(markup.includes("before the motor speed limit"));
});
test(
  "overview u subscription shares MCU diagnostics without changing personal lab selections",
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
        latest: (type: string) =>
          messages.filter((m) => m.type === type).at(-1),
      };
    };
    const owner = await open();
    let viewer: Awaited<ReturnType<typeof open>> | undefined,
      heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
      assert.equal(
        (await owner.request("connect", { path: "native-simulation" })).ok,
        true,
      );
      viewer = await open();
      assert.equal(
        (await viewer.request("control_subscribe", { enabled: "yes" })).code,
        "BAD_PAYLOAD",
      );
      assert.equal(
        (await viewer.request("control_subscribe", { enabled: true })).ok,
        true,
      );
      const idle = await until(() => viewer!.latest("control_telemetry"));
      assert.equal(idle.active, false);
      assert.equal(idle.raw_u_mm_s2, null);
      assert.equal(
        viewer.latest("telemetry_setup")!.subscription.mask,
        CONTROL_MASK,
      );
      assert.deepEqual(viewer.latest("telemetry_setup")!.channels, []);
      assert.equal(viewer.latest("telemetry_setup")!.rate_hz, 0);
      assert.equal(
        owner.messages.some((m) => m.type === "control_telemetry"),
        false,
      );
      assert.equal(
        (
          await owner.request("telemetry_subscribe", {
            channels: [8],
            rate_hz: 5,
          })
        ).ok,
        true,
      );
      assert.equal(
        owner.latest("telemetry_setup")!.subscription.mask,
        CONTROL_MASK | (1 << 8),
      );
      assert.deepEqual(owner.latest("telemetry_setup")!.channels, [8]);
      assert.equal((await owner.request("acquire_control")).ok, true);
      heartbeat = setInterval(() => {
        void owner.request("keepalive").catch(() => {});
      }, 40);
      assert.equal(
        (
          await owner.request("sim_state", {
            angle_rad: 0.01,
            angular_velocity_rad_s: 0,
            position_pulses: "0",
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
      assert.equal((await owner.request("arm")).ok, true);
      assert.equal((await owner.request("start_policy")).ok, true);
      const active = await until(() =>
        viewer!.latest("control_telemetry")?.active
          ? viewer!.latest("control_telemetry")
          : undefined,
      );
      assert.equal(active.policy_id, 2);
      assert.equal(active.rate_hz, 25);
      assert.ok(
        Number.isFinite(active.raw_u_mm_s2) &&
          Number.isFinite(active.limited_u_mm_s2),
      );
      assert.ok(Math.abs(active.limited_u_mm_s2) <= 10000);
      assert.equal(
        (
          await owner.request("telemetry_subscribe", {
            channels: [],
            rate_hz: 0,
          })
        ).ok,
        true,
      );
      assert.equal(
        owner.latest("telemetry_setup")!.subscription.mask,
        CONTROL_MASK,
      );
      const count = viewer.messages.filter(
        (m) => m.type === "control_telemetry",
      ).length;
      await until(() =>
        viewer!.messages.filter((m) => m.type === "control_telemetry").length >
        count
          ? true
          : undefined,
      );
      assert.equal((await owner.request("disarm")).ok, true);
      await until(() =>
        viewer!.latest("control_telemetry")?.active === false
          ? true
          : undefined,
      );
      assert.equal(viewer.latest("control_telemetry")!.limited_u_mm_s2, null);
      assert.equal(
        (await viewer.request("control_subscribe", { enabled: false })).ok,
        true,
      );
      assert.equal(owner.latest("telemetry_setup")!.subscription.mask, 0);
      assert.equal(owner.latest("telemetry_setup")!.subscription.rate_hz, 0);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      owner.ws.terminate();
      viewer?.ws.terminate();
      await app.close();
    }
  },
);
