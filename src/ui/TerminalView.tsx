/**
 * Command terminal panel.
 */

import { useEffect, useRef, useState } from "react";
import type { LogLine } from "../session.js";

/** Props for the terminal. */
interface TerminalProps {
  /** Scrollback lines. */
  log: LogLine[];
  /** Submit handler. */
  onRun: (command: string) => void;
}

/**
 * Interactive command line with scrollback.
 *
 * @param props - Terminal props.
 * @returns React element.
 */
export function TerminalView({ log, onRun }: TerminalProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const line = value.trim();
    if (!line) return;
    onRun(line);
    setHistory((h) => [...h, line]);
    setHistIdx(-1);
    setValue("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setValue(history[next] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const next = histIdx + 1;
      if (next >= history.length) {
        setHistIdx(-1);
        setValue("");
      } else {
        setHistIdx(next);
        setValue(history[next] ?? "");
      }
    }
  }

  return (
    <div className="terminal">
      <div className="terminal-log" ref={logRef}>
        {log.map((line, i) => (
          <div key={i} className={line.kind}>
            {line.text}
          </div>
        ))}
      </div>
      <form className="terminal-input" onSubmit={submit}>
        <span>›</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="mean score"
          spellCheck={false}
          autoFocus
          aria-label="command"
        />
      </form>
    </div>
  );
}
