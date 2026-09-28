/**
 * Bundled level catalog.
 *
 * Levels are data. The session controller loads them by id; a future level
 * builder can write the same JSON shape.
 */

import type { LevelDef } from "../engine/types.js";

/** All levels in curriculum order. */
export const LEVELS: LevelDef[] = [
  {
    id: "desc-01-mean",
    series: "descriptive",
    title: "Find the center",
    narrative:
      "The quiz scores are loaded. Compute the arithmetic mean of `score`. The mean is the balance point of the data — sensitive to every value, including outliers.",
    start: {
      dataset: "quiz_scores",
      seed: 42,
      plots: [{ kind: "hist", columns: ["score"] }],
    },
    goal: {
      type: "summary",
      name: "mean",
      column: "score",
    },
    golf: 1,
    hints: ["mean score", "mean also works without naming the only numeric column."],
  },
  {
    id: "desc-02-median",
    series: "descriptive",
    title: "Median and outliers",
    narrative:
      "Compute the median of `score`. The median ignores how far the extremes sit — it only cares about order. When mean and median disagree, the distribution is asymmetric.",
    start: {
      dataset: "quiz_scores",
      seed: 42,
      plots: [{ kind: "box", columns: ["score"] }],
    },
    goal: {
      type: "summary",
      name: "median",
      column: "score",
    },
    golf: 1,
    hints: ["median score"],
  },
  {
    id: "desc-03-spread",
    series: "descriptive",
    title: "Measure the spread",
    narrative:
      "Compute the standard deviation of `score`. SD is in the same units as the data. Compare it to `var` and `iqr` — variance is SD squared (units²), IQR is the robust spread.",
    start: {
      dataset: "quiz_scores",
      seed: 42,
    },
    goal: {
      type: "summary",
      name: "sd",
      column: "score",
    },
    golf: 1,
    hints: ["sd score", "sd"],
  },
  {
    id: "desc-04-skew",
    series: "descriptive",
    title: "See the skew",
    narrative:
      "Restaurant waits are right-skewed: many short waits, a long tail of slow ones. Plot `wait` and compute skewness. Expect mean > median and positive skew.",
    start: {
      dataset: "restaurant_wait",
      seed: 42,
    },
    goal: {
      type: "plot",
      kind: "hist",
      columns: ["wait"],
    },
    golf: 1,
    hints: ["hist wait", "skew wait"],
  },
  {
    id: "desc-05-quantile",
    series: "descriptive",
    title: "Quantiles",
    narrative:
      "Compute the 0.9 quantile of `wait`. Quantiles cut the distribution at a cumulative probability. p90 is the value 90% of waits fall below — the SLA number ops teams actually use.",
    start: {
      dataset: "restaurant_wait",
      seed: 42,
    },
    goal: {
      type: "summary",
      name: "quantile@0.9",
      column: "wait",
    },
    golf: 1,
    hints: ["quantile 0.9 wait"],
  },
  {
    id: "samp-01-sample",
    series: "sampling",
    title: "Draw a sample",
    narrative:
      "Heights are approximately normal. Draw a sample of n=30 from the data. The sample mean will not equal the population mean — that gap is sampling error, not a bug.",
    start: {
      dataset: "adult_heights",
      seed: 42,
      plots: [{ kind: "hist", columns: ["height"] }],
    },
    goal: {
      type: "sample",
      stat: "mean",
      n: 30,
      within: 4.5,
      populationMean: 169.5,
    },
    golf: 1,
    hints: ["sample 30", "sample 30 seed=1  (if you get unlucky, reseed)"],
  },
  {
    id: "samp-02-bootstrap",
    series: "sampling",
    title: "Bootstrap the mean",
    narrative:
      "Bootstrap: resample with replacement from your sample, recompute the mean many times. Run `bootstrap 500` on `height`. The cloud of replicate means estimates the sampling distribution of the mean.",
    start: {
      dataset: "adult_heights",
      seed: 42,
    },
    goal: {
      type: "plot",
      kind: "bootstrap",
      columns: ["height"],
    },
    golf: 1,
    hints: ["bootstrap 500"],
  },
  {
    id: "samp-03-ci",
    series: "sampling",
    title: "Confidence interval",
    narrative:
      "After bootstrapping, build a 95% percentile interval with `ci 0.95`. A 95% CI is not '95% probability the mean is inside' — it is the set of means not rejected by a 5% test. Treat it as a plausible range.",
    start: {
      dataset: "adult_heights",
      seed: 42,
    },
    goal: {
      type: "summary",
      name: "ci_lo",
      column: "height",
    },
    golf: 2,
    hints: ["bootstrap 500", "ci 0.95", "ci 0.95 method=se  works without bootstrap"],
  },
  {
    id: "assoc-01-corr",
    series: "association",
    title: "Correlation",
    narrative:
      "Hours studied vs exam score. Compute Pearson r. Correlation is linear association only — it cannot see curves, and it is not causation. Plot it and look before you trust r.",
    start: {
      dataset: "study_score",
      seed: 42,
    },
    goal: {
      type: "corr",
      x: "hours",
      y: "score",
      minAbs: 0.5,
    },
    golf: 1,
    hints: ["corr hours score"],
  },
  {
    id: "assoc-02-ols",
    series: "association",
    title: "Fit a line",
    narrative:
      "Regress score on hours. OLS minimizes squared residuals. Read slope (score points per hour), intercept (score at 0 hours), and R² (variance explained). Always inspect the residual pattern.",
    start: {
      dataset: "study_score",
      seed: 42,
    },
    goal: {
      type: "plot",
      kind: "regression",
      columns: ["hours", "score"],
    },
    golf: 1,
    hints: ["regress score hours", "regress score~hours"],
  },
  {
    id: "test-01-ttest",
    series: "testing",
    title: "One-sample t-test",
    narrative:
      "Test whether quiz scores differ from 70. Run `ttest score mu=70`. The p-value is the probability of a statistic at least this extreme under H₀ — not the probability H₀ is true. Also try mu=75 and mu=85 and watch p move.",
    start: {
      dataset: "quiz_scores",
      seed: 42,
      plots: [{ kind: "hist", columns: ["score"] }],
    },
    goal: {
      type: "test",
      name: "ttest",
      reject: true,
      maxP: 0.1,
    },
    golf: 1,
    hints: ["ttest score mu=70", "ttest score mu=75  will not reject — think about why"],
  },
];

/** Series metadata for the level browser. */
export const SERIES: { id: string; title: string; blurb: string }[] = [
  {
    id: "descriptive",
    title: "Descriptive statistics",
    blurb: "Center, spread, shape — what the sample says before any inference.",
  },
  {
    id: "sampling",
    title: "Sampling & estimation",
    blurb: "Sampling error, bootstrap, confidence intervals.",
  },
  {
    id: "association",
    title: "Association & regression",
    blurb: "Correlation, OLS, and the causation trap.",
  },
  {
    id: "testing",
    title: "Hypothesis testing",
    blurb: "p-values, errors, and what significance actually means.",
  },
];

/**
 * Resolve a level by id.
 *
 * @param id - Level id.
 * @returns Level definition.
 * @throws Error if missing.
 */
export function getLevel(id: string): LevelDef {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) {
    throw new Error(`Unknown level '${id}'`);
  }
  return level;
}

/**
 * Levels for one series.
 *
 * @param seriesId - Series key.
 * @returns Matching levels in catalog order.
 */
export function levelsInSeries(seriesId: string): LevelDef[] {
  return LEVELS.filter((l) => l.series === seriesId);
}
