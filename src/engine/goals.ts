/**
 * Goal predicates for level success checking.
 *
 * Each goal type is a pure function of AnalysisState. Levels declare goals in
 * JSON; the session controller calls `checkGoal` after every command.
 */

import type { AnalysisState, GoalSpec, LevelDef } from "./types.js";
import { mean, standardDeviation } from "./stats.js";
import { numericColumn } from "./datasets.js";

/** Result of evaluating a level goal. */
export interface GoalResult {
  /** True when the level is solved. */
  ok: boolean;
  /** Short status line for the level brief. */
  message: string;
}

function approx(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/**
 * Evaluate a goal against the current analysis state.
 *
 * @param state - Latest analysis state.
 * @param goal - Declarative goal.
 * @returns Pass/fail and a human message.
 * @example
 * checkGoal(state, { type: "summary", name: "mean", column: "score" });
 */
export function checkGoal(state: AnalysisState, goal: GoalSpec): GoalResult {
  switch (goal.type) {
    case "summary":
      return checkSummary(state, goal);
    case "plot":
      return checkPlot(state, goal);
    case "sample":
      return checkSample(state, goal);
    case "test":
      return checkTest(state, goal);
    case "corr":
      return checkCorr(state, goal);
    default: {
      const exhaustive: never = goal;
      return { ok: false, message: `Unknown goal ${JSON.stringify(exhaustive)}` };
    }
  }
}

function checkSummary(
  state: AnalysisState,
  goal: Extract<GoalSpec, { type: "summary" }>,
): GoalResult {
  const rec = [...state.summaries]
    .reverse()
    .find((s) => s.name === goal.name && s.column === goal.column);
  if (!rec) {
    return { ok: false, message: `Compute ${goal.name}(${goal.column})` };
  }
  if (goal.expected !== undefined) {
    const tol = goal.tolerance ?? 1e-6;
    const ok = approx(rec.value, goal.expected, tol);
    return {
      ok,
      message: ok
        ? `${goal.name}(${goal.column}) = ${rec.value}`
        : `${goal.name}(${goal.column}) = ${rec.value}, expected ≈ ${goal.expected}`,
    };
  }
  return { ok: true, message: `${goal.name}(${goal.column}) = ${rec.value}` };
}

function checkPlot(
  state: AnalysisState,
  goal: Extract<GoalSpec, { type: "plot" }>,
): GoalResult {
  const found = state.plots.some(
    (p) =>
      p.kind === goal.kind &&
      goal.columns.every((c, i) => p.columns[i] === c),
  );
  return {
    ok: found,
    message: found ? `Plot ${goal.kind} ready` : `Create plot: ${goal.kind} ${goal.columns.join(" ")}`,
  };
}

function checkSample(
  state: AnalysisState,
  goal: Extract<GoalSpec, { type: "sample" }>,
): GoalResult {
  // Prefer the most recent matching sample; else evaluate a derived sample mean.
  const last = [...state.samples].reverse().find((s) => s.n >= goal.n || s.values.length >= goal.n);
  const values = last ? last.values.slice(0, goal.n) : null;
  if (!values || values.length === 0) {
    // Fall back to dataset column mean if a summary exists — still require a sample record.
    return {
      ok: false,
      message: `Draw a sample of n ≥ ${goal.n} (sample ${goal.n})`,
    };
  }
  const stat = goal.stat === "mean" ? mean(values) : standardDeviation(values);
  let ref = goal.populationMean;
  if (ref === undefined) {
    const col = state.model?.column ?? state.dataset.columns.find((c) => c.type === "numeric")?.name;
    if (col) {
      try {
        ref = mean(numericColumn(state.dataset, col).values);
      } catch {
        ref = undefined;
      }
    }
  }
  if (ref === undefined) {
    return { ok: false, message: "Missing population reference for sample goal" };
  }
  const dist = Math.abs(stat - ref);
  const ok = dist <= goal.within;
  return {
    ok,
    message: ok
      ? `sample ${goal.stat} = ${stat.toFixed(3)} within ±${goal.within} of ${ref.toFixed(3)}`
      : `sample ${goal.stat} = ${stat.toFixed(3)} is ${dist.toFixed(3)} from ${ref.toFixed(3)} (need ≤ ${goal.within})`,
  };
}

function checkTest(
  state: AnalysisState,
  goal: Extract<GoalSpec, { type: "test" }>,
): GoalResult {
  const rec = [...state.tests].reverse().find((t) => t.name === goal.name);
  if (!rec) {
    return { ok: false, message: `Run ${goal.name}` };
  }
  const reject = goal.maxP !== undefined ? rec.pValue <= goal.maxP : rec.pValue < 0.05;
  const ok = reject === goal.reject;
  return {
    ok,
    message: ok
      ? `${goal.name} p=${rec.pValue.toFixed(4)} (reject=${reject})`
      : `${goal.name} p=${rec.pValue.toFixed(4)} — expected reject=${goal.reject}`,
  };
}

function checkCorr(
  state: AnalysisState,
  goal: Extract<GoalSpec, { type: "corr" }>,
): GoalResult {
  const rec = [...state.summaries]
    .reverse()
    .find((s) => s.name === "corr" && s.column === `${goal.x}~${goal.y}`);
  if (!rec) {
    return { ok: false, message: `Compute corr ${goal.x} ${goal.y}` };
  }
  const minAbs = goal.minAbs ?? 0;
  const ok = Math.abs(rec.value) >= minAbs;
  return {
    ok,
    message: ok
      ? `|r| = ${Math.abs(rec.value).toFixed(3)} ≥ ${minAbs}`
      : `|r| = ${Math.abs(rec.value).toFixed(3)} < ${minAbs}`,
  };
}

/**
 * Human-readable goal description for the level brief.
 *
 * @param level - Level definition.
 * @returns One-line goal text.
 */
export function describeGoal(level: LevelDef): string {
  const g = level.goal;
  switch (g.type) {
    case "summary":
      return `Produce ${g.name}(${g.column})${g.expected !== undefined ? ` ≈ ${g.expected}` : ""}`;
    case "plot":
      return `Show a ${g.kind} plot for ${g.columns.join(", ")}`;
    case "sample":
      return `Draw n≥${g.n} and get sample ${g.stat} within ±${g.within}`;
    case "test":
      return `Run ${g.name} and get reject=${g.reject}`;
    case "corr":
      return `Compute corr ${g.x} ${g.y}${g.minAbs !== undefined ? ` with |r| ≥ ${g.minAbs}` : ""}`;
    default:
      return "Unknown goal";
  }
}
