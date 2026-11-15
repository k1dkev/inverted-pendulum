import { memo, useEffect, useRef, useState } from "react";
import { COMMAND_HELP } from "../shared/commands";
import type { LogRecord } from "../shared/logging";
import type { CommandEntry } from "./useDiagnostics";
export const ConsolePanel = memo(function ConsolePanel({
  logs,
  commands,
  submit,
  ready,
  owned,
}: {
  logs: LogRecord[];
  commands: CommandEntry[];
  submit: (line: string) => void;
  ready: boolean;
  owned: boolean;
}) {
  const [line, setLine] = useState(""),
    [history, setHistory] = useState<string[]>([]),
    [historyIndex, setHistoryIndex] = useState(-1);
  const [severity, setSeverity] = useState("all"),
    [source, setSource] = useState("all"),
    [search, setSearch] = useState(""),
    [follow, setFollow] = useState(true),
    [clearedThrough, setClearedThrough] = useState(0);
  const logEnd = useRef<HTMLDivElement>(null),
    commandEnd = useRef<HTMLDivElement>(null);
  const rank = { debug: 10, info: 20, warn: 30, error: 40 };
  const visible = logs.filter(
    (entry) =>
      entry.id > clearedThrough &&
      (severity === "all" || rank[entry.level] >= Number(severity)) &&
      (source === "all" || entry.source === source) &&
      `${entry.message} ${JSON.stringify(entry.fields)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  useEffect(() => {
    if (follow) {
      const parent = logEnd.current?.parentElement;
      if (parent) parent.scrollTop = parent.scrollHeight;
    }
  }, [logs, follow]);
  useEffect(() => {
    const parent = commandEnd.current?.parentElement;
    if (parent) parent.scrollTop = parent.scrollHeight;
  }, [commands]);
  useEffect(() => {
    if (logs.length && logs.at(-1)!.id < clearedThrough) setClearedThrough(0);
  }, [logs, clearedThrough]);
  return (
    <section
      className="diagnostics panel"
      aria-label="Logs and command console"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">DEVICE DIAGNOSTICS</p>
          <h2>Logs & command console</h2>
        </div>
        <a className="download-logs" href="/api/logs" download>
          Download logs · NDJSON
        </a>
      </div>
      <div className="diagnostics-grid">
        <section aria-label="Structured event log">
          <div className="diagnostic-filters">
            <label>
              Minimum severity
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
              >
                <option value="all">All levels</option>
                <option value="20">Info</option>
                <option value="30">Warning</option>
                <option value="40">Error</option>
              </select>
            </label>
            <label>
              Source
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                {["all", "mcu", "bridge", "command"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="log-search">
              Search
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Message or fields"
              />
            </label>
          </div>
          <div
            className="log-scroll"
            role="log"
            aria-label="Device and server events"
            aria-live="off"
          >
            {visible.length === 0 && (
              <p className="hint">
                No matching events. Connect a device or run a command.
              </p>
            )}
            {visible.map((entry) => (
              <details
                key={entry.id}
                className={`log-entry level-${entry.level}`}
              >
                <summary>
                  <time dateTime={entry.timestamp}>
                    {new Date(entry.timestamp).toLocaleTimeString(undefined, {
                      hour12: false,
                    })}
                  </time>
                  <span className="log-level">{entry.level}</span>
                  <span className="log-source">{entry.source}</span>
                  <span>{entry.message}</span>
                </summary>
                <pre>
                  {JSON.stringify(
                    {
                      timestamp: entry.timestamp,
                      session_id: entry.session_id,
                      device_time_us: entry.device_time_us,
                      ...entry.fields,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            ))}
            <div ref={logEnd} />
          </div>
          <div className="diagnostic-footer">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={follow}
                onChange={(event) => setFollow(event.target.checked)}
              />
              Follow latest
            </label>
            <button onClick={() => setClearedThrough(logs.at(-1)?.id ?? 0)}>
              Clear view
            </button>
            <span>{visible.length} shown · 1,000 retained</span>
          </div>
          <p className="hint">
            Events are separate from graph telemetry. A new browser receives the
            latest 50 server events (bounded by message size); download includes
            the server’s last 1,000. Clear view only affects this browser.
          </p>
        </section>
        <section aria-label="Command console">
          <div className="console-heading">
            <h3>Command console</h3>
            <span className="badge">
              {owned ? "CONTROL OWNER" : "READ ONLY"}
            </span>
          </div>
          <div
            className="command-scroll"
            role="log"
            aria-label="Command transcript"
            aria-live="polite"
          >
            {!commands.length && (
              <div className="hint">
                Type <code>help</code> for commands. Try <code>status</code> or{" "}
                <code>policy list</code>. Use ↑ / ↓ for history.
              </div>
            )}
            {commands.map((entry) => (
              <div
                key={entry.key}
                className={`command-entry command-${entry.status}`}
              >
                <div>
                  <span className="prompt">❯</span> {entry.line}
                </div>
                {entry.output !== undefined && (
                  <pre>
                    {Array.isArray(entry.output) &&
                    entry.output.every((item) => typeof item === "string")
                      ? entry.output.join("\n")
                      : JSON.stringify(entry.output, null, 2)}
                  </pre>
                )}
                <small>
                  {entry.status === "pending"
                    ? "Waiting for response…"
                    : entry.status === "error"
                      ? entry.code
                      : "✓ " + (entry.code ?? "OK")}
                </small>
              </div>
            ))}
            <div ref={commandEnd} />
          </div>
          <form
            className="command-form"
            onSubmit={(event) => {
              event.preventDefault();
              const value = line.trim();
              if (!value || !ready) return;
              submit(value);
              setHistory((old) =>
                [value, ...old.filter((item) => item !== value)].slice(0, 100),
              );
              setHistoryIndex(-1);
              setLine("");
            }}
          >
            <label htmlFor="console-command" className="sr-only">
              Command
            </label>
            <span className="prompt" aria-hidden="true">
              ❯
            </span>
            <input
              id="console-command"
              value={line}
              maxLength={512}
              disabled={!ready}
              placeholder="help"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setLine(event.target.value);
                setHistoryIndex(-1);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  const next =
                    event.key === "ArrowUp"
                      ? Math.min(historyIndex + 1, history.length - 1)
                      : Math.max(-1, historyIndex - 1);
                  setHistoryIndex(next);
                  setLine(next < 0 ? "" : history[next]);
                }
              }}
            />
          </form>
          <p className="hint">
            Motion and configuration commands require ownership. Timed{" "}
            <code>jog 20 500</code> moves at +20 mm/s for 500 ms, then requests
            Stop. Focus loss or a hidden tab disarms. Commands use the same
            server connection as the buttons.
          </p>
          <details className="command-help">
            <summary>Command reference</summary>
            <pre>{COMMAND_HELP.join("\n")}</pre>
          </details>
        </section>
      </div>
    </section>
  );
});
