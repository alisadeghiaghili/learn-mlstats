# learn-mlstats — Product Scope

## Problem

Data practitioners (engineers, scientists, ML engineers) need working statistical
intuition — not a full undergraduate statistics course, and not another notebook
of `scipy.stats` calls. They need to *see* sampling, bias, uncertainty, and
failure modes the way learnGitBranching makes branching visible.

## Product pattern (from learnGitBranching)

| LGB | learn-mlstats |
| --- | --- |
| Commit tree as the object | Dataset + sampling process as the object |
| `git commit` mutates the tree | Stat commands mutate analysis state + plots |
| Levels with goal + golf | Levels with goal predicate + command golf |
| Sandbox mode | Sandbox mode |
| `undo` / `reset` | `undo` / `reset` |
| Level builder + gist JSON | Level builder + level JSON |
| Pure client-side | Pure client-side |
| Shareable `?command=` | Shareable `?command=` + `?level=` |

## What we deliberately do NOT copy

- Git/DAG visualization as the primary canvas — wrong domain metaphor.
- jQuery / Raphael / Flux stack — modern TypeScript instead.
- Git command surface — statistical command surface instead.

## Curriculum boundary (the "all of stats" trap)

"Hazine-ye tamam-e esteghat" is not a product. The curriculum is the set of
statistical ideas that show up constantly in data work and ML, and that are
best learned by *manipulating a live distribution*.

In scope (8 series, ~48 levels planned):

1. **Descriptive** — center, spread, shape, outliers, robust stats
2. **Distributions** — PMF/PDF/CDF, common families, why shape matters
3. **Sampling & CLT** — population vs sample, sampling distribution, SE
4. **Estimation** — bias/variance of estimators, CI, bootstrap, shrinkage
5. **Hypothesis testing** — p-values, errors, power, multiplicity
6. **Association** — correlation, OLS, residuals, confounding, Simpson
7. **Probability for ML** — Bayes, expectation, MLE intuition
8. **Experimentation** — A/B design, sample size, peeking, leakage

Out of scope (explicit non-goals for v1):

- Measure theory, asymptotic theory proofs
- Full GLM / mixed models / Bayesian MCMC
- Deep learning theory (except bias-variance framing)
- Multivariate methods beyond correlation/OLS (PCA, clustering later)
- Production statistical software / reporting stacks

## Success criteria for v0 (playable slice)

1. Sandbox: type stat commands, see plots update immediately.
2. At least 8 levels across 2 series (Descriptive + Sampling).
3. Goal checking with pass/fail + command golf score.
4. `undo` / `reset` / `hint`.
5. Engine unit-tested; levels declarative JSON.
6. Shareable URL that replays a command sequence.

## Audience and language

- Primary audience: data/ML practitioners (junior → mid).
- UI and level content: English (Persian localization is a later phase).
- Conversation with the author: Persian. Repository content: English only.
