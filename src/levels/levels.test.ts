/**
 * Unit tests for goal predicates and bundled levels.
 */

import { describe, expect, it } from "vitest";
import { createState, execute, parseCommand } from "../engine/commands.js";
import { checkGoal, describeGoal } from "../engine/goals.js";
import { getDataset } from "../engine/datasets.js";
import { LEVELS, getLevel } from "./catalog.js";
import type { AnalysisState, LevelDef } from "../engine/types.js";

function run(state: AnalysisState, ...lines: string[]): AnalysisState {
  let s = state;
  for (const line of lines) {
    const r = execute(s, parseCommand(line));
    if (r.error) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

function startState(level: LevelDef): AnalysisState {
  let s = createState(getDataset(level.start.dataset), level.start.seed ?? 42);
  if (level.start.model) s = { ...s, model: level.start.model };
  if (level.start.plots) s = { ...s, plots: [...level.start.plots] };
  return s;
}

describe("checkGoal", () => {
  it("summary goal requires matching summary", () => {
    const s0 = createState(getDataset("quiz_scores"), 42);
    const goal = { type: "summary" as const, name: "mean", column: "score" };
    expect(checkGoal(s0, goal).ok).toBe(false);
    const s1 = run(s0, "mean score");
    expect(checkGoal(s1, goal).ok).toBe(true);
  });

  it("plot goal requires plot kind and columns", () => {
    const s0 = createState(getDataset("quiz_scores"), 42);
    const goal = { type: "plot" as const, kind: "hist" as const, columns: ["score"] };
    expect(checkGoal(s0, goal).ok).toBe(false);
    const s1 = run(s0, "hist score");
    expect(checkGoal(s1, goal).ok).toBe(true);
  });
});

describe("bundled levels", () => {
  it("every level has unique id and solvable path in hints or golf", () => {
    const ids = new Set(LEVELS.map((l) => l.id));
    expect(ids.size).toBe(LEVELS.length);
    for (const level of LEVELS as LevelDef[]) {
      expect(level.hints.length).toBeGreaterThan(0);
      expect(level.golf).toBeGreaterThan(0);
      expect(describeGoal(level).length).toBeGreaterThan(5);
    }
  });

  it("desc-01-mean is solved by `mean score`", () => {
    const level = getLevel("desc-01-mean");
    const s = run(startState(level), "mean score");
    expect(checkGoal(s, level.goal).ok).toBe(true);
  });

  it("desc-02-median is solved by `median score`", () => {
    const level = getLevel("desc-02-median");
    const s = run(startState(level), "median score");
    expect(checkGoal(s, level.goal).ok).toBe(true);
  });

  it("desc-04-skew is solved by `hist wait`", () => {
    const level = getLevel("desc-04-skew");
    const s = run(startState(level), "hist wait");
    expect(checkGoal(s, level.goal).ok).toBe(true);
  });

  it("samp-02-bootstrap is solved by `bootstrap 500`", () => {
    const level = getLevel("samp-02-bootstrap");
    const s = run(startState(level), "bootstrap 500");
    expect(checkGoal(s, level.goal).ok).toBe(true);
  });

  it("assoc-02-ols is solved by `regress score hours`", () => {
    const level = getLevel("assoc-02-ols");
    const s = run(startState(level), "regress score hours");
    expect(checkGoal(s, level.goal).ok).toBe(true);
  });

  it("test-01-ttest is solved by `ttest score mu=70`", () => {
    const level = getLevel("test-01-ttest");
    const s = run(startState(level), "ttest score mu=70");
    expect(checkGoal(s, level.goal).ok).toBe(true);
  });
});
