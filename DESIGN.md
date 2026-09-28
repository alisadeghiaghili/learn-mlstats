# learn-mlstats — Design & Architecture

## Style anchor

**Seeing Theory (Brown) × learnGitBranching game chrome × Distill.pub clarity.**

The product should feel like a rigorous visual essay that happens to be playable:
warm paper narrative, monospace command surface, luminous statistical objects
on a cool ink field.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| `paper` | `#F4F0E8` | App background, narrative panels |
| `ink` | `#1C1F26` | Primary text, terminal bg |
| `ink-soft` | `#5C6470` | Secondary text, axes |
| `accent` | `#E85D4C` | Observed / sample / active object |
| `theory` | `#3D5A80` | Population / theoretical curve |
| `pass` | `#2F9E74` | Level success |
| `warn` | `#C9A227` | Hint, near-miss |

Max 3 color families in charts: accent, theory, neutrals.

## Typography

| Role | Family | Scale |
| --- | --- | --- |
| Display / level titles | `"Source Serif 4", Georgia, serif` | 28–36px / 600 |
| Body / narrative | `"Source Serif 4", Georgia, serif` | 16–18px / 400 |
| UI chrome | `"Inter", system-ui, sans-serif` | 13–14px / 500 |
| Commands, numbers, code | `"JetBrains Mono", ui-monospace, monospace` | 13–14px |

Contrast: large serif titles against mono data readouts.

## Layout system

Three-column game layout (desktop-first, stacks on narrow):

```
┌──────────┬────────────────────────────┬─────────────┐
│ Terminal │        Stat Canvas         │ Level brief │
│  280px   │     flex (min 480px)       │   300px     │
└──────────┴────────────────────────────┴─────────────┘
```

- Spacing rhythm: 4 / 8 / 16 / 24 / 40.
- Dense but breathable: max 2 plot layers in canvas at once.
- Top bar: level name, golf score, undo/reset/help.

Signature moments:

1. **Sampling rain** — `sample n` drops points onto the canvas, then they settle
   into a histogram / sample strip with SE whiskers.
2. **Bootstrap cloud** — `bootstrap b` animates resample means stacking into a
   sampling distribution, CI bracket snaps onto it.

## Stack

- Vite + TypeScript + React 18 (UI shell only).
- **Pure engine** (`src/engine`) — no React, fully unit-testable.
- SVG rendering for plots (deterministic, exportable).
- Vitest for tests. ESLint for correctness.
- No backend, no network at runtime. Levels and datasets are bundled JSON/TS.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ UI (React)                                              │
│  TerminalView  CanvasView  LevelBriefView  Dialogs      │
└───────────────┬─────────────────────────┬───────────────┘
                │ dispatch(command)       │ subscribe(state)
┌───────────────▼─────────────────────────▼───────────────┐
│ Session (controller)                                    │
│  command history · undo stack · level session · golf    │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│ Engine (pure)                                           │
│  Dataset · GenerativeModel · CommandParser ·            │
│  CommandExecutor · AnalysisState · GoalPredicate        │
└─────────────────────────────────────────────────────────┘
```

### Domain model

```ts
type ColumnType = "numeric" | "categorical" | "binary";

interface Column {
  name: string;
  type: ColumnType;
  values: (number | string | null)[];
}

interface Dataset {
  id: string;
  name: string;
  columns: Column[];
  meta?: { description?: string; source?: string };
}

/** Optional population model used when sampling with replacement from theory. */
interface GenerativeModel {
  kind: "empirical" | "normal" | "binomial" | "poisson" | "uniform" | "exponential";
  params: Record<string, number>;
  column?: string; // which column it fills / relates to
}

type PlotKind =
  | "hist"
  | "strip"
  | "density"
  | "qq"
  | "scatter"
  | "regression"
  | "bootstrap"
  | "sampling_means"
  | "ci"
  | "pmf";

interface PlotSpec {
  kind: PlotKind;
  columns: string[];
  layers: Record<string, unknown>; // kind-specific options
  marks: number[]; // highlight indices / values
}

interface AnalysisState {
  dataset: Dataset;
  model?: GenerativeModel;
  samples: SampleRecord[];       // each draw
  summaries: SummaryRecord[];    // computed stats with target column
  plots: PlotSpec[];             // active canvas layers (max 2)
  tests: TestRecord[];
  seed: number;
  step: number;                  // command count
}

interface SampleRecord {
  id: number;
  n: number;
  values: number[];              // raw draw or drawn means
  kind: "raw" | "mean" | "resample_mean";
  parent?: number;
}

interface SummaryRecord {
  name: string;                  // "mean" | "sd" | ...
  column: string;
  value: number;
  step: number;
}

interface TestRecord {
  name: string;                  // "ttest"
  statistic: number;
  pValue: number;
  detail: Record<string, number>;
}
```

### Command surface (v0)

```
help | levels | level <id> | sandbox | reset | undo | hint | goal
load <datasetId>
describe [col]
mean|median|var|sd|se|skew|quantile <p> [col]
hist [col] | strip [col] | density [col] | qq [col]
sample <n> [from=pop|col] [seed=s]
bootstrap <B> [stat=mean]
ci <0.95> [method=percentile|se]
ttest <col> mu=<v>
corr <x> <y>
regress <y> ~ <x>
dist normal mu=0 sd=1 | binomial n= p= | ...
pop normal mu=0 sd=1     # attach generative model
clearplots
```

Command execution is pure:

```ts
execute(state: AnalysisState, cmd: Command): CommandResult
// CommandResult = { state, output: string[], plots?: PlotSpec[], error?: string }
```

`undo` restores previous `AnalysisState` snapshots on the session stack.

### Level schema (declarative JSON)

```json
{
  "id": "desc-01-mean",
  "series": "descriptive",
  "title": "Find the center",
  "narrative": "Compute the mean of `wait`.",
  "start": {
    "dataset": "restaurant_wait",
    "seed": 42,
    "plots": [{ "kind": "hist", "columns": ["wait"] }]
  },
  "goal": {
    "type": "summary",
    "name": "mean",
    "column": "wait",
    "tolerance": 1e-6
  },
  "golf": 1,
  "hints": [
    "mean wait"
  ]
}
```

Goal predicates (extensible union):

- `{ type: "summary", name, column, expected?, tolerance? }`
- `{ type: "plot", kind, columns }`
- `{ type: "sample", stat, n, within }`  — e.g. sample mean within ±2 of pop mean
- `{ type: "test", name, reject: boolean, maxP?: number }`
- `{ type: "commands" }` — free-form checker registered by name in engine

### Visualization layer

`render(state: AnalysisState): SceneGraph` produces a pure scene description
(primitives: axes, rects, circles, paths, text). A thin React SVG host mounts it.
This keeps plotting testable and free of DOM.

### Session controller

- Holds `AnalysisState` + undo stack + level context + golf.
- Subscribes UI. Same controller for sandbox and levels.
- Level load injects `start` state and enables goal banner.

## Engineering standards

- TypeScript strict. Full JSDoc/TSDoc with Args / Returns / Examples on public API.
- `src/engine` has zero React imports.
- Every pure function has unit tests (`vitest`).
- Conventional Commits. No AI footprints in git history.
- Docs in English only.

## Signature moments (must ship in v0)

1. Sampling rain after `sample`.
2. Bootstrap cloud + CI snap after `bootstrap` + `ci`.
