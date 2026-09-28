/**
 * Pure descriptive statistics over numeric samples.
 *
 * All functions reject empty input with a clear Error. Missing values must be
 * stripped by the caller (see `numericColumn`).
 */

import { quantile as quantileImpl, twoSidedNormalP } from "./rng.js";

/** Mean of a numeric sample. */
export function mean(values: number[]): number {
  if (values.length === 0) throw new Error("mean of empty sample");
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/** Sample median (type-7 style interpolation via quantile 0.5). */
export function median(values: number[]): number {
  return quantileImpl(values, 0.5);
}

/** Inclusive quantile. */
export function quantile(values: number[], p: number): number {
  return quantileImpl(values, p);
}

/** Sample variance with Bessel correction (ddof = 1). */
export function variance(values: number[]): number {
  if (values.length < 2) throw new Error("variance requires at least 2 points");
  const m = mean(values);
  let ss = 0;
  for (const v of values) {
    const d = v - m;
    ss += d * d;
  }
  return ss / (values.length - 1);
}

/** Sample standard deviation (ddof = 1). */
export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

/** Standard error of the mean. */
export function standardError(values: number[]): number {
  return standardDeviation(values) / Math.sqrt(values.length);
}

/** Sample skewness (G1, adjusted Fisher–Pearson). */
export function skewness(values: number[]): number {
  const n = values.length;
  if (n < 3) throw new Error("skewness requires at least 3 points");
  const m = mean(values);
  const s = standardDeviation(values);
  if (s === 0) return 0;
  let m3 = 0;
  for (const v of values) {
    const z = (v - m) / s;
    m3 += z * z * z;
  }
  return (Math.sqrt(n * (n - 1)) / (n - 2)) * (m3 / n);
}

/** Interquartile range. */
export function iqr(values: number[]): number {
  return quantileImpl(values, 0.75) - quantileImpl(values, 0.25);
}

/** Five-number summary. */
export function fiveNumber(values: number[]): {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0] as number,
    q1: quantileImpl(values, 0.25),
    median: quantileImpl(values, 0.5),
    q3: quantileImpl(values, 0.75),
    max: sorted[sorted.length - 1] as number,
  };
}

/**
 * Pearson correlation.
 *
 * @param x - First sample.
 * @param y - Second sample (same length).
 * @returns Correlation in [-1, 1].
 */
export function pearson(x: number[], y: number[]): number {
  if (x.length !== y.length) throw new Error("pearson requires equal-length samples");
  if (x.length < 2) throw new Error("pearson requires at least 2 points");
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = (x[i] as number) - mx;
    const dy = (y[i] as number) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  if (denom === 0) return 0;
  return sxy / denom;
}

/**
 * Simple OLS: y = intercept + slope * x.
 *
 * @param x - Predictor.
 * @param y - Response.
 * @returns Coefficients and R^2.
 */
export function ols(
  x: number[],
  y: number[],
): { intercept: number; slope: number; r2: number } {
  if (x.length !== y.length) throw new Error("ols requires equal-length samples");
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = (x[i] as number) - mx;
    const dy = (y[i] as number) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const ssTot = syy;
  let ssRes = 0;
  for (let i = 0; i < x.length; i += 1) {
    const pred = intercept + slope * (x[i] as number);
    const e = (y[i] as number) - pred;
    ssRes += e * e;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { intercept, slope, r2 };
}

/**
 * One-sample t statistic (mu0 vs sample mean).
 * Uses a normal approximation for the p-value in v0.
 *
 * @param values - Sample.
 * @param mu0 - Null mean.
 * @returns Statistic and approximate two-sided p-value.
 */
export function tTestOneSample(
  values: number[],
  mu0: number,
): { statistic: number; pValue: number; df: number; sampleMean: number } {
  const sampleMean = mean(values);
  const se = standardError(values);
  const statistic = se === 0 ? 0 : (sampleMean - mu0) / se;
  const pValue = twoSidedNormalP(statistic);
  return { statistic, pValue, df: values.length - 1, sampleMean };
}

/** Histogram bin counts using a simple square-root rule. */
export function histogram(
  values: number[],
  bins = 0,
): { edges: number[]; counts: number[] } {
  if (values.length === 0) throw new Error("histogram of empty sample");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = max - min || 1;
  const k =
    bins > 0 ? bins : Math.max(5, Math.min(30, Math.ceil(Math.sqrt(values.length))));
  const edges: number[] = [];
  for (let i = 0; i <= k; i += 1) {
    edges.push(min + (width * i) / k);
  }
  const counts = new Array<number>(k).fill(0);
  for (const v of values) {
    let idx = Math.floor(((v - min) / width) * k);
    if (idx === k) idx = k - 1;
    idx = Math.min(k - 1, Math.max(0, idx));
    counts[idx] = (counts[idx] as number) + 1;
  }
  return { edges, counts };
}
