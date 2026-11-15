import { useEffect, useRef, useState } from "react";
const descriptions = [
  "Hardware stop",
  "Travel limit",
  "Invalid sensor",
  "Motion timing",
  "Control overrun",
  "Command lease expired",
  "Communications overflow",
  "Policy stopped",
];
export function decodeFaults(bits: number) {
  const result: { code: string; description: string; bit: number }[] = [];
  for (let i = 0; i < 32; i++)
    if ((bits >>> i) & 1)
      result.push({
        code: `IP${String(i + 1).padStart(4, "0")}`,
        description: descriptions[i] ?? `Unknown fault bit ${i}`,
        bit: i,
      });
  return result;
}
type RecordEntry = {
  code: string;
  description: string;
  last: string;
  occurrences: number;
};
export function Faults({
  bits,
  connected,
  owned,
  clear,
}: {
  bits: number;
  connected: boolean;
  owned: boolean;
  clear: () => void;
}) {
  const [history, setHistory] = useState<RecordEntry[]>([]);
  const previous = useRef(0);
  useEffect(() => {
    if (!connected) return;
    const added = decodeFaults((bits & ~previous.current) >>> 0);
    previous.current = bits;
    if (!added.length) return;
    const now = new Date().toISOString();
    setHistory((old) => {
      const next = [...old];
      for (const fault of added) {
        const index = next.findIndex((entry) => entry.code === fault.code);
        if (index < 0)
          next.push({
            code: fault.code,
            description: fault.description,
            last: now,
            occurrences: 1,
          });
        else
          next[index] = {
            ...next[index],
            last: now,
            occurrences: next[index].occurrences + 1,
          };
      }
      return next;
    });
  }, [bits, connected]);
  const active = connected ? decodeFaults(bits) : [];
  return (
    <section
      id="faults"
      className="panel fault-panel"
      aria-label="Diagnostic trouble codes"
    >
      <div className="panel-heading">
        <h2>Diagnostic trouble codes</h2>
        <span className="badge">
          {connected ? `${active.length} active` : "DEVICE OFFLINE"}
        </span>
      </div>
      {active.length ? (
        <ul>
          {active.map((item) => (
            <li key={item.code}>
              <strong>{item.code}</strong> · {item.description}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {connected
            ? "No active fault codes."
            : "Connect a device to read active faults."}
        </p>
      )}
      <button disabled={!owned || !active.length} onClick={clear}>
        Clear device faults
      </button>
      <h3>Observed in this browser session</h3>
      {history.length ? (
        <ul>
          {history.map((item) => (
            <li key={item.code}>
              {item.code} · {item.description} · {item.occurrences} occurrence
              {item.occurrences === 1 ? "" : "s"} · last{" "}
              {new Date(item.last).toLocaleTimeString()}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No faults observed yet.</p>
      )}
      <p className="hint">
        History starts when this page is open and is cleared on reload. Device
        fault bits remain latched until cleared or reset.
      </p>
    </section>
  );
}
