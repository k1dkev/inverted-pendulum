import { useCallback, useState, useRef } from "react";
import { LOG_CAPACITY, type LogRecord } from "../shared/logging";
export interface CommandEntry {
  key: number;
  id: number;
  line: string;
  status: "pending" | "ok" | "error";
  output?: unknown;
  code?: string;
}
export function useDiagnostics(
  send: (type: string, fields?: Record<string, unknown>) => number | undefined,
) {
  const nextKey = useRef(0);
  const [logs, setLogs] = useState<LogRecord[]>([]),
    [commands, setCommands] = useState<CommandEntry[]>([]);
  const submit = useCallback(
    (line: string) => {
      const id = send("console_command", { line });
      if (id !== undefined) {
        const key = ++nextKey.current;
        setCommands((old) =>
          [...old, { key, id, line, status: "pending" as const }].slice(-100),
        );
      }
    },
    [send],
  );
  const receive = useCallback((m: Record<string, any>) => {
    if (m.type === "log_history") setLogs(m.entries.slice(-LOG_CAPACITY));
    if (m.type === "log")
      setLogs((old) => [...old, m.entry].slice(-LOG_CAPACITY));
    if (m.type === "console_output" || m.type === "result")
      setCommands((old) => {
        const index = old.findIndex(
          (entry) => entry.id === m.id && entry.status === "pending",
        );
        if (index < 0) return old;
        const next = [...old];
        next[index] =
          m.type === "console_output"
            ? { ...old[index], output: m.data }
            : { ...old[index], status: m.ok ? "ok" : "error", code: m.code };
        return next;
      });
  }, []);
  const connectionLost = useCallback(
    () =>
      setCommands((old) =>
        old.map((entry) =>
          entry.status === "pending"
            ? { ...entry, status: "error", code: "DISCONNECTED" }
            : entry,
        ),
      ),
    [],
  );
  return { logs, commands, submit, receive, connectionLost };
}
