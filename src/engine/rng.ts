/**
 * Deterministic RNG and distribution sampling utilities.
 *
 * Uses mulberry32 for portable, reproducible streams — required by level
 * seeds and shareable command replays.
 */

/**
 * Create a seeded uniform RNG in [0, 1).
 *
 * @param seed - Integer seed.
 * @returns Function returning the next uniform variate.
 * @example
 * const rng = createRng(42);
 * const x = rng(); // always the same for seed 42
 */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample `n` standard normals via Box–Muller.
 *
 * @param rng - Uniform RNG.
 * @param n - Number of draws.
 * @returns Array of standard normal draws.
 */
export function sampleStandardNormal(rng: () => number, n: number): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const u = Math.max(rng(), Number.EPSILON);
    const v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    out.push(r * Math.cos(2 * Math.PI * v));
    if (out.length < n) {
      out.push(r * Math.sin(2 * Math.PI * v));
    }
  }
  return out;
}

/**
 * Draw from a named distribution.
 *
 * @param kind - Family name.
 * @param params - Family parameters.
 * @param rng - Uniform RNG.
 * @param n - Number of draws.
 * @returns Sampled values.
 * @example
 * sampleFrom("normal", { mu: 0, sd: 1 }, rng, 10);
 */
export function sampleFrom(
  kind: string,
  params: Record<string, number>,
  rng: () => number,
  n: number,
): number[] {
  switch (kind) {
    case "normal": {
      const mu = params.mu ?? 0;
      const sd = params.sd ?? 1;
      return sampleStandardNormal(rng, n).map((z) => mu + sd * z);
    }
    case "binomial": {
      const trials = Math.max(1, Math.round(params.n ?? 1));
      const p = params.p ?? 0.5;
      const out: number[] = [];
      for (let i = 0; i < n; i += 1) {
        let hits = 0;
        for (let k = 0; k < trials; k += 1) {
          if (rng() < p) hits += 1;
        }
        out.push(hits);
      }
      return out;
    }
    case "poisson": {
      const lambda = Math.max(params.lambda ?? 1, 1e-9);
      const out: number[] = [];
      for (let i = 0; i < n; i += 1) {
        const limit = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
          k += 1;
          p *= rng();
        } while (p > limit);
        out.push(k - 1);
      }
      return out;
    }
    case "uniform": {
      const min = params.min ?? 0;
      const max = params.max ?? 1;
      return Array.from({ length: n }, () => min + (max - min) * rng());
    }
    case "exponential": {
      const lambda = Math.max(params.lambda ?? 1, 1e-9);
      return Array.from({ length: n }, () => -Math.log(Math.max(rng(), Number.EPSILON)) / lambda);
    }
    case "empirical": {
      // Resample with replacement from params-encoded pool is handled by caller.
      throw new Error("empirical sampling must use sampleEmpirical");
    }
    default:
      throw new Error(`Unknown distribution kind: ${kind}`);
  }
}

/**
 * Resample with replacement from an empirical pool.
 *
 * @param pool - Source values.
 * @param rng - Uniform RNG.
 * @param n - Draw size.
 * @returns Sample with replacement.
 */
export function sampleEmpirical(pool: number[], rng: () => number, n: number): number[] {
  if (pool.length === 0) {
    throw new Error("Cannot sample from an empty pool");
  }
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    out.push(pool[idx] as number);
  }
  return out;
}

/**
 * Inclusive linear quantile of a sorted-or-unsorted sample.
 *
 * @param values - Numeric sample.
 * @param p - Probability in [0, 1].
 * @returns Interpolated quantile.
 */
export function quantile(values: number[], p: number): number {
  if (values.length === 0) {
    throw new Error("quantile of empty sample");
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] as number;
  const clamped = Math.min(1, Math.max(0, p));
  const pos = (sorted.length - 1) * clamped;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const w = pos - lo;
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a * (1 - w) + b * w;
}

/**
 * Standard normal PDF.
 *
 * @param x - Point.
 * @returns Density value.
 */
export function normalPdf(x: number, mu = 0, sd = 1): number {
  const z = (x - mu) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/**
 * Error function approximation (Abramowitz–Stegun 7.1.26 style).
 *
 * @param x - Real input.
 * @returns erf(x).
 */
function erf(x: number): number {
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.5 * ax);
  // Horner form of the A&S 7.1.26 polynomial.
  const coeffs = [
    1.00002368, 0.37409196, 0.09678418, -0.18628806, 0.27886807, -1.13520398,
    1.48851587, -0.82215223, 0.17087277,
  ];
  let poly = coeffs[coeffs.length - 1];
  for (let i = coeffs.length - 2; i >= 0; i -= 1) {
    poly = (coeffs[i] as number) + t * (poly as number);
  }
  const y = t * Math.exp(-ax * ax - 1.26551223 + t * (poly as number));
  return x >= 0 ? 1 - y : y - 1;
}

/**
 * Standard normal CDF.
 *
 * @param x - Point.
 * @param mu - Mean.
 * @param sd - Std. dev.
 * @returns P(X <= x).
 */
export function normalCdf(x: number, mu = 0, sd = 1): number {
  const z = (x - mu) / (sd * Math.SQRT2);
  return 0.5 * (1 + erf(z));
}

/**
 * Two-sided survival probability for a t-like z approximation (normal).
 * Good enough for v0 teaching levels; swap for true t later.
 *
 * @param stat - Test statistic.
 * @returns Approximate two-sided p-value.
 */
export function twoSidedNormalP(stat: number): number {
  return 2 * (1 - normalCdf(Math.abs(stat)));
}
