/**
 * Built-in teaching datasets.
 *
 * Datasets are deterministic (hand-authored or generated once with a fixed
 * seed and inlined) so levels stay reproducible across machines.
 */

import type { Column, Dataset } from "./types.js";
import { createRng, sampleFrom } from "./rng.js";

/**
 * Build a numeric column from values.
 *
 * @param name - Column name.
 * @param values - Numeric cells (null allowed).
 * @returns Typed column.
 */
export function numCol(name: string, values: (number | null)[]): Column {
  return { name, type: "numeric", values };
}

/**
 * Build a categorical column from values.
 *
 * @param name - Column name.
 * @param values - Category labels (null allowed).
 * @returns Typed column.
 */
export function catCol(name: string, values: (string | null)[]): Column {
  return { name, type: "categorical", values };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Simulated restaurant wait times (minutes), right-skewed. */
function restaurantWait(): Dataset {
  const rng = createRng(1367);
  const raw = sampleFrom("exponential", { lambda: 1 / 12 }, rng, 120).map((v) =>
    round2(4 + v),
  );
  const day = raw.map((_, i) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7] as string);
  return {
    id: "restaurant_wait",
    name: "Restaurant wait times",
    meta: {
      description:
        "Simulated lunch rush waits (minutes). Right-skewed — mean exceeds median.",
      source: "Synthetic, exponential(λ=1/12) shifted by 4 minutes.",
    },
    columns: [numCol("wait", raw), catCol("day", day)],
  };
}

/** A/B conversion experiment. */
function abClicks(): Dataset {
  const rng = createRng(4242);
  const n = 400;
  const group: string[] = [];
  const converted: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const isB = i % 2 === 0;
    group.push(isB ? "B" : "A");
    const p = isB ? 0.12 : 0.09;
    converted.push(rng() < p ? 1 : 0);
  }
  return {
    id: "ab_clicks",
    name: "Homepage A/B clicks",
    meta: {
      description:
        "Conversion events for layout A vs B. B has a small true lift.",
      source: "Synthetic Bernoulli with p_A=0.09, p_B=0.12.",
    },
    columns: [catCol("group", group), numCol("converted", converted)],
  };
}

/** Two correlated numeric features (study hours vs score). */
function studyScore(): Dataset {
  const rng = createRng(77);
  const n = 80;
  const hours: number[] = [];
  const score: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const h = round2(2 + sampleFrom("uniform", { min: 0, max: 1 }, rng, 1)[0]! * 8);
    const noise = sampleFrom("normal", { mu: 0, sd: 6 }, rng, 1)[0]!;
    const s = Math.max(0, Math.min(100, round2(35 + 6 * h + noise)));
    hours.push(h);
    score.push(s);
  }
  return {
    id: "study_score",
    name: "Study hours vs exam score",
    meta: {
      description: "Positive linear relationship with Gaussian noise.",
      source: "Synthetic: score = 35 + 6*hours + N(0, 6), clipped to [0, 100].",
    },
    columns: [numCol("hours", hours), numCol("score", score)],
  };
}

/** Heights (cm) roughly normal — good for CLT demos. */
function adultHeights(): Dataset {
  const rng = createRng(2024);
  const n = 250;
  const sex: string[] = [];
  const height: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const male = rng() < 0.5;
    sex.push(male ? "M" : "F");
    const mu = male ? 176 : 163;
    const h = round2(sampleFrom("normal", { mu, sd: 7 }, rng, 1)[0]!);
    height.push(h);
  }
  return {
    id: "adult_heights",
    name: "Adult heights (cm)",
    meta: {
      description: "Near-normal heights, useful for sampling distributions.",
      source: "Synthetic mixture of two normals by sex.",
    },
    columns: [numCol("height", height), catCol("sex", sex)],
  };
}

/** Tiny clean sample for first descriptive levels. */
function quizScores(): Dataset {
  const values = [62, 70, 71, 75, 78, 80, 82, 85, 88, 95];
  return {
    id: "quiz_scores",
    name: "Quiz scores",
    meta: {
      description: "Ten exam scores — hand-picked so medians and means are clean.",
      source: "Authored teaching table.",
    },
    columns: [numCol("score", values)],
  };
}

/** Catalog of built-in datasets keyed by id. */
export const DATASETS: Record<string, Dataset> = {
  restaurant_wait: restaurantWait(),
  ab_clicks: abClicks(),
  study_score: studyScore(),
  adult_heights: adultHeights(),
  quiz_scores: quizScores(),
};

/**
 * Resolve a dataset by id.
 *
 * @param id - Dataset id.
 * @returns Dataset instance.
 * @throws Error if unknown.
 */
export function getDataset(id: string): Dataset {
  const ds = DATASETS[id];
  if (!ds) {
    const known = Object.keys(DATASETS).join(", ");
    throw new Error(`Unknown dataset '${id}'. Known: ${known}`);
  }
  // Deep-ish copy so undo/reset sessions do not share mutable arrays.
  const copy: Dataset = {
    id: ds.id,
    name: ds.name,
    columns: ds.columns.map((c) => ({ ...c, values: [...c.values] })),
  };
  if (ds.meta) {
    copy.meta = { ...ds.meta };
  }
  return copy;
}

/**
 * Extract non-null numeric values for a column.
 *
 * @param ds - Dataset.
 * @param column - Column name. Defaults to first numeric column.
 * @returns Numeric values and the resolved column name.
 */
export function numericColumn(
  ds: Dataset,
  column?: string,
): { name: string; values: number[] } {
  const col = column
    ? ds.columns.find((c) => c.name === column)
    : ds.columns.find((c) => c.type === "numeric");
  if (!col) {
    throw new Error(
      column
        ? `Column '${column}' not found in dataset '${ds.id}'`
        : `Dataset '${ds.id}' has no numeric column`,
    );
  }
  if (col.type !== "numeric") {
    throw new Error(`Column '${col.name}' is ${col.type}, expected numeric`);
  }
  const values = col.values.filter((v): v is number => typeof v === "number");
  return { name: col.name, values };
}

/**
 * Extract paired numeric columns.
 *
 * @param ds - Dataset.
 * @param xName - First column.
 * @param yName - Second column.
 * @returns Paired samples (rows with both present).
 */
export function pairedColumns(
  ds: Dataset,
  xName: string,
  yName: string,
): { x: number[]; y: number[] } {
  const xCol = ds.columns.find((c) => c.name === xName);
  const yCol = ds.columns.find((c) => c.name === yName);
  if (!xCol || !yCol) {
    throw new Error(`Columns '${xName}' and '${yName}' must both exist`);
  }
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < xCol.values.length; i += 1) {
    const a = xCol.values[i];
    const b = yCol.values[i];
    if (typeof a === "number" && typeof b === "number") {
      x.push(a);
      y.push(b);
    }
  }
  return { x, y };
}
