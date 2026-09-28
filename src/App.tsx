/**
 * Application shell: top bar + terminal + canvas + sidebar.
 */

import { useEffect, useMemo, useState } from "react";
import { Session } from "./session.js";
import type { SessionView } from "./session.js";
import { TerminalView } from "./ui/TerminalView.js";
import { CanvasView } from "./ui/CanvasView.js";
import { Sidebar } from "./ui/Sidebar.js";
import { LEVELS } from "./levels/catalog.js";

/**
 * Root application component.
 *
 * @returns React element.
 */
export function App() {
  const session = useMemo(() => new Session("quiz_scores"), []);
  const [view, setView] = useState<SessionView>(() => session.view());

  useEffect(() => session.subscribe(setView), [session]);

  // Auto-load first level if URL has ?level=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const levelId = params.get("level");
    const commands = params.get("command");
    if (levelId) session.dispatch(`level ${levelId}`);
    if (commands) {
      for (const c of commands.split(";")) {
        if (c.trim()) session.dispatch(c.trim());
      }
    }
  }, [session]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          learn<span>-mlstats</span>
        </div>
        <div className="meta">
          {view.level ? `level: ${view.level.id}` : "sandbox"} · step {view.state.step}
        </div>
        <div className="spacer" />
        {view.goalOk ? (
          <button type="button" className="solved">
            solved in {view.used} cmd
          </button>
        ) : null}
        <button type="button" onClick={() => session.dispatch("undo")}>
          undo
        </button>
        <button type="button" onClick={() => session.dispatch("reset")}>
          reset
        </button>
        <button type="button" onClick={() => session.dispatch("hint")}>
          hint
        </button>
        <button type="button" onClick={() => session.dispatch("help")}>
          help
        </button>
      </header>
      <div className="layout">
        <TerminalView log={view.log} onRun={(cmd) => session.dispatch(cmd)} />
        <main className="canvas">
          <CanvasView scenes={view.scenes} />
        </main>
        <Sidebar
          level={view.level}
          goalMessage={view.goalMessage}
          goalOk={view.goalOk}
          used={view.used}
          hintsShown={view.hintsShown}
          scores={view.scores}
          onLevel={(id) => session.dispatch(`level ${id}`)}
          onSandbox={() => session.dispatch("sandbox")}
        />
      </div>
    </div>
  );
}

// re-export for tests / tooling
export { LEVELS };
