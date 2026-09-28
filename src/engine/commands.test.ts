/**
 * Unit tests for command parsing and execution.
 */

import { describe, expect, it } from "vitest";
import { createState, execute, parseCommand } from "./commands.js";
import { getDataset } from "./datasets.js";
import type { AnalysisState } from "./types.js";

function run(state: AnalysisState, line: string) {
  return execute(state, parseCommand(line));
}

describe("parseCommand", () => {
  it("parses name, positionals, and opts", () => {
    const cmd = parseCommand("ttest score mu=75 extra");
    expect(cmd.name).toBe("ttest");
    expect(cmd.args.pos).toEqual(["score", "extra"]);
    expect(cmd.args.opts.mu).toBe("75");
  });
});

describe("execute", () => {
  it("computes mean and records summary", () => {
    const s0 = createState(getDataset("quiz_scores"), 42);
    const { state, output, error } = run(s0, "mean score");
    expect(error).toBeUndefined();
    expect(output[0]).toMatch(/mean\(score\)/);
    expect(state.summaries.some((s) => s.name === "mean" && s.column === "score")).toBe(true);
    expect(state.step).toBe(1);
  });

  it("does not mutate prior state", () => {
    const s0 = createState(getDataset("quiz_scores"), 42);
    const s0snap = s0.step;
    run(s0, "mean score");
    expect(s0.step).toBe(s0snap);
    expect(s0.summaries.length).toBe(0);
  });

  it("loads datasets", () => {
    const s0 = createState(getDataset("quiz_scores"), 42);
    const { state, error } = run(s0, "load adult_heights");
    expect(error).toBeUndefined();
    expect(state.dataset.id).toBe("adult_heights");
  });

  it("returns error for unknown command without changing state", () => {
    const s0 = createState(getDataset("quiz_scores"), 42);
    const { state, error } = run(s0, "nope");
    expect(error).toMatch(/Unknown command/);
    expect(state).toBe(s0);
  });

  it("sample produces n draws with seed", () => {
    const s0 = createState(getDataset("adult_heights"), 42);
    const { state, error } = run(s0, "sample 30 seed=7");
    expect(error).toBeUndefined();
    expect(state.samples).toHaveLength(1);
    expect(state.samples[0]?.values).toHaveLength(30);
    expect(state.seed).toBe(7);
  });

  it("bootstrap produces replicate means", () => {
    let s = createState(getDataset("adult_heights"), 42);
    let r = run(s, "bootstrap 200");
    expect(r.error).toBeUndefined();
    s = r.state;
    const rec = s.samples.find((x) => x.kind === "resample_mean");
    expect(rec?.values.length).toBe(200);
  });

  it("ci writes lo/hi summaries", () => {
    let s = createState(getDataset("adult_heights"), 42);
    s = run(s, "ci 0.95").state;
    const lo = s.summaries.find((x) => x.name === "ci_lo");
    const hi = s.summaries.find((x) => x.name === "ci_hi");
    expect(lo).toBeDefined();
    expect(hi).toBeDefined();
    expect(lo!.value).toBeLessThan(hi!.value);
  });

  it("ttest records statistic and p", () => {
    const s0 = createState(getDataset("quiz_scores"), 42);
    const { state, error } = run(s0, "ttest score mu=75");
    expect(error).toBeUndefined();
    expect(state.tests).toHaveLength(1);
    expect(state.tests[0]?.name).toBe("ttest");
  });

  it("corr and regress work on study_score", () => {
    let s = createState(getDataset("study_score"), 42);
    let r = run(s, "corr hours score");
    expect(r.error).toBeUndefined();
    expect(r.state.summaries.find((x) => x.name === "corr")?.value).toBeGreaterThan(0.5);
    r = run(r.state, "regress score hours");
    expect(r.state.plots[0]?.kind).toBe("regression");
    expect(r.state.summaries.find((x) => x.name === "slope")?.value).toBeGreaterThan(0);
  });

  it("pop sets generative model", () => {
    const s0 = createState(getDataset("adult_heights"), 42);
    const { state } = run(s0, "pop normal mu=170 sd=8");
    expect(state.model?.kind).toBe("normal");
    expect(state.model?.params.mu).toBe(170);
  });
});
