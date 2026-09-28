/**
 * Domain types for the learn-mlstats analysis engine.
 *
 * The engine is pure: no React, no DOM. UI hosts subscribe to session state
 * and render scene graphs produced by `renderScene`.
 */

/** Supported column value types. */
export type ColumnType = "numeric" | "categorical" | "binary";

/** A single typed column of a dataset. */
export interface Column {
  /** Column identifier (unique within a dataset). */
  name: string;
  /** Semantic type used by commands and plots. */
  type: ColumnType;
  /** Cell values; null marks missing data. */
  values: (number | string | null)[];
}

/** A rectangular dataset loaded into the session. */
export interface Dataset {
  /** Stable identifier used by `load <id>`. */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Columns; row count is `columns[0].values.length`. */
  columns: Column[];
  /** Optional provenance / teaching notes. */
  meta?: { description?: string; source?: string };
}

/** Generative population models available for sampling and theory curves. */
export type ModelKind =
  | "empirical"
  | "normal"
  | "binomial"
  | "poisson"
  | "uniform"
  | "exponential";

/** A parametric or empirical population attached to the analysis. */
export interface GenerativeModel {
  /** Distribution family. */
  kind: ModelKind;
  /** Family-specific parameters (mu, sd, n, p, lambda, min, max). */
  params: Record<string, number>;
  /** Optional column this model describes. */
  column?: string;
}

/** How a sample record should be interpreted. */
export type SampleKind = "raw" | "mean" | "resample_mean";

/** One draw or resampling batch retained in the analysis timeline. */
export interface SampleRecord {
  /** Monotonic sample id. */
  id: number;
  /** Requested draw size (or bootstrap replicates for resample_mean). */
  n: number;
  /** Drawn values (raw observations or replicate means). */
  values: number[];
  /** Interpretation of `values`. */
  kind: SampleKind;
  /** Parent sample id for bootstraps. */
  parent?: number;
}

/** A computed scalar summary retained on the timeline. */
export interface SummaryRecord {
  /** Statistic name, e.g. `mean`, `sd`, `quantile`. */
  name: string;
  /** Target column name. */
  column: string;
  /** Computed value. */
  value: number;
  /** Command step that produced the summary. */
  step: number;
  /** Extra keys (e.g. `p` for quantile). */
  detail?: Record<string, number>;
}

/** A hypothesis test result. */
export interface TestRecord {
  /** Test name, e.g. `ttest`. */
  name: string;
  /** Observed test statistic. */
  statistic: number;
  /** Two-sided p-value. */
  pValue: number;
  /** Supporting numbers (df, mean, mu, ...). */
  detail: Record<string, number>;
}

/** Supported canvas plot kinds. */
export type PlotKind =
  | "hist"
  | "strip"
  | "density"
  | "qq"
  | "scatter"
  | "regression"
  | "bootstrap"
  | "sampling_means"
  | "ci"
  | "pmf"
  | "box";

/** A declarative plot request evaluated against the analysis state. */
export interface PlotSpec {
  /** Plot family. */
  kind: PlotKind;
  /** Primary columns (order matters for scatter/regression). */
  columns: string[];
  /** Kind-specific options (bins, level, mu, colorRole...). */
  layers?: Record<string, number | string | boolean>;
  /** Highlighted values or indices. */
  marks?: number[];
}

/** Immutable analysis snapshot. */
export interface AnalysisState {
  /** Active dataset. */
  dataset: Dataset;
  /** Optional population model. */
  model?: GenerativeModel;
  /** Sample timeline. */
  samples: SampleRecord[];
  /** Computed summaries. */
  summaries: SummaryRecord[];
  /** Active canvas layers (typically at most 2). */
  plots: PlotSpec[];
  /** Hypothesis tests. */
  tests: TestRecord[];
  /** RNG seed for reproducibility. */
  seed: number;
  /** Number of executed commands. */
  step: number;
}

/** Parsed command arguments. */
export interface CommandArgs {
  /** Positional tokens. */
  pos: string[];
  /** Key=value options. */
  opts: Record<string, string>;
}

/** A parsed user command. */
export interface Command {
  /** Command name, e.g. `mean`. */
  name: string;
  /** Parsed arguments. */
  args: CommandArgs;
  /** Raw input line. */
  raw: string;
}

/** Result of executing one command. */
export interface CommandResult {
  /** Next analysis state (same object if no mutation). */
  state: AnalysisState;
  /** Lines to print in the terminal. */
  output: string[];
  /** Non-fatal / fatal message shown in warn style. */
  error?: string;
}

/** Declarative goal predicates evaluated after each command. */
export type GoalSpec =
  | {
      type: "summary";
      name: string;
      column: string;
      expected?: number;
      tolerance?: number;
    }
  | {
      type: "plot";
      kind: PlotKind;
      columns: string[];
    }
  | {
      type: "sample";
      stat: "mean" | "sd";
      n: number;
      /** |stat - population| must be <= within */
      within: number;
      populationMean?: number;
    }
  | {
      type: "test";
      name: string;
      reject: boolean;
      maxP?: number;
    }
  | {
      type: "corr";
      x: string;
      y: string;
      minAbs?: number;
    };

/** Level definition (bundled JSON). */
export interface LevelDef {
  /** Stable level id. */
  id: string;
  /** Curriculum series key. */
  series: string;
  /** Short title. */
  title: string;
  /** Narrative markdown-ish plain text. */
  narrative: string;
  /** Starting analysis configuration. */
  start: {
    dataset: string;
    seed?: number;
    model?: GenerativeModel;
    plots?: PlotSpec[];
  };
  /** Success condition. */
  goal: GoalSpec;
  /** Par command count for golf. */
  golf: number;
  /** Ordered hints revealed on demand. */
  hints: string[];
}

/** Level progress after a pass. */
export interface LevelScore {
  /** Level id. */
  levelId: string;
  /** Commands used. */
  used: number;
  /** Par. */
  par: number;
  /** True if used <= par. */
  underPar: boolean;
}

/** Scene graph primitives for the SVG host. */
export type SceneNode =
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill: string;
      opacity?: number;
    }
  | {
      kind: "circle";
      x: number;
      y: number;
      r: number;
      fill: string;
      opacity?: number;
    }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      strokeWidth?: number;
      dash?: string;
    }
  | {
      kind: "path";
      d: string;
      stroke: string;
      fill?: string;
      strokeWidth?: number;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      fill: string;
      size?: number;
      anchor?: "start" | "middle" | "end";
    };

/** A full frame for one canvas layer. */
export interface SceneFrame {
  /** Layer plot this frame belongs to. */
  plot: PlotSpec;
  /** Drawables in paint order. */
  nodes: SceneNode[];
  /** Subtitle / legend text. */
  caption: string;
}
