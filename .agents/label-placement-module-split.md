# Next Task Prompt: Split Label Placement Internals

You are working in `/Users/lalmei/Documents/markfeyn`.

## Goal

Perform one behavior-preserving renderer refactor: split the large label placement
and label-scoring implementation in `src/markfeyn/renderer/layout/labels.js` into
focused internal modules, while keeping the public layout API, rendered output,
diagnostics, generated browser bundle surface, and tests unchanged.

This is a structural cleanup after the renderer, geometry, topology, and
normalization splits. Do not add new label-placement behavior unless a regression
test exposes an accidental behavior change that must be fixed to preserve current
semantics.

## Current State To Re-check

As of the handoff that created this prompt:

- The active work is on the GitButler branch `leo/markfeyn-layout-milestones`.
- Commit `fa720db` split geometry and normalization modules and regenerated
  `src/markfeyn/assets/feynman-diagrams.js`.
- The full gate passed: `npm run test:js`, `uv run --group dev pytest`,
  `make docs`, and `git diff --check`.
- `src/markfeyn/renderer/layout/labels.js` is about 1,700 lines and now mixes:
  placement orchestration, candidate generation, label box construction,
  collision scoring, loop-region construction, approximate text metrics, curve
  sampling, momentum geometry, and small geometry utilities.

Re-check the actual worktree before acting. Do not trust the commit hash or file
counts if the branch has moved.

## Why This Is The Next Slice

The current architecture is already modular in the surrounding areas:

- `src/markfeyn/renderer/feynman-diagrams.js` is a thin source entrypoint.
- `src/markfeyn/renderer/geometry/` owns shared visual metrics and path/vertex
  geometry.
- `src/markfeyn/renderer/layout/topology/` owns topology helpers.
- `src/markfeyn/renderer/layout/normalization.js` is now a small facade over
  focused modules in `layout/normalizers/`.
- `src/markfeyn/renderer/layout/layout.js` calls `resolveLabelPlacement(...)`
  before final scoring, and tests already assert label placement diagnostics,
  determinism, topology invariance, and overlap behavior.

`layout/labels.js` is the remaining large mixed-responsibility module in this
part of the pipeline. Splitting it should make future label and renderer work
easier without changing behavior.

## Required First Step

Inspect the current repo before editing. In your first response, summarize:

1. The current imports/exports of `src/markfeyn/renderer/layout/labels.js`.
2. Which helpers are externally consumed by `layout.js`, `score.js`, and
   `loop-candidates.js`.
3. A recommended module split with tradeoffs.
4. Any alignment questions that truly affect implementation. Each question must
   include your recommendation and the consequence of taking it.

If there are no blocking questions, say so and proceed with the recommended
behavior-preserving split.

## Scope

Keep `src/markfeyn/renderer/layout/labels.js` as the stable facade exporting the
same names:

- `LABEL_SCORE_FIELDS`
- `scoreLabelGeometry`
- `analyzeLabelGeometry`
- `labelScoreTotal`
- `nonLabelScoreTotal`
- `resolveLabelPlacement`
- `labelPlacementDiagnostic`

Recommended module boundaries:

- `layout/labels/placement.js`: placement specs, candidate generation, placement
  resolver, placement diagnostics.
- `layout/labels/boxes.js`: label-box construction for current layout,
  candidate layout, and placed labels.
- `layout/labels/scoring.js`: label score fields, score totals, overlap and
  loop-collision scoring.
- `layout/labels/regions.js`: loop-region construction and inside/outside tests.
- `layout/labels/geometry.js`: local text bounds, bounds helpers, sampling, and
  label-specific geometry utilities that are not ready to move into shared
  `renderer/geometry/`.

Adjust those names if the current code suggests a cleaner split, but preserve a
small facade and avoid circular imports.

## Guardrails

- Preserve current behavior and output.
- Preserve `parseFeynman(source)` and `layoutFeynman(diagram, options)`.
- Preserve `layout.labelPlacement`, `layout.score`, and diagnostic shapes.
- Preserve `window/globalThis.FeynmanDiagrams`, CommonJS `require`, and current
  public helper exports from the generated bundle.
- Do not infer incoming/outgoing roles from names, edge direction, fermion arrows,
  momentum arrows, labels, or particle styles.
- Do not move vertex coordinates or reorder normalization phases.
- Do not introduce TypeScript or new dependencies.
- Keep generated asset churn paired with the source changes that require it.
- Keep docs changes moderate: update `docs/development.md` only if module paths
  or architecture descriptions become misleading.

## Suggested Implementation Plan

1. Add the new `src/markfeyn/renderer/layout/labels/` directory and move helper
   groups behind internal modules.
2. Keep `layout/labels.js` as the facade and orchestration surface.
3. Prefer mechanical moves first. Only rename helpers when it clearly improves
   boundaries and does not make review harder.
4. Rebuild the browser bundle through the normal JS gate, not by hand-editing
   `src/markfeyn/assets/feynman-diagrams.js`.
5. If the split reveals duplicated path or momentum geometry that should move
   into `renderer/geometry/`, document that as a follow-up unless the move is
   trivial and behavior-preserving.

## Verification

Run the full local gate:

```bash
npm run test:js
uv run --group dev pytest
make docs
git diff --check
```

Also run a bundle-surface compatibility check:

```bash
node -e "console.log(Object.keys(require('./src/markfeyn/assets/feynman-diagrams.js')).sort().join('\n'))"
```

The exported key list should stay unchanged.

## Git

Use GitButler `but` for commit operations. Prefer one commit if this remains a
single behavior-preserving structural split. Use a short gitmoji subject such as:

```text
♻️ labels: split placement internals
```

## Definition Of Done

- `layout/labels.js` is a small facade/orchestrator with focused internal modules.
- No user-facing behavior changes are introduced.
- The generated bundle is regenerated by the JS build path.
- The full verification gate passes.
- The bundle public export keys are unchanged.
- The GitButler branch contains a reviewable commit for the split.
