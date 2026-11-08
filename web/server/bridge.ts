import { randomBytes } from "node:crypto";
import { WebSocket } from "ws";
import { Transport } from "./transport";
import {
  Parser,
  Type,
  encode,
  capabilities,
  telemetry,
  results,
  states,
  type Packet,
  type Capabilities,
  type Telemetry,
} from "./protocol";

type Pending = {
  resolve: (p: Packet) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type Client = {
  socket: WebSocket;
  lastId: number;
  window: number;
  count: number;
};
export class Bridge {
  readonly clients = new Set<Client>();
  private transport?: Transport;
  private parser = new Parser();
  private session = 0n;
  private requestId = 0;
  private pending = new Map<number, Pending>();
  private owner?: Client;
  private latest?: Telemetry;
  private caps?: Capabilities;
  private receivedAt = 0;
  private lastIntent = 0;
  private lastPresence = 0;
  private jogging = false;
  private connecting = false;
  private path = "";
  private link = "disconnected";
  private interval: ReturnType<typeof setInterval>;
  private closing = false;
  constructor(readonly mock = false) {
    this.interval = setInterval(() => this.checkHealth(), 25);
  }
  private send(client: Client, data: Record<string, unknown>) {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    if (client.socket.bufferedAmount > 65536) {
      if (this.owner === client) this.revoke("Browser is backlogged");
      client.socket.terminate();
      return;
    }
    client.socket.send(JSON.stringify({ v: 1, ...data }));
  }
  private broadcast(data: Record<string, unknown>) {
    for (const client of this.clients) this.send(client, data);
  }
  private status() {
    for (const client of this.clients)
      this.send(client, {
        type: "connection",
        serial: this.link,
        path: this.path,
        control:
          this.owner === client ? "owned" : this.owner ? "other" : "available",
        capabilities: this.caps ?? null,
        session_id: this.session.toString(16).padStart(16, "0"),
        parser_errors: this.parser.errors,
      });
  }
  private result(
    client: Client,
    id: number,
    ok: boolean,
    code = "OK",
    source = "bridge",
  ) {
    this.send(client, { type: "result", id, ok, code, source });
  }
  add(socket: WebSocket) {
    const client: Client = { socket, lastId: 0, window: Date.now(), count: 0 };
    this.clients.add(client);
    this.status();
    if (this.latest) this.send(client, { type: "telemetry", ...this.latest });
    socket.on("message", (raw, isBinary) => {
      if (isBinary) {
        this.result(client, 0, false, "JSON_REQUIRED");
        return;
      }
      void this.message(client, String(raw));
    });
    socket.on("close", () => {
      this.clients.delete(client);
      if (this.owner === client) this.revoke("Browser disconnected");
    });
    socket.on("error", () => {
      if (this.owner === client) this.revoke("WebSocket error");
    });
  }
  private async message(client: Client, raw: string) {
    let id = 0;
    try {
      const now = Date.now();
      if (now - client.window >= 1000) {
        client.window = now;
        client.count = 0;
      }
      if (++client.count > 80) {
        if (this.owner === client) this.revoke("Command rate exceeded");
        throw Error("RATE_LIMIT");
      }
      const m = JSON.parse(raw) as Record<string, unknown>;
      if (
        !m ||
        m.v !== 1 ||
        typeof m.type !== "string" ||
        !Number.isSafeInteger(m.id) ||
        Number(m.id) <= client.lastId
      )
        throw Error("BAD_REQUEST");
      id = Number(m.id);
      client.lastId = id;
      if (m.type === "connect") {
        if (
          this.connecting ||
          this.transport ||
          (this.owner && this.owner !== client)
        )
          throw Error("BUSY");
        if (typeof m.path !== "string") throw Error("BAD_PATH");
        await this.connect(m.path);
        this.result(client, id, true);
        return;
      }
      if (m.type === "acquire_control") {
        if (this.link !== "connected") throw Error("NOT_CONNECTED");
        if (this.owner && this.owner !== client) throw Error("BUSY");
        this.owner = client;
        this.lastPresence = Date.now();
        this.status();
        this.result(client, id, true);
        return;
      }
      if (this.owner !== client) throw Error("NOT_CONTROL_OWNER");
      if (m.type === "release_control") {
        this.revoke("Control released");
        this.result(client, id, true);
        return;
      }
      if (m.type === "disconnect") {
        await this.disconnect();
        this.result(client, id, true);
        return;
      }
      if (this.link !== "connected") throw Error("NOT_CONNECTED");
      this.lastPresence = Date.now();
      const empty = Buffer.alloc(0);
      let type: number;
      let payload = empty;
      const commands: Record<string, number> = {
        arm: Type.ARM,
        stop: Type.STOP,
        disarm: Type.DISARM,
        clear_fault: Type.CLEAR_FAULT,
        zero_position: Type.ZERO,
        sim_reset: Type.SIM_RESET,
        keepalive: Type.KEEPALIVE,
      };
      if (m.type === "set_acceleration") {
        const acceleration = m.acceleration_pulses_s2;
        // For now only the simulation firmware advertises editable acceleration.
        if (!this.caps?.simulation) throw Error("UNSUPPORTED");
        if (
          typeof acceleration !== "number" ||
          !Number.isFinite(acceleration) ||
          acceleration < 50 ||
          acceleration > 500000
        )
          throw Error("LIMIT_EXCEEDED");
        type = Type.SET_ACCELERATION;
        payload = Buffer.alloc(4);
        payload.writeFloatLE(acceleration);
      } else if (m.type === "jog") {
        if (
          typeof m.velocity_pulses_s !== "number" ||
          !Number.isFinite(m.velocity_pulses_s) ||
          Math.abs(m.velocity_pulses_s) > (this.caps?.max_velocity ?? 0)
        )
          throw Error("LIMIT_EXCEEDED");
        if (
          !this.latest ||
          !["ARMED", "RUNNING"].includes(this.latest.state) ||
          Date.now() - this.receivedAt > 250
        )
          throw Error("WRONG_STATE");
        this.lastIntent = Date.now();
        this.jogging = true;
        type = Type.VELOCITY;
        payload = Buffer.alloc(4);
        payload.writeFloatLE(m.velocity_pulses_s);
      } else if (m.type === "sim_pause") {
        if (typeof m.paused !== "boolean") throw Error("BAD_PAYLOAD");
        type = Type.SIM_PAUSE;
        payload = Buffer.from([m.paused ? 1 : 0]);
      } else if (m.type === "sim_state") {
        const angle = m.angle_rad,
          omega = m.angular_velocity_rad_s,
          velocity = m.velocity_pulses_s;
        if (
          typeof angle !== "number" ||
          !Number.isFinite(angle) ||
          Math.abs(angle) > Math.PI ||
          typeof omega !== "number" ||
          !Number.isFinite(omega) ||
          Math.abs(omega) > 50 ||
          typeof velocity !== "number" ||
          !Number.isFinite(velocity) ||
          Math.abs(velocity) > (this.caps?.max_velocity ?? 0) ||
          typeof m.position_pulses !== "string" ||
          !/^-?\d{1,13}$/.test(m.position_pulses) ||
          typeof m.paused !== "boolean"
        )
          throw Error("BAD_PAYLOAD");
        const position = BigInt(m.position_pulses);
        if (position < -1000000000000n || position > 1000000000000n)
          throw Error("LIMIT_EXCEEDED");
        type = Type.SIM_STATE;
        payload = Buffer.alloc(24);
        payload.writeFloatLE(angle, 0);
        payload.writeFloatLE(omega, 4);
        payload.writeBigInt64LE(position, 8);
        payload.writeFloatLE(velocity, 16);
        payload[20] = m.paused ? 1 : 0;
      } else {
        type = commands[m.type];
        if (type === undefined) throw Error("UNSUPPORTED");
      }
      if (m.type.startsWith("sim_") && !this.caps?.simulation)
        throw Error("SIMULATION_ONLY");
      if (m.type === "stop" || m.type === "disarm") {
        this.jogging = false;
      }
      const reply = await this.request(type, payload);
      const code =
        reply.type === Type.RESPONSE ? reply.payload.readUInt16LE(4) : 0;
      if (code && m.type === "jog")
        this.revoke(results[code] ?? "DEVICE_REJECTED");
      if (code === 0 && m.type === "set_acceleration") {
        const config = await this.request(Type.GET_CONFIG);
        if (config.type !== Type.HELLO_INFO) throw Error("CONFIG_READ_FAILED");
        this.caps = capabilities(config.payload);
        this.status();
      }
      this.result(
        client,
        id,
        code === 0,
        results[code] ?? `ERROR_${code}`,
        "stm32",
      );
    } catch (error) {
      this.result(
        client,
        id,
        false,
        error instanceof Error ? error.message : "ERROR",
      );
    }
  }
  private async connect(path: string) {
    this.connecting = true;
    this.path = path;
    this.link = "connecting";
    this.latest = undefined;
    this.caps = undefined;
    this.parser = new Parser();
    this.session = randomBytes(8).readBigUInt64LE() || 1n;
    this.requestId = 0;
    const transport = new Transport();
    this.transport = transport;
    this.status();
    transport.on("data", (bytes: Buffer) => {
      for (const packet of this.parser.push(bytes)) this.receive(packet);
    });
    transport.on("lost", (error: Error) => {
      if (this.transport === transport) void this.disconnect(error.message);
    });
    try {
      await transport.open(path, this.mock);
      transport.write(Buffer.from([0]));
      const hello = Buffer.alloc(8);
      hello.writeBigUInt64LE(this.session);
      const reply = await this.request(Type.HELLO, hello, 0n, 1000);
      if (reply.type !== Type.HELLO_INFO)
        throw Error(
          reply.type === Type.RESPONSE
            ? (results[reply.payload.readUInt16LE(4)] ?? "HELLO_REJECTED")
            : "HELLO_REJECTED",
        );
      this.caps = capabilities(reply.payload);
      this.link = "connected";
      this.receivedAt = Date.now();
      this.status();
    } catch (error) {
      await this.disconnect(
        error instanceof Error ? error.message : "Connection failed",
      );
      throw error;
    } finally {
      this.connecting = false;
    }
  }
  private request(
    type: number,
    payload = Buffer.alloc(0),
    session = this.session,
    timeout = 250,
  ): Promise<Packet> {
    if (!this.transport || this.pending.size >= 8)
      return Promise.reject(Error("SERIAL_BUSY"));
    const id = ++this.requestId;
    if (id > 0xffffffff) return Promise.reject(Error("SESSION_EXHAUSTED"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error("DEVICE_TIMEOUT"));
        if (type !== Type.STOP) this.revoke("Device command timed out");
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.transport!.write(encode({ type, id, session, payload }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  private receive(packet: Packet) {
    if (packet.session !== this.session) return;
    try {
      if (packet.type === Type.TELEMETRY) {
        this.latest = telemetry(packet.payload, packet.session);
        this.receivedAt = Date.now();
        this.broadcast({ type: "telemetry", ...this.latest });
        return;
      }
      if (packet.type === Type.EVENT && packet.payload.length === 16) {
        this.broadcast({
          type: "event",
          code: packet.payload.readUInt16LE(8),
          state: states[packet.payload[10]],
          fault_bits: packet.payload.readUInt32LE(12),
        });
        return;
      }
      const expectedLength =
        packet.type === Type.RESPONSE
          ? 8
          : packet.type === Type.HELLO_INFO
            ? 48
            : packet.type === Type.STATUS
              ? 68
              : 0;
      if (!expectedLength || packet.payload.length !== expectedLength) return;
      const id = packet.payload.readUInt32LE(0),
        pending = this.pending.get(id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(id);
        pending.resolve(packet);
      }
    } catch {
      this.parser.errors++;
    }
  }
  private revoke(reason: string) {
    const hadControl = !!this.owner;
    this.owner = undefined;
    this.jogging = false;
    if (hadControl && this.transport && this.link === "connected")
      void this.request(Type.DISARM).catch(() => {});
    if (hadControl) {
      this.broadcast({ type: "notice", message: reason });
      this.status();
    }
  }
  private checkHealth() {
    if (this.closing) return;
    if (this.jogging && Date.now() - this.lastIntent > 150)
      this.revoke("Jog input expired");
    if (this.owner && Date.now() - this.lastPresence > 150)
      this.revoke("Control heartbeat expired");
    if (
      this.owner &&
      this.link === "connected" &&
      Date.now() - this.receivedAt > 250
    )
      this.revoke("Telemetry is stale");
  }
  async disconnect(reason = "Disconnected") {
    this.revoke(reason);
    this.link = "disconnected";
    this.latest = undefined;
    this.caps = undefined;
    const transport = this.transport;
    this.transport = undefined;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("DISCONNECTED"));
    }
    this.pending.clear();
    await transport?.close();
    this.broadcast({ type: "notice", message: reason });
    this.status();
  }
  async close() {
    this.closing = true;
    clearInterval(this.interval);
    await this.disconnect();
    for (const c of this.clients) c.socket.terminate();
  }
}
