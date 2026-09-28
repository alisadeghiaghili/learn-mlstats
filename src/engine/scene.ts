/**
 * Pure scene-graph renderer: AnalysisState + plots → drawable primitives.
 *
 * The UI SVG host maps SceneNode[] to elements. Keeping this pure makes every
 * visualization snapshot-testable without a DOM.
 */

import type {
  AnalysisState,
  PlotSpec,
  SceneFrame,
  SceneNode,
} from "./types.js";
import { histogram, mean, quantile, standardDeviation } from "./stats.js";
import { normalPdf } from "./rng.js";
import { numericColumn, pairedColumns } from "./datasets.js";

const PAPER = "#F4F0E8";
const INK = "#1C1F26";
const INK_SOFT = "#5C6470";
const ACCENT = "#E85D4C";
const THEORY = "#3D5A80";
const WARN = "#C9A227";

/** Default frame box for a plot layer. */
export const FRAME_W = 640;
export const FRAME_H = 280;

/**
 * Render every active plot in state into scene frames.
 *
 * @param state - Current analysis state.
 * @returns Frames in paint order (first = top layer).
 * @example
 * const frames = renderScene(state);
 */
export function renderScene(state: AnalysisState): SceneFrame[] {
  return state.plots.map((plot) => renderPlot(state, plot));
}

function renderPlot(state: AnalysisState, plot: PlotSpec): SceneFrame {
  switch (plot.kind) {
    case "hist":
    case "density":
    case "qq":
    case "box":
    case "strip":
      return renderUnivariate(state, plot);
    case "bootstrap":
    case "sampling_means":
      return renderResample(state, plot);
    case "ci":
      return renderCi(state, plot);
    case "scatter":
    case "regression":
      return renderBivariate(state, plot);
    case "pmf":
      return renderPmf(state, plot);
    default:
      return { plot, nodes: [], caption: `Unsupported plot ${plot.kind}` };
  }
}

function axes(xLabel: string, yLabel: string, xMax: number, _yMax: number): SceneNode[] {
  const nodes: SceneNode[] = [];
  nodes.push({
    kind: "line",
    x1: 40,
    y1: FRAME_H - 30,
    x2: FRAME_W - 10,
    y2: FRAME_H - 30,
    stroke: INK_SOFT,
    strokeWidth: 1,
  });
  nodes.push({
    kind: "line",
    x1: 40,
    y1: 10,
    x2: 40,
    y2: FRAME_H - 30,
    stroke: INK_SOFT,
    strokeWidth: 1,
  });
  nodes.push({
    kind: "text",
    x: FRAME_W - 10,
    y: FRAME_H - 8,
    text: xLabel,
    fill: INK_SOFT,
    size: 11,
    anchor: "end",
  });
  nodes.push({
    kind: "text",
    x: 48,
    y: 16,
    text: yLabel,
    fill: INK_SOFT,
    size: 11,
    anchor: "start",
  });
  nodes.push({
    kind: "text",
    x: FRAME_W - 12,
    y: FRAME_H - 40,
    text: fmtTick(xMax),
    fill: INK_SOFT,
    size: 10,
    anchor: "end",
  });
  return nodes;
}

function fmtTick(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function renderUnivariate(state: AnalysisState, plot: PlotSpec): SceneFrame {
  const colName = plot.columns[0];
  const values = plot.kind === "strip" && plot.marks && plot.marks.length > 0
    ? plot.marks
    : numericColumn(state.dataset, colName).values;
  const col = colName ?? numericColumn(state.dataset).name;

  if (values.length === 0) {
    return { plot, nodes: [], caption: "No data" };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const nodes: SceneNode[] = [];

  if (plot.kind === "hist" || plot.kind === "density") {
    const { counts } = histogram(values);
    const maxCount = Math.max(...counts, 1);
    const plotW = FRAME_W - 50;
    const plotH = FRAME_H - 50;
    nodes.push(...axes(col, "count", max, maxCount));
    for (let i = 0; i < counts.length; i += 1) {
      const c = counts[i] as number;
      const w = plotW / counts.length - 2;
      const h = (c / maxCount) * plotH;
      const x = 40 + (i * plotW) / counts.length;
      nodes.push({
        kind: "rect",
        x,
        y: FRAME_H - 30 - h,
        w: Math.max(2, w),
        h,
        fill: ACCENT,
        opacity: 0.85,
      });
    }
    if (plot.kind === "density") {
      nodes.push(...normalCurveOverlay(values, min, max, maxCount));
    }
    return {
      plot,
      nodes,
      caption: `${plot.kind}(${col}) n=${values.length} bins=${counts.length}`,
    };
  }

  if (plot.kind === "strip") {
    nodes.push(...axes(col, "i", max, values.length));
    const plotW = FRAME_W - 50;
    for (let i = 0; i < values.length; i += 1) {
      const v = values[i] as number;
      const x = 40 + ((v - min) / (max - min || 1)) * plotW;
      nodes.push({
        kind: "circle",
        x,
        y: FRAME_H - 30 - 40 - ((i * 37) % 80),
        r: 3.5,
        fill: ACCENT,
        opacity: 0.75,
      });
    }
    const m = mean(values);
    const xM = 40 + ((m - min) / (max - min || 1)) * plotW;
    nodes.push({
      kind: "line",
      x1: xM,
      y1: 10,
      x2: xM,
      y2: FRAME_H - 30,
      stroke: THEORY,
      strokeWidth: 1.5,
    });
    return { plot, nodes, caption: `strip(${col}) n=${values.length} mean=${m.toFixed(3)}` };
  }

  if (plot.kind === "box") {
    const q1 = quantile(values, 0.25);
    const q2 = quantile(values, 0.5);
    const q3 = quantile(values, 0.75);
    nodes.push(...axes(col, "", max, 1));
    const sx = (v: number) => 60 + ((v - min) / (max - min || 1)) * (FRAME_W - 100);
    const y = FRAME_H / 2;
    nodes.push({
      kind: "line",
      x1: sx(Math.min(...values)),
      y1: y,
      x2: sx(Math.max(...values)),
      y2: y,
      stroke: INK,
      strokeWidth: 1,
    });
    nodes.push({
      kind: "rect",
      x: sx(q1),
      y: y - 28,
      w: Math.max(2, sx(q3) - sx(q1)),
      h: 56,
      fill: THEORY,
      opacity: 0.35,
    });
    nodes.push({
      kind: "line",
      x1: sx(q2),
      y1: y - 28,
      x2: sx(q2),
      y2: y + 28,
      stroke: ACCENT,
      strokeWidth: 2,
    });
    return {
      plot,
      nodes,
      caption: `box(${col}) q1=${q1.toFixed(2)} med=${q2.toFixed(2)} q3=${q3.toFixed(2)}`,
    };
  }

  // qq: theoretical normal quantiles vs sample
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  nodes.push(...axes("theoretical", col, 3, max));
  for (let i = 0; i < n; i += 1) {
    const p = (i + 0.5) / n;
    // crude inverse normal via quantile of standardized sample vs p
    const z = inverseNormal(p);
    const x = 40 + ((z + 3) / 6) * (FRAME_W - 50);
    const y = FRAME_H - 30 - ((sorted[i] as number) - min) / (max - min || 1) * (FRAME_H - 50);
    nodes.push({ kind: "circle", x, y, r: 2.5, fill: ACCENT, opacity: 0.8 });
  }
  return { plot, nodes, caption: `qq(${col}) n=${n}` };
}

function inverseNormal(p: number): number {
  // Acklam's approximation is overkill; use a rational-lite Beasley-Springer/Moro style.
  if (p <= 0) return -4;
  if (p >= 1) return 4;
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  let x: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    x =
      (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  return x;
}

function normalCurveOverlay(
  values: number[],
  min: number,
  max: number,
  maxCount: number,
): SceneNode[] {
  const m = mean(values);
  const s = standardDeviation(values) || 1;
  const n = values.length;
  const plotW = FRAME_W - 50;
  const plotH = FRAME_H - 50;
  const points: string[] = [];
  for (let i = 0; i <= 60; i += 1) {
    const v = min + ((max - min) * i) / 60;
    const dens = normalPdf(v, m, s) * n * ((max - min) / Math.max(5, Math.sqrt(n)));
    const x = 40 + (i / 60) * plotW;
    const y = FRAME_H - 30 - (dens / maxCount) * plotH;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return [
    {
      kind: "path",
      d: `M ${points.join(" L ")}`,
      stroke: THEORY,
      fill: "none",
      strokeWidth: 1.5,
    },
  ];
}

function renderResample(state: AnalysisState, plot: PlotSpec): SceneFrame {
  const col = plot.columns[0] ?? numericColumn(state.dataset).name;
  const rec =
    [...state.samples].reverse().find((s) => s.kind === "resample_mean" || s.kind === "mean") ??
    state.samples[state.samples.length - 1];
  if (!rec) {
    return { plot, nodes: [], caption: "Run bootstrap or sample first" };
  }
  const values = rec.values;
  const { counts } = histogram(values);
  const maxCount = Math.max(...counts, 1);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const nodes: SceneNode[] = axes(col, "count", max, maxCount);
  const plotW = FRAME_W - 50;
  const plotH = FRAME_H - 50;
  for (let i = 0; i < counts.length; i += 1) {
    const c = counts[i] as number;
    const w = plotW / counts.length - 2;
    const h = (c / maxCount) * plotH;
    const x = 40 + (i * plotW) / counts.length;
    nodes.push({
      kind: "rect",
      x,
      y: FRAME_H - 30 - h,
      w: Math.max(2, w),
      h,
      fill: rec.kind === "resample_mean" ? THEORY : ACCENT,
      opacity: 0.8,
    });
  }
  const m = mean(values);
  const xM = 40 + ((m - min) / (max - min || 1)) * plotW;
  nodes.push({
    kind: "line",
    x1: xM,
    y1: 10,
    x2: xM,
    y2: FRAME_H - 30,
    stroke: WARN,
    strokeWidth: 1.5,
    dash: "4 3",
  });
  return {
    plot,
    nodes,
    caption: `${rec.kind === "resample_mean" ? "bootstrap means" : "sample"} n=${values.length} mean=${m.toFixed(4)}`,
  };
}

function renderCi(_state: AnalysisState, plot: PlotSpec): SceneFrame {
  const col = plot.columns[0] ?? "";
  const layers = plot.layers ?? {};
  const lo = Number(layers.lo ?? 0);
  const hi = Number(layers.hi ?? 0);
  const center = Number(layers.center ?? (lo + hi) / 2);
  const nodes: SceneNode[] = axes("value", "CI", hi, 1);
  const min = Math.min(lo, center) - Math.abs(center - lo) * 0.5 - 0.1;
  const max = Math.max(hi, center) + Math.abs(hi - center) * 0.5 + 0.1;
  const sx = (v: number) => 60 + ((v - min) / (max - min || 1)) * (FRAME_W - 120);
  const y = FRAME_H / 2;
  nodes.push({
    kind: "line",
    x1: sx(lo),
    y1: y,
    x2: sx(hi),
    y2: y,
    stroke: THEORY,
    strokeWidth: 3,
  });
  nodes.push({ kind: "circle", x: sx(center), y, r: 6, fill: ACCENT });
  nodes.push({
    kind: "text",
    x: sx(lo),
    y: y + 24,
    text: lo.toFixed(3),
    fill: INK_SOFT,
    size: 11,
    anchor: "middle",
  });
  nodes.push({
    kind: "text",
    x: sx(hi),
    y: y + 24,
    text: hi.toFixed(3),
    fill: INK_SOFT,
    size: 11,
    anchor: "middle",
  });
  return {
    plot,
    nodes,
    caption: `ci(${col}) [${lo.toFixed(3)}, ${hi.toFixed(3)}] center=${center.toFixed(3)}`,
  };
}

function renderBivariate(state: AnalysisState, plot: PlotSpec): SceneFrame {
  const xName = plot.columns[0] ?? "";
  const yName = plot.columns[1] ?? "";
  const { x, y } = pairedColumns(state.dataset, xName, yName);
  const minX = Math.min(...x);
  const maxX = Math.max(...x);
  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  const nodes: SceneNode[] = axes(xName, yName, maxX, maxY);
  const plotW = FRAME_W - 60;
  const plotH = FRAME_H - 50;
  const sx = (v: number) => 40 + ((v - minX) / (maxX - minX || 1)) * plotW;
  const sy = (v: number) => FRAME_H - 30 - ((v - minY) / (maxY - minY || 1)) * plotH;
  for (let i = 0; i < x.length; i += 1) {
    nodes.push({
      kind: "circle",
      x: sx(x[i] as number),
      y: sy(y[i] as number),
      r: 3,
      fill: ACCENT,
      opacity: 0.7,
    });
  }
  if (plot.kind === "regression") {
    const slope = Number(plot.layers?.slope ?? 0);
    const intercept = Number(plot.layers?.intercept ?? 0);
    const y1 = intercept + slope * minX;
    const y2 = intercept + slope * maxX;
    nodes.push({
      kind: "line",
      x1: sx(minX),
      y1: sy(y1),
      x2: sx(maxX),
      y2: sy(y2),
      stroke: THEORY,
      strokeWidth: 2,
    });
    const r2 = Number(plot.layers?.r2 ?? 0);
    nodes.push({
      kind: "text",
      x: FRAME_W - 16,
      y: 24,
      text: `R² = ${r2.toFixed(3)}`,
      fill: INK,
      size: 12,
      anchor: "end",
    });
    return {
      plot,
      nodes,
      caption: `regression ${yName} ~ ${xName} slope=${slope.toFixed(3)}`,
    };
  }
  return { plot, nodes, caption: `scatter ${yName} vs ${xName} n=${x.length}` };
}

function renderPmf(state: AnalysisState, plot: PlotSpec): SceneFrame {
  const col = plot.columns[0] ?? "";
  let values: number[];
  try {
    values = numericColumn(state.dataset, col).values;
  } catch {
    values = [];
  }
  if (values.length === 0 && state.model) {
    // theoretical bins not supported yet — show model label
    return {
      plot,
      nodes: [
        {
          kind: "text",
          x: 40,
          y: 40,
          text: `model ${state.model.kind} ${JSON.stringify(state.model.params)}`,
          fill: INK,
          size: 14,
        },
      ],
      caption: "pmf (model)",
    };
  }
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const keys = [...counts.keys()].sort((a, b) => a - b);
  const maxCount = Math.max(...counts.values(), 1);
  const nodes: SceneNode[] = axes(col, "p", keys[keys.length - 1] ?? 1, maxCount);
  const plotW = FRAME_W - 50;
  const plotH = FRAME_H - 50;
  keys.forEach((k, i) => {
    const c = counts.get(k) ?? 0;
    const h = (c / maxCount) * plotH;
    const x = 40 + ((i + 0.5) / keys.length) * plotW;
    nodes.push({
      kind: "rect",
      x: x - 6,
      y: FRAME_H - 30 - h,
      w: 12,
      h,
      fill: THEORY,
      opacity: 0.85,
    });
    nodes.push({
      kind: "text",
      x,
      y: FRAME_H - 16,
      text: String(k),
      fill: INK_SOFT,
      size: 10,
      anchor: "middle",
    });
  });
  return { plot, nodes, caption: `pmf(${col}) support=${keys.length}` };
}

export { PAPER, INK, INK_SOFT, ACCENT, THEORY, WARN };
