# learn-mlstats

Interactive statistical sandbox and level-based challenges for data and ML
practitioners. Product pattern modeled on
[learnGitBranching](https://github.com/pcottle/learnGitBranching): command
surface + live visualization + levels + golf.

**Live:** https://alisadeghiaghili.github.io/learn-mlstats/

## Why

Working statistical intuition beats memorizing tests. This app makes sampling,
bias, uncertainty, and failure modes *visible* the way LGB makes branching
visible.

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # vitest
npm run typecheck
```

## Play

```
levels              # list lessons
level desc-01-mean  # load a lesson
mean score          # solve the goal
hint                # stuck?
undo / reset
sandbox             # free exploration
help                # full command list
```

Shareable URL: `?level=desc-01-mean&command=mean%20score`

## Architecture

See [DESIGN.md](./DESIGN.md) and [SCOPE.md](./SCOPE.md).

- `src/engine` — pure engine (no React): datasets, commands, goals, scene graphs
- `src/levels` — declarative level catalog
- `src/session` — undo stack, level session, golf
- `src/ui` — React terminal / canvas / sidebar

## Curriculum (planned)

1. Descriptive
2. Distributions
3. Sampling & CLT
4. Estimation (bootstrap, CI)
5. Hypothesis testing
6. Association & regression
7. Probability for ML
8. Experimentation (A/B, leakage)

## License

MIT
