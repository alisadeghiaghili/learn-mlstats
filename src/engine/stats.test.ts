/**
 * Unit tests for descriptive statistics.
 */

import { describe, expect, it } from "vitest";
import {
  fiveNumber,
  histogram,
  iqr,
  mean,
  median,
  ols,
  pearson,
  quantile,
  standardDeviation,
  standardError,
  variance,
} from "./stats.js";

describe("mean / median / quantile", () => {
  it("computes mean", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it("rejects empty mean", () => {
    expect(() => mean([])).toThrow(/empty/);
  });

  it("computes median for even and odd", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("computes quantile with interpolation", () => {
    expect(quantile([0, 10], 0.5)).toBe(5);
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4, 5], 1)).toBe(5);
  });
});

describe("spread", () => {
  it("uses Bessel correction for variance", () => {
    // sample variance of [2,4,4,4,5,5,7,9] = 4.571428...
    const v = variance([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(v).toBeCloseTo(32 / 7, 10);
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 10);
  });

  it("computes SE as sd / sqrt(n)", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(standardError(xs)).toBeCloseTo(standardDeviation(xs) / Math.sqrt(5), 10);
  });

  it("computes iqr and five number", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(iqr(xs)).toBeCloseTo(quantile(xs, 0.75) - quantile(xs, 0.25), 10);
    const five = fiveNumber(xs);
    expect(five.min).toBe(1);
    expect(five.max).toBe(9);
    expect(five.median).toBe(5);
  });
});

describe("pearson / ols", () => {
  it("perfect positive correlation", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });

  it("perfect negative correlation", () => {
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it("fits OLS for y = 3 + 2x", () => {
    const x = [0, 1, 2, 3];
    const y = x.map((v) => 3 + 2 * v);
    const fit = ols(x, y);
    expect(fit.slope).toBeCloseTo(2, 10);
    expect(fit.intercept).toBeCloseTo(3, 10);
    expect(fit.r2).toBeCloseTo(1, 10);
  });
});

describe("histogram", () => {
  it("bins by sqrt rule and preserves mass", () => {
    const xs = Array.from({ length: 100 }, (_, i) => i);
    const { counts, edges } = histogram(xs);
    expect(edges.length).toBe(counts.length + 1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(counts.length).toBeGreaterThanOrEqual(5);
    expect(counts.length).toBeLessThanOrEqual(30);
  });
});
