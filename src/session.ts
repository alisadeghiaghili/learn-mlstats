/**
 * Session controller: command history, undo stack, level context, golf.
 *
 * UI subscribes to the session; the engine stays pure.
 */

import {
  createState,
  execute,
  parseCommand,
  checkGoal,
  describeGoal,
  getDataset,
  renderScene,
} from "./engine/index.js";
import type {
  AnalysisState,
  CommandResult,
  LevelDef,
  LevelScore,
  SceneFrame,
} from "./engine/index.js";
import { getLevel, LEVELS } from "./levels/catalog.js";

/** One terminal line. */
export interface LogLine {
  /** `in` for commands, `out` for output, `err` for errors, `sys` for chrome. */
  kind: "in" | "out" | "err" | "sys";
  /** Text content. */
  text: string;
}

/** Snapshot of everything the UI needs. */
export interface SessionView {
  /** Latest analysis state. */
  state: AnalysisState;
  /** Terminal scrollback. */
  log: LogLine[];
  /** Active level or null in sandbox. */
  level: LevelDef | null;
  /** Goal status line. */
  goalMessage: string;
  /** True when the active level is solved. */
  goalOk: boolean;
  /** Commands used in the current level attempt. */
  used: number;
  /** Hint index revealed so far (0 = none). */
  hintsShown: number;
  /** Scene frames for the canvas. */
  scenes: SceneFrame[];
  /** Last golf scores. */
  scores: LevelScore[];
  /** True once level is solved (stops further scoring). */
  solved: boolean;
}

type Listener = (view: SessionView) => void;

/**
 * Create a sandbox session.
 *
 * @param datasetId - Initial dataset.
 * @returns Session controller.
 */
export function createSession(datasetId = "quiz_scores"): Session {
  return new Session(datasetId);
}

/** Mutable session controller. */
export class Session {
  private state: AnalysisState;
  private undoStack: AnalysisState[] = [];
  private log: LogLine[] = [];
  private level: LevelDef | null = null;
  private goalMessage = "Sandbox mode — type `help` or `levels`.";
  private goalOk = false;
  private used = 0;
  private hintsShown = 0;
  private scores: LevelScore[] = [];
  private solved = false;
  private listeners = new Set<Listener>();
  private seedCounter = 42;

  /**
   * Construct a session.
   *
   * @param datasetId - Starting dataset id.
   */
  constructor(datasetId = "quiz_scores") {
    this.state = createState(getDataset(datasetId), 42);
    this.pushLog("sys", "learn-mlstats sandbox. Type `help` for commands, `levels` for lessons.");
    this.pushLog("sys", "Loaded 'Quiz scores' (10 rows).");
  }

  /** Subscribe to view updates. Returns unsubscribe. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.view());
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Current view snapshot. */
  view(): SessionView {
    return {
      state: this.state,
      log: [...this.log],
      level: this.level,
      goalMessage: this.goalMessage,
      goalOk: this.goalOk,
      used: this.used,
      hintsShown: this.hintsShown,
      scenes: renderScene(this.state),
      scores: [...this.scores],
      solved: this.solved,
    };
  }

  private emit(): void {
    const v = this.view();
    for (const fn of this.listeners) fn(v);
  }

  private pushLog(kind: LogLine["kind"], text: string): void {
    for (const line of text.split("\n")) {
      this.log.push({ kind, text: line });
    }
    if (this.log.length > 500) {
      this.log = this.log.slice(-500);
    }
  }

  /**
   * Run one command line (session-level commands + engine commands).
   *
   * @param line - Raw user input.
   */
  dispatch(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    this.pushLog("in", trimmed);

    // Session-level commands first.
    const head = trimmed.split(/\s+/)[0]?.toLowerCase();
    if (head === "levels") {
      this.listLevels();
      this.emit();
      return;
    }
    if (head === "level") {
      const id = trimmed.split(/\s+/)[1];
      if (!id) {
        this.pushLog("err", "Usage: level <id>");
      } else {
        this.loadLevel(id);
      }
      this.emit();
      return;
    }
    if (head === "sandbox") {
      this.enterSandbox();
      this.emit();
      return;
    }
    if (head === "reset") {
      this.reset();
      this.emit();
      return;
    }
    if (head === "undo") {
      this.undo();
      this.emit();
      return;
    }
    if (head === "hint") {
      this.hint();
      this.emit();
      return;
    }
    if (head === "goal") {
      if (this.level) {
        this.pushLog("sys", describeGoal(this.level));
        this.pushLog("sys", `status: ${this.goalMessage}`);
      } else {
        this.pushLog("sys", "Sandbox — no goal. Try `levels`.");
      }
      this.emit();
      return;
    }

    // Engine command.
    try {
      const cmd = parseCommand(trimmed);
      const result: CommandResult = execute(this.state, cmd);
      if (result.error) {
        this.pushLog("err", result.error);
      }
      for (const lineOut of result.output) {
        this.pushLog("out", lineOut);
      }
      if (result.state !== this.state) {
        this.undoStack.push(this.state);
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.state = result.state;
        this.used += 1;
        this.evaluateGoal();
      }
    } catch (err) {
      this.pushLog("err", err instanceof Error ? err.message : String(err));
    }
    this.emit();
  }

  private evaluateGoal(): void {
    if (!this.level || this.solved) return;
    const result = checkGoal(this.state, this.level.goal);
    this.goalMessage = result.message;
    this.goalOk = result.ok;
    if (result.ok) {
      this.solved = true;
      const used = this.used;
      const par = this.level.golf;
      const score: LevelScore = {
        levelId: this.level.id,
        used,
        par,
        underPar: used <= par,
      };
      this.scores = [
        ...this.scores.filter((s) => s.levelId !== score.levelId),
        score,
      ];
      this.pushLog(
        "sys",
        `LEVEL SOLVED in ${used} command${used === 1 ? "" : "s"} (par ${par})${score.underPar ? " — under par" : ""}`,
      );
    }
  }

  private listLevels(): void {
    this.pushLog("sys", "Levels:");
    for (const level of LEVELS) {
      const mark = this.scores.some((s) => s.levelId === level.id) ? "[x]" : "[ ]";
      this.pushLog("out", `  ${mark} ${level.id.padEnd(18)} ${level.title}`);
    }
    this.pushLog("sys", "Load with: level <id>");
  }

  /**
   * Load a level and reset state to its start.
   *
   * @param id - Level id.
   */
  loadLevel(id: string): void {
    try {
      const level = getLevel(id);
      this.level = level;
      this.solved = false;
      this.used = 0;
      this.hintsShown = 0;
      this.undoStack = [];
      this.seedCounter = level.start.seed ?? 42;
      const dataset = getDataset(level.start.dataset);
      let state = createState(dataset, this.seedCounter);
      if (level.start.model) {
        state = { ...state, model: level.start.model };
      }
      if (level.start.plots) {
        state = { ...state, plots: [...level.start.plots] };
      }
      this.state = state;
      this.goalMessage = describeGoal(level);
      this.goalOk = false;
      this.pushLog("sys", `--- ${level.title} ---`);
      this.pushLog("out", level.narrative);
      this.pushLog("sys", `Goal: ${describeGoal(level)}  (par ${level.golf})`);
    } catch (err) {
      this.pushLog("err", err instanceof Error ? err.message : String(err));
    }
  }

  private enterSandbox(): void {
    this.level = null;
    this.solved = false;
    this.goalOk = false;
    this.used = 0;
    this.goalMessage = "Sandbox mode — type `help` or `levels`.";
    this.pushLog("sys", "Sandbox mode.");
  }

  private reset(): void {
    if (this.level) {
      const id = this.level.id;
      this.loadLevel(id);
      this.pushLog("sys", "Level reset.");
    } else {
      const id = this.state.dataset.id;
      this.state = createState(getDataset(id), 42);
      this.undoStack = [];
      this.used = 0;
      this.pushLog("sys", "Sandbox reset.");
    }
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) {
      this.pushLog("err", "Nothing to undo.");
      return;
    }
    this.state = prev;
    this.used = Math.max(0, this.used - 1);
    if (this.level && !this.solved) {
      const result = checkGoal(this.state, this.level.goal);
      this.goalMessage = result.message;
      this.goalOk = result.ok;
    }
    this.pushLog("sys", "Undid last command.");
  }

  private hint(): void {
    if (!this.level) {
      this.pushLog("sys", "No active level. Type `levels`.");
      return;
    }
    const hints = this.level.hints;
    if (this.hintsShown >= hints.length) {
      this.pushLog("sys", "No more hints.");
      return;
    }
    const text = hints[this.hintsShown] as string;
    this.hintsShown += 1;
    this.pushLog("sys", `Hint ${this.hintsShown}/${hints.length}: ${text}`);
  }
}
