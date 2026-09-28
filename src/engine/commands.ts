/**
 * Command parser and executor for the analysis engine.
 *
 * Commands mirror a tiny shell: `name positional... key=value ...`.
 * Execution is pure — it returns a new AnalysisState.
 */

import type {
  AnalysisState,
  Command,
  CommandArgs,
  CommandResult,
  Dataset,
  PlotSpec,
  SampleRecord,
  SummaryRecord,
} from "./types.js";
import {
  getDataset,
  numericColumn,
  pairedColumns,
} from "./datasets.js";
import {
  fiveNumber,
  histogram,
  iqr,
  mean,
  median,
  ols,
  pearson,
  quantile,
  skewness,
  standardDeviation,
  standardError,
  tTestOneSample,
  variance,
} from "./stats.js";
import {
  createRng,
  quantile as qtile,
  sampleEmpirical,
  sampleFrom,
} from "./rng.js";

/** Maximum retained sample records per session. */
const MAX_SAMPLES = 200;

/**
 * Create an empty analysis state over a dataset.
 *
 * @param dataset - Active dataset.
 * @param seed - RNG seed.
 * @returns Fresh state with step 0.
 */
export function createState(dataset: Dataset, seed = 42): AnalysisState {
  return {
    dataset,
    samples: [],
    summaries: [],
    plots: [],
    tests: [],
    seed,
    step: 0,
  };
}

/**
 * Parse a single command line.
 *
 * @param line - Raw input, e.g. `mean wait` or `ttest score mu=75`.
 * @returns Parsed command.
 * @throws Error on empty input.
 */
export function parseCommand(line: string): Command {
  const trimmed = line.trim();
  if (!trimmed) throw new Error("Empty command");
  const tokens = trimmed.split(/\s+/);
  const name = (tokens[0] as string).toLowerCase();
  const pos: string[] = [];
  const opts: Record<string, string> = {};
  for (const tok of tokens.slice(1)) {
    const eq = tok.indexOf("=");
    if (eq > 0) {
      opts[tok.slice(0, eq)] = tok.slice(eq + 1);
    } else {
      pos.push(tok);
    }
  }
  return { name, args: { pos, opts }, raw: trimmed };
}

function fmt(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return String(n);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function pushSummary(
  summaries: SummaryRecord[],
  name: string,
  column: string,
  value: number,
  step: number,
  detail?: Record<string, number>,
): void {
  const rec: SummaryRecord = { name, column, value, step };
  if (detail) {
    rec.detail = detail;
  }
  summaries.push(rec);
}

function nextSampleId(samples: SampleRecord[]): number {
  return samples.length === 0 ? 1 : (samples[samples.length - 1] as SampleRecord).id + 1;
}

function cloneState(state: AnalysisState): AnalysisState {
  const next: AnalysisState = {
    dataset: {
      ...state.dataset,
      columns: state.dataset.columns.map((c) => ({ ...c, values: [...c.values] })),
    },
    samples: state.samples.map((s) => ({ ...s, values: [...s.values] })),
    summaries: state.summaries.map((s) => ({ ...s })),
    plots: state.plots.map((p) => ({ ...p, columns: [...p.columns] })),
    tests: state.tests.map((t) => ({ ...t, detail: { ...t.detail } })),
    seed: state.seed,
    step: state.step,
  };
  if (state.model) {
    next.model = { ...state.model, params: { ...state.model.params } };
  }
  return next;
}

function defaultColumn(state: AnalysisState, name?: string): string {
  return numericColumn(state.dataset, name).name;
}

function getNumeric(state: AnalysisState, name?: string): { name: string; values: number[] } {
  return numericColumn(state.dataset, name);
}

/**
 * Execute one command against an analysis state.
 *
 * @param state - Current state (not mutated).
 * @param cmd - Parsed command.
 * @returns Next state and terminal output.
 * @example
 * const { state: s1, output } = execute(state, parseCommand("mean score"));
 */
export function execute(state: AnalysisState, cmd: Command): CommandResult {
  try {
    return executeUnsafe(state, cmd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { state, output: [], error: message };
  }
}

function executeUnsafe(state: AnalysisState, cmd: Command): CommandResult {
  switch (cmd.name) {
    case "help":
      return {
        state,
        output: [
          "Commands:",
          "  help | levels | level <id> | sandbox | reset | undo | hint | goal",
          "  load <datasetId> | datasets",
          "  describe [col]",
          "  mean|median|var|sd|se|skew|iqr [col]",
          "  quantile <p> [col] | box [col]",
          "  hist [col] | strip [col] | density [col] | qq [col]",
          "  sample <n> [seed=s] [col=c]",
          "  bootstrap <B> [stat=mean]",
          "  ci <level> [method=percentile|se]",
          "  ttest <col> mu=<v>",
          "  corr <x> <y> | regress <y> <x>",
          "  pop normal mu=0 sd=1 | pop binomial n= p= | pop empirical",
          "  clearplots | status",
        ],
      };
    case "datasets":
      return {
        state,
        output: ["Datasets: quiz_scores, restaurant_wait, adult_heights, study_score, ab_clicks"],
      };
    case "load":
      return loadDataset(state, cmd.args);
    case "describe":
      return describe(state, cmd.args);
    case "mean":
      return scalarStat(state, "mean", cmd.args, (v) => mean(v));
    case "median":
      return scalarStat(state, "median", cmd.args, (v) => median(v));
    case "var":
      return scalarStat(state, "var", cmd.args, (v) => variance(v));
    case "sd":
      return scalarStat(state, "sd", cmd.args, (v) => standardDeviation(v));
    case "se":
      return scalarStat(state, "se", cmd.args, (v) => standardError(v));
    case "skew":
      return scalarStat(state, "skew", cmd.args, (v) => skewness(v));
    case "iqr":
      return scalarStat(state, "iqr", cmd.args, (v) => iqr(v));
    case "quantile":
      return quantileCmd(state, cmd.args);
    case "box":
      return boxCmd(state, cmd.args);
    case "hist":
      return plotCmd(state, "hist", cmd.args);
    case "strip":
      return plotCmd(state, "strip", cmd.args);
    case "density":
      return plotCmd(state, "density", cmd.args);
    case "qq":
      return plotCmd(state, "qq", cmd.args);
    case "clearplots":
      return { state: { ...state, plots: [], step: state.step + 1 }, output: ["Cleared plots."] };
    case "sample":
      return sampleCmd(state, cmd.args);
    case "bootstrap":
      return bootstrapCmd(state, cmd.args);
    case "ci":
      return ciCmd(state, cmd.args);
    case "ttest":
      return ttestCmd(state, cmd.args);
    case "corr":
      return corrCmd(state, cmd.args);
    case "regress":
      return regressCmd(state, cmd.args);
    case "pop":
      return popCmd(state, cmd.args);
    case "status":
      return statusCmd(state);
    default:
      throw new Error(`Unknown command '${cmd.name}'. Try 'help'.`);
  }
}

function loadDataset(state: AnalysisState, args: CommandArgs): CommandResult {
  const id = args.pos[0];
  if (!id) throw new Error("Usage: load <datasetId>");
  const dataset = getDataset(id);
  const next: AnalysisState = {
    ...cloneState(state),
    dataset,
    samples: [],
    summaries: [],
    plots: [],
    tests: [],
    step: state.step + 1,
  };
  return {
    state: next,
    output: [`Loaded '${dataset.name}' (${dataset.columns[0]?.values.length ?? 0} rows).`],
  };
}

function describe(state: AnalysisState, args: CommandArgs): CommandResult {
  const { name, values } = getNumeric(state, args.pos[0]);
  const five = fiveNumber(values);
  const m = mean(values);
  const lines = [
    `column: ${name}  n=${values.length}`,
    `mean=${fmt(m)}  median=${fmt(five.median)}  sd=${fmt(standardDeviation(values))}`,
    `min=${fmt(five.min)}  q1=${fmt(five.q1)}  q3=${fmt(five.q3)}  max=${fmt(five.max)}`,
    `iqr=${fmt(iqr(values))}  skew=${fmt(skewness(values))}`,
  ];
  const next = cloneState(state);
  next.step += 1;
  pushSummary(next.summaries, "mean", name, m, next.step);
  pushSummary(next.summaries, "median", name, five.median, next.step);
  pushSummary(next.summaries, "sd", name, standardDeviation(values), next.step);
  return { state: next, output: lines };
}

function scalarStat(
  state: AnalysisState,
  name: string,
  args: CommandArgs,
  fn: (v: number[]) => number,
): CommandResult {
  const { name: col, values } = getNumeric(state, args.pos[0]);
  const value = fn(values);
  const next = cloneState(state);
  next.step += 1;
  pushSummary(next.summaries, name, col, value, next.step);
  return { state: next, output: [`${name}(${col}) = ${fmt(value)}`] };
}

function quantileCmd(state: AnalysisState, args: CommandArgs): CommandResult {
  const pTok = args.pos[0];
  if (!pTok) throw new Error("Usage: quantile <p> [col]");
  const p = Number(pTok);
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new Error("quantile p must be in [0, 1]");
  }
  const { name: col, values } = getNumeric(state, args.pos[1]);
  const value = qtile(values, p);
  const next = cloneState(state);
  next.step += 1;
  pushSummary(next.summaries, `quantile@${p}`, col, value, next.step, { p });
  return { state: next, output: [`quantile(${col}, ${p}) = ${fmt(value)}`] };
}

function boxCmd(state: AnalysisState, args: CommandArgs): CommandResult {
  const col = defaultColumn(state, args.pos[0]);
  const next = cloneState(state);
  next.step += 1;
  next.plots = [{ kind: "box", columns: [col] }, ...next.plots].slice(0, 2) as PlotSpec[];
  return { state: next, output: [`box(${col})`] };
}

function plotCmd(state: AnalysisState, kind: PlotSpec["kind"], args: CommandArgs): CommandResult {
  const col = defaultColumn(state, args.pos[0]);
  const next = cloneState(state);
  next.step += 1;
  next.plots = [{ kind, columns: [col] }, ...next.plots].slice(0, 2) as PlotSpec[];
  return { state: next, output: [`${kind}(${col})`] };
}

function sampleCmd(state: AnalysisState, args: CommandArgs): CommandResult {
  const n = Number(args.pos[0] ?? args.opts.n);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Usage: sample <n> [seed=s] [col=c]");
  const draw = Math.min(MAX_SAMPLES, Math.floor(n));
  const seed = args.opts.seed !== undefined ? Number(args.opts.seed) : state.seed + state.step;
  const rng = createRng(seed);
  let values: number[];
  if (args.opts.from === "pop" || args.opts.from === undefined) {
    if (args.opts.col) {
      const pool = getNumeric(state, args.opts.col).values;
      values = sampleEmpirical(pool, rng, draw);
    } else if (state.model && state.model.kind !== "empirical") {
      values = sampleFrom(state.model.kind, state.model.params, rng, draw);
    } else {
      const pool = getNumeric(state).values;
      values = sampleEmpirical(pool, rng, draw);
    }
  } else {
    const pool = getNumeric(state, args.opts.from).values;
    values = sampleEmpirical(pool, rng, draw);
  }

  const next = cloneState(state);
  next.step += 1;
  next.seed = seed;
  const rec: SampleRecord = {
    id: nextSampleId(state.samples),
    n: draw,
    values,
    kind: "raw",
  };
  next.samples = [...next.samples, rec].slice(-MAX_SAMPLES);
  const m = mean(values);
  pushSummary(next.summaries, "sample_mean", `sample#${rec.id}`, m, next.step);
  next.plots = [{ kind: "strip", columns: [getNumeric(state).name], marks: values }, ...next.plots].slice(0, 2) as PlotSpec[];
  return {
    state: next,
    output: [
      `sample #${rec.id} n=${draw} seed=${seed}`,
      `values (first 8): ${values.slice(0, 8).map((v) => fmt(v, 2)).join(", ")}${values.length > 8 ? " ..." : ""}`,
      `sample mean = ${fmt(m)}`,
    ],
  };
}

function bootstrapCmd(state: AnalysisState, args: CommandArgs): CommandResult {
  const B = Number(args.pos[0] ?? args.opts.B);
  if (!Number.isFinite(B) || B <= 0) throw new Error("Usage: bootstrap <B> [stat=mean]");
  const reps = Math.min(MAX_SAMPLES, Math.floor(B));
  const { values, name: col } = getNumeric(state);
  const seed = state.seed + state.step * 17;
  const rng = createRng(seed);
  const means: number[] = [];
  for (let b = 0; b < reps; b += 1) {
    const resample = sampleEmpirical(values, rng, values.length);
    means.push(mean(resample));
  }
  const next = cloneState(state);
  next.step += 1;
  next.seed = seed;
  const rec: SampleRecord = {
    id: nextSampleId(state.samples),
    n: reps,
    values: means,
    kind: "resample_mean",
  };
  next.samples = [...next.samples, rec].slice(-MAX_SAMPLES);
  pushSummary(next.summaries, "bootstrap_mean", col, mean(means), next.step);
  pushSummary(next.summaries, "bootstrap_se", col, standardDeviation(means), next.step);
  next.plots = [{ kind: "bootstrap", columns: [col] }, ...next.plots].slice(0, 2) as PlotSpec[];
  return {
    state: next,
    output: [
      `bootstrap B=${reps} stat=mean on '${col}'`,
      `bootstrap SE = ${fmt(standardDeviation(means))}`,
    ],
  };
}

function ciCmd(state: AnalysisState, args: CommandArgs): CommandResult {
  const level = Number(args.pos[0] ?? args.opts.level ?? 0.95);
  if (!Number.isFinite(level) || level <= 0 || level >= 1) {
    throw new Error("Usage: ci <level in (0,1)> [method=percentile|se]");
  }
  const method = args.opts.method ?? "percentile";
  const { values, name: col } = getNumeric(state);
  const m = mean(values);
  const se = standardError(values);
  const lastBoot = [...state.samples].reverse().find((s) => s.kind === "resample_mean");

  let lo: number;
  let hi: number;
  if (method === "se") {
    // Normal-approx CI
    const z = 1.96; // fixed for 0.95-ish teaching; scale crudely for other levels
    const zScale = level >= 0.99 ? 2.576 : level >= 0.95 ? 1.96 : 1.645;
    void z;
    lo = m - zScale * se;
    hi = m + zScale * se;
  } else if (lastBoot && lastBoot.values.length >= 10) {
    const alpha = (1 - level) / 2;
    lo = qtile(lastBoot.values, alpha);
    hi = qtile(lastBoot.values, 1 - alpha);
  } else {
    const zScale = level >= 0.99 ? 2.576 : level >= 0.95 ? 1.96 : 1.645;
    lo = m - zScale * se;
    hi = m + zScale * se;
  }

  const next = cloneState(state);
  next.step += 1;
  pushSummary(next.summaries, "ci_lo", col, lo, next.step, { level });
  pushSummary(next.summaries, "ci_hi", col, hi, next.step, { level });
  next.plots = [
    { kind: "ci", columns: [col], layers: { level, lo, hi, center: m } },
    ...next.plots,
  ].slice(0, 2) as PlotSpec[];
  return {
    state: next,
    output: [`CI ${fmt(level)} (${method}) for mean(${col}): [${fmt(lo)}, ${fmt(hi)}]`],
  };
}

function ttestCmd(state: AnalysisState, args: CommandArgs): CommandResult {
  const col = args.pos[0];
  if (!col) throw new Error("Usage: ttest <col> mu=<value>");
  const muTok = args.opts.mu;
  if (muTok === undefined) throw new Error("ttest requires mu=");
  const mu = Number(muTok);
  if (!Number.isFinite(mu)) throw new Error("mu must be numeric");
  const { values, name } = getNumeric(state, col);
  const res = tTestOneSample(values, mu);
  const next = cloneState(state);
  next.step += 1;
  next.tests = [
    ...next.tests,
    {
      name: "ttest",
      statistic: res.statistic,
      pValue: res.pValue,
      detail: { mu, df: res.df, sampleMean: res.sampleMean, n: values.length },
    },
  ];
  pushSummary(next.summaries, "ttest_stat", name, res.statistic, next.step);
  pushSummary(next.summaries, "ttest_p", name, res.pValue, next.step);
  return {
    state: next,
    output: [
      `one-sample t(${name}, mu=${mu})`,
      `  t = ${fmt(res.statistic)}  df = ${res.df}  p ≈ ${fmt(res.pValue, 6)}`,
      `  sample mean = ${fmt(res.sampleMean)}`,
    ],
  };
}

function corrCmd(state: AnalysisState, args: CommandArgs): CommandResult {
  const xName = args.pos[0];
  const yName = args.pos[1];
  if (!xName || !yName) throw new Error("Usage: corr <x> <y>");
  const { x, y } = pairedColumns(state.dataset, xName, yName);
  const r = pearson(x, y);
  const next = cloneState(state);
  next.step += 1;
  pushSummary(next.summaries, "corr", `${xName}~${yName}`, r, next.step);
  next.plots = [{ kind: "scatter", columns: [xName, yName] }, ...next.plots].slice(0, 2) as PlotSpec[];
  return { state: next, output: [`corr(${xName}, ${yName}) = ${fmt(r)}`] };
}

function regressCmd(state: AnalysisState, args: CommandArgs): CommandResult {
  // accept `regress y x` or `regress y~x` as one token
  let yName = args.pos[0] ?? "";
  let xName = args.pos[1] ?? "";
  if (!xName && yName.includes("~")) {
    const parts = yName.split("~");
    yName = parts[0] ?? "";
    xName = parts[1] ?? "";
  }
  if (!xName || !yName) throw new Error("Usage: regress <y> <x>   (or regress y~x)");
  const { x, y } = pairedColumns(state.dataset, xName, yName);
  const fit = ols(x, y);
  const next = cloneState(state);
  next.step += 1;
  pushSummary(next.summaries, "slope", `${yName}~${xName}`, fit.slope, next.step);
  pushSummary(next.summaries, "intercept", `${yName}~${xName}`, fit.intercept, next.step);
  pushSummary(next.summaries, "r2", `${yName}~${xName}`, fit.r2, next.step);
  next.plots = [
    {
      kind: "regression",
      columns: [xName, yName],
      layers: {
        slope: fit.slope,
        intercept: fit.intercept,
        r2: fit.r2,
      },
    },
    ...next.plots,
  ].slice(0, 2) as PlotSpec[];
  return {
    state: next,
    output: [
      `ols ${yName} ~ ${xName}`,
      `  slope = ${fmt(fit.slope)}  intercept = ${fmt(fit.intercept)}  R^2 = ${fmt(fit.r2)}`,
    ],
  };
}

function popCmd(state: AnalysisState, args: CommandArgs): CommandResult {
  const kind = args.pos[0];
  if (!kind) throw new Error("Usage: pop normal mu=0 sd=1 | pop binomial n= p= | pop empirical");
  const params: Record<string, number> = {};
  for (const [k, v] of Object.entries(args.opts)) {
    const n = Number(v);
    if (Number.isFinite(n)) params[k] = n;
  }
  const next = cloneState(state);
  next.step += 1;
  next.model = { kind: kind as "normal" | "binomial" | "poisson" | "uniform" | "exponential" | "empirical", params };
  return {
    state: next,
    output: [`population model set: ${kind} ${JSON.stringify(params)}`],
  };
}

function statusCmd(state: AnalysisState): CommandResult {
  const lines = [
    `dataset: ${state.dataset.name} (${state.dataset.id})`,
    `rows: ${state.dataset.columns[0]?.values.length ?? 0}`,
    `columns: ${state.dataset.columns.map((c) => c.name).join(", ")}`,
    `steps: ${state.step}`,
    `samples: ${state.samples.length}`,
    `plots: ${state.plots.map((p) => p.kind).join(", ") || "(none)"}`,
  ];
  if (state.model) {
    lines.push(`model: ${state.model.kind} ${JSON.stringify(state.model.params)}`);
  }
  return { state, output: lines };
}

/** Histogram helper exported for tests / scene renderer. */
export function histOf(values: number[], bins = 0): { edges: number[]; counts: number[] } {
  return histogram(values, bins);
}

/** Quantile helper re-export. */
export { quantile, mean };
