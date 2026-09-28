/**
 * Level brief sidebar (active level) or level browser.
 */

import type { LevelDef, LevelScore } from "../engine/types.js";
import { describeGoal } from "../engine/goals.js";
import { LEVELS } from "../levels/catalog.js";

/** Props for the right sidebar. */
interface SidebarProps {
  /** Active level or null. */
  level: LevelDef | null;
  /** Goal status text. */
  goalMessage: string;
  /** Whether the goal is satisfied. */
  goalOk: boolean;
  /** Commands used. */
  used: number;
  /** Hints already revealed. */
  hintsShown: number;
  /** Golf scores. */
  scores: LevelScore[];
  /** Load a level by id. */
  onLevel: (id: string) => void;
  /** Enter sandbox. */
  onSandbox: () => void;
}

/**
 * Level brief / browser.
 *
 * @param props - Sidebar props.
 * @returns React element.
 */
export function Sidebar({
  level,
  goalMessage,
  goalOk,
  used,
  hintsShown,
  scores,
  onLevel,
  onSandbox,
}: SidebarProps) {
  if (level) {
    const score = scores.find((s) => s.levelId === level.id);
    return (
      <aside className="sidebar">
        <div className="series">{level.series}</div>
        <h2>{level.title}</h2>
        <p className="narrative">{level.narrative}</p>
        <div className={`goal ${goalOk ? "ok" : ""}`}>
          <div className="label">Goal</div>
          <div>{describeGoal(level)}</div>
          <div className="status" style={{ marginTop: 8 }}>
            {goalMessage}
          </div>
        </div>
        <div className="golf">
          commands: {used} / par {level.golf}
          {score ? ` · best ${score.used}` : ""}
          {hintsShown > 0 ? ` · hints ${hintsShown}` : ""}
        </div>
        <div className="golf" style={{ marginTop: 16 }}>
          <button type="button" onClick={onSandbox}>
            Back to sandbox
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="series">curriculum</div>
      <h2>Levels</h2>
      <p className="narrative">
        Pick a lesson. Each level is a short statistical idea with a concrete
        goal and a command-golf par.
      </p>
      <div className="level-list">
        {LEVELS.map((l) => {
          const done = scores.some((s) => s.levelId === l.id);
          return (
            <button
              key={l.id}
              type="button"
              className={done ? "done" : ""}
              onClick={() => onLevel(l.id)}
            >
              <div className="id">{l.id}</div>
              <div className="title">{l.title}</div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
