import { randomBytes } from "node:crypto";
import { WebSocket } from "ws";
import type { VirtualSerialSimulator } from "./virtual-serial";
import { Transport } from "./transport";
import { LogStore, deviceLog } from "./logging";
import { COMMAND_HELP, parseCommand } from "../shared/commands";
import type { LogLevel, LogSource } from "../shared/logging";
import {
  Parser,
  Type,
  encode,
  capabilities,
  telemetry,
  policyDescriptor,
  policyStatus,
  telemetryDescriptor,
  subscription,
  selectedTelemetry,
  simulationParameters,
  results,
  states,
  type Packet,
  type Capabilities,
  type Telemetry,
  type SimulationParameters,
  type PolicyDescriptor,
  type PolicyStatus,
  type TelemetryChannel,
  type Subscription,
} from "./protocol";

type Pending = {
  resolve: (p: Packet) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type Client = {
  id: number;
  commands: Map<number, { name: string; args: string }>;
  socket: WebSocket;
  lastId: number;
  window: number;
  count: number;
  selectedMask: number;
  selectedRate: number;
  nextSelectedUs: bigint;
};
export class Bridge {
  readonly clients = new Set<Client>();
  private transport?: Transport;
  private logs = new LogStore();
  private nextClientId = 0;
  private motionGeneration = 0;
  private logConfig?: { level: number; dropped: number };
  private consoleJog?: {
    client: Client;
    velocity: number;
    end: number;
    next: number;
    busy: boolean;
  };
  private lastParserErrors = 0;
  logsNDJSON() {
    return this.logs.ndjson();
  }
  private log(
    level: LogLevel,
    source: LogSource,
    message: string,
    fields: Record<string, unknown> = {},
  ) {
    const entry = this.logs.append({
      level,
      source,
      message,
      fields,
      session_id: this.session
        ? this.session.toString(16).padStart(16, "0")
        : undefined,
    });
    this.broadcast({ type: "log", entry });
  }
  private readLogConfig(p: Buffer) {
    if (p.length !== 12) throw Error("Invalid log configuration");
    this.logConfig = { level: p[4], dropped: p.readUInt32LE(8) };
    return this.logConfig;
  }
  private parser = new Parser();
  private session = 0n;
  private requestId = 0;
  private pending = new Map<number, Pending>();
  private owner?: Client;
  private latest?: Telemetry;
  private caps?: Capabilities;
  private simulationParameters?: SimulationParameters;
  private policies: PolicyDescriptor[] = [];
  private policy?: PolicyStatus;
  private catalog: TelemetryChannel[] = [];
  private subscription?: Subscription;
  private subscriptionWork: Promise<void> = Promise.resolve();
  private subscriptionQueued = 0;
  private receivedAt = 0;
  private lastIntent = 0;
  private lastPresence = 0;
  private jogging = false;
  private connecting = false;
  private path = "";
  private link = "disconnected";
  private interval: ReturnType<typeof setInterval>;
  private closing = false;
  constructor(
    readonly mock = false,
    readonly virtualSerial?: VirtualSerialSimulator,
  ) {
    virtualSerial?.on("lost", (error: Error, path?: string) => {
      if (this.closing) return;
      this.log("error", "bridge", error.message);
      if (this.path === path && this.link !== "disconnected")
        void this.disconnect(error.message);
      else this.status();
    });
    this.interval = setInterval(() => this.checkHealth(), 25);
  }
  private send(client: Client, data: Record<string, unknown>) {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    if (client.socket.bufferedAmount > 65536) {
      client.socket.terminate();
      if (this.owner === client) this.revoke("Browser is backlogged");
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
        simulation_runner:
          this.path === "native-simulation"
            ? "native-pipe"
            : this.virtualSerial?.port?.path === this.path
              ? "native-pty"
              : "stm32",
        control:
          this.owner === client ? "owned" : this.owner ? "other" : "available",
        capabilities: this.caps ?? null,
        simulation_parameters: this.simulationParameters ?? null,
        policies: this.policies,
        policy: this.policy ?? null,
        logging: this.logConfig ?? null,
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
    const command = client.commands.get(id);
    client.commands.delete(id);
    if (command)
      this.log(ok ? "info" : "warn", "command", `${command.name}: ${code}`, {
        client_id: client.id,
        request_id: id,
        source,
        arguments: command.args,
      });
    if (!command && !ok)
      this.log("warn", "command", "Request rejected", {
        client_id: client.id,
        request_id: id,
        source,
        code,
      });
    this.send(client, { type: "result", id, ok, code, source });
  }
  add(socket: WebSocket) {
    const client: Client = {
      id: ++this.nextClientId,
      commands: new Map(),
      socket,
      lastId: 0,
      window: Date.now(),
      count: 0,
      selectedMask: 0,
      selectedRate: 0,
      nextSelectedUs: 0n,
    };
    this.clients.add(client);
    this.status();
    this.telemetrySetup(client);
    this.send(client, {
      type: "log_history",
      entries: this.logs.recent(),
      capacity: 1000,
    });
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
      if (this.link === "connected" && !this.closing)
        void this.updateSubscription().catch(() => {});
      if (this.owner === client) this.revoke("Browser disconnected");
    });
    socket.on("error", () => {
      if (this.owner === client) this.revoke("WebSocket error");
    });
  }
  private async message(client: Client, raw: string) {
    let id = 0,
      jogGeneration = 0;
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
      const m = JSON.parse(raw) as Record<string, unknown> & { type: string };
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
      if (m.type !== "keepalive" && m.type !== "jog")
        client.commands.set(id, {
          name: m.type.slice(0, 64),
          args: JSON.stringify(m).slice(0, 256),
        });
      if (m.type === "console_command") {
        if (typeof m.line !== "string") throw Error("INVALID_COMMAND_LINE");
        const command = parseCommand(m.line);
        Object.assign(m, command.fields, { type: command.type });
      }
      if (m.type === "console_help") {
        this.send(client, { type: "console_output", id, data: COMMAND_HELP });
        this.result(client, id, true);
        return;
      }
      if (
        [
          "console_status",
          "console_config",
          "console_policy_status",
          "console_log_config",
          "console_policies",
          "console_catalog",
        ].includes(m.type)
      ) {
        if (this.link !== "connected") throw Error("NOT_CONNECTED");
        let data: unknown;
        if (m.type === "console_policies") data = this.policies;
        else if (m.type === "console_catalog") data = this.catalog;
        else if (m.type === "console_status") {
          const reply = await this.request(Type.GET_STATUS);
          if (reply.type !== Type.STATUS) throw Error("STATUS_READ_FAILED");
          data = telemetry(reply.payload.subarray(4), this.session);
        } else if (m.type === "console_config") {
          const reply = await this.request(Type.GET_CONFIG);
          if (reply.type !== Type.HELLO_INFO) throw Error("CONFIG_READ_FAILED");
          data = capabilities(reply.payload);
        } else if (m.type === "console_policy_status") {
          const reply = await this.request(Type.GET_POLICY);
          if (reply.type !== Type.POLICY_STATUS)
            throw Error("POLICY_READ_FAILED");
          data = policyStatus(reply.payload);
        } else {
          if (!(this.caps!.bits & 64)) throw Error("UNSUPPORTED");
          const reply = await this.request(Type.GET_LOG_CONFIG);
          if (reply.type !== Type.LOG_CONFIG)
            throw Error("LOG_CONFIG_READ_FAILED");
          data = this.readLogConfig(reply.payload);
        }
        this.send(client, { type: "console_output", id, data });
        this.result(client, id, true);
        return;
      }
      if (m.type === "console_select_policy") {
        const selected = this.policies.find(
          (p) => p.name === m.policy || String(p.id) === m.policy,
        );
        if (!selected) throw Error("UNKNOWN_POLICY");
        m.type = "select_policy";
        m.policy_id = selected.id;
      }
      if (
        ["console_acceleration", "console_sim_state", "console_jog"].includes(
          m.type,
        )
      ) {
        const scale = this.caps?.mm_per_pulse;
        if (!scale || !Number.isFinite(scale) || scale <= 0)
          throw Error("MOTION_SCALE_UNAVAILABLE");
        if (m.type === "console_acceleration") {
          m.type = "set_acceleration";
          m.acceleration_pulses_s2 = Math.round(
            Number(m.acceleration_mm_s2) / scale,
          );
        } else if (m.type === "console_sim_state") {
          m.type = "sim_state";
          m.position_pulses = String(Math.round(Number(m.position_mm) / scale));
          m.velocity_pulses_s = Number(m.velocity_mm_s) / scale;
        } else {
          m.type = "jog";
          m.velocity_pulses_s = Number(m.velocity_mm_s) / scale;
        }
      }
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
        this.log("info", "bridge", "Control acquired", {
          client_id: client.id,
        });
        this.status();
        this.result(client, id, true);
        return;
      }
      if (m.type === "get_telemetry_setup") {
        if (this.link !== "connected") throw Error("NOT_CONNECTED");
        const reply = await this.request(Type.GET_SUBSCRIPTION);
        this.subscription = subscription(reply.payload);
        this.telemetrySetup(client);
        this.send(client, {
          type: "console_output",
          id,
          data: { catalog: this.catalog, subscription: this.subscription },
        });
        this.result(client, id, true);
        return;
      }
      if (m.type === "telemetry_subscribe") {
        if (this.link !== "connected") throw Error("NOT_CONNECTED");
        if (
          !Array.isArray(m.channels) ||
          m.channels.length > 32 ||
          typeof m.rate_hz !== "number" ||
          ![0, 5, 10, 25].includes(m.rate_hz)
        )
          throw Error("BAD_PAYLOAD");
        let mask = 0;
        for (const channel of m.channels) {
          if (
            !Number.isInteger(channel) ||
            !this.catalog.some((c) => c.id === channel)
          )
            throw Error("UNKNOWN_CHANNEL");
          mask |= 1 << channel;
        }
        if (this.subscriptionQueued >= 8) throw Error("BUSY");
        client.selectedMask = mask >>> 0;
        client.selectedRate = Number(m.rate_hz);
        client.nextSelectedUs = 0n;
        await this.updateSubscription();
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
        start_policy: Type.START_POLICY,
      };
      if (m.type === "set_log_level") {
        if (!((this.caps?.bits ?? 0) & 64)) throw Error("UNSUPPORTED");
        if (
          typeof m.level !== "number" ||
          ![0, 10, 20, 30, 40].includes(m.level)
        )
          throw Error("BAD_PAYLOAD");
        type = Type.SET_LOG_LEVEL;
        payload = Buffer.from([m.level]);
      } else if (m.type === "select_policy") {
        if (
          !Number.isInteger(m.policy_id) ||
          !this.policies.some((p) => p.id === m.policy_id)
        )
          throw Error("UNKNOWN_POLICY");
        type = Type.SELECT_POLICY;
        payload = Buffer.alloc(2);
        payload.writeUInt16LE(Number(m.policy_id));
        this.jogging = false;
        this.consoleJog = undefined;
        ++this.motionGeneration;
      } else if (m.type === "set_acceleration") {
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
          (this.policy?.id ?? 0) !== 0 ||
          !["ARMED", "RUNNING", "STOPPING"].includes(this.latest.state) ||
          this.latest.fault_bits !== 0 ||
          Date.now() - this.receivedAt > 250
        )
          throw Error("WRONG_STATE");
        this.consoleJog = undefined;
        jogGeneration = ++this.motionGeneration;
        this.lastIntent = Date.now();
        this.jogging = true;
        type = Type.VELOCITY;
        payload = Buffer.alloc(4);
        payload.writeFloatLE(m.velocity_pulses_s);
      } else if (m.type === "sim_parameters") {
        const inertia = m.inertia_kg_m2,
          damping = m.damping_n_m_s;
        if (
          typeof inertia !== "number" ||
          !Number.isFinite(inertia) ||
          inertia < 0.0001 ||
          inertia > 0.1 ||
          typeof damping !== "number" ||
          !Number.isFinite(damping) ||
          damping < 0 ||
          damping > 0.05
        )
          throw Error("LIMIT_EXCEEDED");
        type = Type.SIM_SET_PARAMETERS;
        payload = Buffer.alloc(8);
        payload.writeFloatLE(inertia, 0);
        payload.writeFloatLE(damping, 4);
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
        if (position < -9500n || position > 9500n)
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
        ++this.motionGeneration;
        this.jogging = false;
        this.consoleJog = undefined;
      }
      const reply = await this.request(type, payload);
      const code =
        reply.type === Type.RESPONSE ? reply.payload.readUInt16LE(4) : 0;
      if (code === 0 && m.type === "jog" && typeof m.duration_ms === "number") {
        // Only the parsed console grammar may request a timed jog.
        if (
          client.commands.get(id)?.name === "console_command" &&
          this.owner === client &&
          this.policy?.id === 0 &&
          jogGeneration === this.motionGeneration
        )
          this.consoleJog = {
            client,
            velocity: Number(m.velocity_pulses_s),
            end: Date.now() + m.duration_ms,
            next: Date.now() + 50,
            busy: false,
          };
      }
      if (code === 0 && m.type === "set_log_level") {
        this.send(client, {
          type: "console_output",
          id,
          data: this.readLogConfig(reply.payload),
        });
        this.status();
      }
      if (code && m.type === "jog")
        this.revoke(results[code] ?? "DEVICE_REJECTED");
      if (code === 0 && m.type === "set_acceleration") {
        const config = await this.request(Type.GET_CONFIG);
        if (config.type !== Type.HELLO_INFO) throw Error("CONFIG_READ_FAILED");
        this.caps = capabilities(config.payload);
        this.status();
      }
      if (code === 0 && m.type === "sim_parameters") {
        const params = await this.request(Type.SIM_GET_PARAMETERS);
        this.simulationParameters = simulationParameters(params.payload);
        this.status();
      }
      if (
        code === 0 &&
        [
          "select_policy",
          "start_policy",
          "stop",
          "disarm",
          "clear_fault",
        ].includes(m.type)
      ) {
        const current = await this.request(Type.GET_POLICY);
        this.policy = policyStatus(current.payload);
        this.broadcast({ type: "policy_status", policy: this.policy });
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
    this.simulationParameters = undefined;
    this.parser = new Parser();
    this.lastParserErrors = 0;
    this.session = randomBytes(8).readBigUInt64LE() || 1n;
    this.requestId = 0;
    this.log("info", "bridge", "Opening serial connection", { path });
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
      await transport.open(path, this.mock, this.virtualSerial?.port);
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
      if (this.caps.simulation) {
        const params = await this.request(Type.SIM_GET_PARAMETERS);
        this.simulationParameters = simulationParameters(params.payload);
      }
      if (this.caps.bits & 16) {
        this.policies = [];
        let count = 1;
        for (let i = 0; i < count; i++) {
          const payload = Buffer.alloc(2);
          payload.writeUInt16LE(i);
          const info = policyDescriptor(
            (await this.request(Type.LIST_POLICIES, payload)).payload,
          );
          if (info.count < 1 || info.count > 32 || info.index !== i)
            throw Error("INVALID_POLICY_CATALOG");
          count = info.count;
          this.policies.push(info.policy);
        }
        this.policy = policyStatus(
          (await this.request(Type.GET_POLICY)).payload,
        );
      }
      if (this.caps.bits & 32) {
        this.catalog = [];
        let count = 1;
        for (let i = 0; i < count; i++) {
          const payload = Buffer.alloc(2);
          payload.writeUInt16LE(i);
          const info = telemetryDescriptor(
            (await this.request(Type.TELEMETRY_CATALOG, payload)).payload,
          );
          if (
            info.version !== 1 ||
            info.count < 1 ||
            info.count > 32 ||
            info.channel.id !== i
          )
            throw Error("INVALID_TELEMETRY_CATALOG");
          count = info.count;
          this.catalog.push(info.channel);
        }
        this.subscription = subscription(
          (await this.request(Type.GET_SUBSCRIPTION)).payload,
        );
      }
      if (this.caps.bits & 64)
        this.readLogConfig((await this.request(Type.GET_LOG_CONFIG)).payload);
      this.link = "connected";
      this.log("info", "bridge", "Serial connection established", { path });
      this.receivedAt = Date.now();
      this.status();
      for (const client of this.clients) this.telemetrySetup(client);
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
  private telemetrySetup(client: Client) {
    this.send(client, {
      type: "telemetry_setup",
      catalog: this.catalog,
      subscription: this.subscription ?? null,
      channels: this.catalog
        .filter((c) => client.selectedMask & (1 << c.id))
        .map((c) => c.id),
      rate_hz: client.selectedRate,
    });
  }
  private updateSubscription(): Promise<void> {
    const current = this.transport,
      session = this.session;
    this.subscriptionQueued++;
    const work = this.subscriptionWork
      .catch(() => {})
      .then(async () => {
        if (!current || current !== this.transport || session !== this.session)
          throw Error("DISCONNECTED");
        let mask = 0,
          rate = 0;
        for (const client of this.clients)
          if (client.selectedRate && client.selectedMask) {
            mask |= client.selectedMask;
            rate = Math.max(rate, client.selectedRate);
          }
        const payload = Buffer.alloc(8);
        payload.writeUInt32LE(mask >>> 0);
        payload.writeUInt16LE(rate, 4);
        const reply = await this.request(Type.SUBSCRIBE, payload);
        if (reply.type !== Type.SUBSCRIPTION)
          throw Error("SUBSCRIPTION_REJECTED");
        this.subscription = subscription(reply.payload);
        for (const client of this.clients) this.telemetrySetup(client);
      });
    this.subscriptionWork = work;
    return work.finally(() => {
      this.subscriptionQueued--;
    });
  }
  private receive(packet: Packet) {
    if (packet.session !== this.session) return;
    try {
      if (packet.type === Type.LOG_RECORD) {
        const entry = this.logs.append({
          ...deviceLog(packet.payload),
          session_id: this.session.toString(16).padStart(16, "0"),
        });
        this.broadcast({ type: "log", entry });
        return;
      }
      if (packet.type === Type.POLICY_STATUS && packet.payload.length === 24) {
        this.policy = policyStatus(packet.payload);
        this.broadcast({ type: "policy_status", policy: this.policy });
      }
      if (packet.type === Type.SELECTED_TELEMETRY) {
        const frame = selectedTelemetry(packet.payload);
        if (
          frame.schema_version !== 1 ||
          frame.revision !== this.subscription?.revision
        )
          return;
        const stamp = BigInt(frame.time_us);
        for (const client of this.clients)
          if (
            client.selectedRate &&
            client.selectedMask &&
            stamp >= client.nextSelectedUs
          ) {
            const period = BigInt(Math.floor(1000000 / client.selectedRate));
            if (!client.nextSelectedUs) client.nextSelectedUs = stamp;
            client.nextSelectedUs +=
              ((stamp - client.nextSelectedUs) / period + 1n) * period;
            const values: Record<number, number | null> = {};
            for (const channel of this.catalog)
              if (client.selectedMask & (1 << channel.id))
                values[channel.id] = frame.values[channel.id] ?? null;
            this.send(client, {
              type: "selected_telemetry",
              time_us: frame.time_us,
              sample_seq: frame.sample_seq,
              revision: frame.revision,
              schema_version: frame.schema_version,
              values,
            });
          }
        return;
      }
      if (packet.type === Type.TELEMETRY) {
        this.latest = telemetry(packet.payload, packet.session);
        this.receivedAt = Date.now();
        this.broadcast({ type: "telemetry", ...this.latest });
        return;
      }
      if (packet.type === Type.EVENT && packet.payload.length === 16) {
        // State events precede command ACKs. Use that authoritative state for
        // immediate console commands without pretending a fresh sample arrived.
        if (this.latest)
          this.latest = {
            ...this.latest,
            state:
              states[packet.payload[10]] ?? `UNKNOWN_${packet.payload[10]}`,
            fault_bits: packet.payload.readUInt32LE(12),
          };
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
              : packet.type === Type.SIM_PARAMETERS
                ? 28
                : 0;
      const variable =
        packet.type === Type.POLICY_DESCRIPTOR ||
        packet.type === Type.TELEMETRY_DESCRIPTOR;
      const extra =
        packet.type === Type.LOG_CONFIG
          ? 12
          : packet.type === Type.POLICY_STATUS
            ? 24
            : packet.type === Type.SUBSCRIPTION
              ? 16
              : 0;
      if (
        variable
          ? packet.payload.length < 12
          : packet.payload.length !== (extra || expectedLength) ||
            !(extra || expectedLength)
      )
        return;
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
    ++this.motionGeneration;
    this.jogging = false;
    this.consoleJog = undefined;
    if (hadControl && this.transport && this.link === "connected")
      void this.request(Type.DISARM).catch(() => {});
    if (hadControl) {
      this.log("warn", "bridge", reason);
      this.broadcast({ type: "notice", message: reason });
      this.status();
    }
  }
  private checkHealth() {
    if (this.closing) return;
    const jog = this.consoleJog;
    if (jog) {
      if (
        this.owner !== jog.client ||
        this.link !== "connected" ||
        Date.now() - this.lastPresence > 150 ||
        Date.now() - this.receivedAt > 250
      ) {
        this.consoleJog = undefined;
        this.revoke("Timed jog heartbeat or telemetry expired");
      } else if (Date.now() >= jog.end) {
        this.consoleJog = undefined;
        this.jogging = false;
        void this.request(Type.STOP)
          .then((reply) => {
            if (reply.payload.readUInt16LE(4) !== 0)
              this.revoke("Timed jog stop rejected");
            else this.log("info", "bridge", "Timed jog finished");
          })
          .catch(() => this.revoke("Timed jog stop failed"));
      } else if (!jog.busy && Date.now() >= jog.next) {
        jog.busy = true;
        jog.next = Date.now() + 50;
        this.lastIntent = Date.now();
        const payload = Buffer.alloc(4);
        payload.writeFloatLE(jog.velocity);
        void this.request(Type.VELOCITY, payload)
          .then((reply) => {
            if (reply.payload.readUInt16LE(4) !== 0 && this.consoleJog === jog)
              this.revoke("Timed jog rejected");
          })
          .catch(() => this.revoke("Timed jog failed"))
          .finally(() => {
            jog.busy = false;
          });
      }
    }
    if (this.parser.errors !== this.lastParserErrors) {
      this.lastParserErrors = this.parser.errors;
      this.log("warn", "bridge", "Serial parser errors", {
        count: this.parser.errors,
      });
    }
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
    this.simulationParameters = undefined;
    this.logConfig = undefined;
    this.policies = [];
    this.policy = undefined;
    this.catalog = [];
    this.subscription = undefined;
    for (const client of this.clients) {
      client.selectedMask = 0;
      client.selectedRate = 0;
      client.nextSelectedUs = 0n;
      this.telemetrySetup(client);
    }
    const transport = this.transport;
    this.transport = undefined;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("DISCONNECTED"));
    }
    this.pending.clear();
    await transport?.close();
    this.log("info", "bridge", "Serial connection closed", { reason });
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
