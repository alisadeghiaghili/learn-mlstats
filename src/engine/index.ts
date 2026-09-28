/**
 * Public engine API for learn-mlstats.
 *
 * Pure statistical analysis engine: datasets, commands, goals, scene graphs.
 */

export type {
  AnalysisState,
  Command,
  CommandArgs,
  CommandResult,
  Column,
  ColumnType,
  Dataset,
  GenerativeModel,
  GoalSpec,
  LevelDef,
  LevelScore,
  ModelKind,
  PlotKind,
  PlotSpec,
  SampleKind,
  SampleRecord,
  SceneFrame,
  SceneNode,
  SummaryRecord,
  TestRecord,
} from "./types.js";

export { createState, execute, parseCommand } from "./commands.js";
export { checkGoal, describeGoal } from "./goals.js";
export type { GoalResult } from "./goals.js";
export { DATASETS, getDataset, numericColumn, pairedColumns } from "./datasets.js";
export {
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
export {
  createRng,
  normalCdf,
  normalPdf,
  quantile as quantileRng,
  sampleEmpirical,
  sampleFrom,
  sampleStandardNormal,
  twoSidedNormalP,
} from "./rng.js";
export { renderScene, FRAME_W, FRAME_H, ACCENT, INK, INK_SOFT, PAPER, THEORY, WARN } from "./scene.js";
