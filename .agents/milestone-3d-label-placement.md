# Milestone 3D Prompt: Label Placement and Graph Overlap Avoidance

You are working in `/Users/lalmei/Documents/markfeyn`.

Goal: complete the remaining **Milestone 3 / Phase 9** work for label placement so labels
actively avoid graph geometry, not only contribute penalty scores after the fact.

## Context

MarkFeyn already has:

- Milestone 1 semantic layout/orientation/topology analysis.
- Milestone 2 stable ordering, ELK ports, parallel propagators, scoring, and diagnostics.
- Milestone 3A loop candidate layouts for triangle, box, tadpole, and simple one-loop diagrams.
- Milestone 3B label-aware **scoring** (`src/markfeyn/renderer/layout/labels.js`):
  approximate label boxes, overlap penalties, loop-exterior preferences, and
  label-aware loop candidate ranking.
- Milestone 3C symmetric unclassified two-center tree and two-point loop refinement.

**Gap:** Milestone 3 in `.agents/overall_plan.md` also requires **label placement**.
Today labels are placed by fixed heuristics in the renderer (`labelOffset`,
`edgeLabelPosition`, momentum helpers) and scored afterward. Overlap checks exist only
as soft penalties in `layout.score.breakdown`; they do not move labels or reject bad
layouts.

Implement **Milestone 3D only**. Do not start Milestone 4 (multiloop decomposition,
incremental stability) or full Phase 10 automorphism solving.

## Problem Statement

Phase 9 in `.agents/overall_plan.md` requires:

- label candidates using edge tangent/normal, preferred side, loop interior vs exterior,
  free-space estimates, distance to nodes and other labels, arrowhead position, and
  conventional placement;
- conventions that labels on external legs, loop momentum labels, bubble labels, and
  box/polygon labels lie outside the interaction region where possible;
- **labels must not overlap vertices, propagators, arrowheads, or other labels.**

Phase 12 acceptance criteria include:

- no label overlaps a node;
- adding a label does not alter topology classification.

Current partial implementation (3B):

| Check | Implemented as score? | Drives placement? |
| --- | --- | --- |
| `nodeLabelOverlap` | yes (label vs vertex bounds) | no |
| `edgeLabelOverlap` | yes (edge/momentum labels vs vertices + other edges) | loop candidates only |
| `labelLabelOverlap` | yes | no |
| `labelsInsideLoops` | yes | loop candidates only |
| `momentumLoopCollision` | yes | loop candidates only |

Missing today:

- node labels checked against **propagator** paths (only edge-type labels are);
- arrowhead-specific overlap checks;
- post-layout or render-time label repositioning;
- hard invalidity vs soft scoring separation for label collisions;
- label placement influencing general ELK/spring layouts (not only loop candidates).

## Concrete Failing Examples

### 1. Dense node labels on a compact tree

```feynman
layout spring
incoming e_minus e_plus
outgoing mu_plus mu_minus
fermion e_minus->ann anti fermion e_plus->ann
photon ann->prod
anti fermion prod->mu_plus fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ ann:Z prod:H mu_plus:\mu^+ mu_minus:\mu^-
```

Observed risk:

- long node labels (`e^-`, `\mu^+`, etc.) can overlap internal vertices or nearby
  propagators because `labelOffset` is fixed from `labelSide` only;
- `nodeLabelOverlap` may be nonzero but nothing moves the label.

Required behavior:

- choose a side/offset from a small deterministic candidate set;
- prefer placements with zero or minimal overlap against vertices, edge samples, and
  other label boxes;
- preserve explicit `labelSide` when the user declares one.

### 2. Edge label crossing an unrelated propagator

```feynman
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b[edge label=k] b->c[momentum=q] c->a
scalar c->h
label g1:g g2:g h:H
```

Observed risk:

- `edgeLabelOverlap` penalizes edge labels near other propagators but the rendered
  label stays on the default normal;
- loop candidate selection may pick a better geometry, but spring/ELK layouts outside
  the loop-candidate path do not refine label position.

Required behavior:

- for each edge label / momentum label / loop-edge label, evaluate both sides of the
  edge normal (respecting `edge label` vs `edge label'` and `momentum` vs `momentum'`);
- pick the side with lower collision score while honoring explicit primed options;
- keep momentum arrows and labels outside loop interiors when an exterior placement exists.

### 3. Overlapping node labels

```feynman
layout layered
incoming a b
outgoing c d
fermion a->v b->v
fermion v->c v->d
label a:\alpha b:\beta c:\gamma d:\delta
```

Observed risk:

- vertically fanned externals can place four node labels close enough that
  `labelLabelOverlap` is nonzero with no repositioning.

Required behavior:

- nudge label anchors deterministically (alternate sides, small cross-axis shifts within
  margin bounds) until overlap is eliminated or a bounded candidate set is exhausted;
- never change vertex coordinates to fix label overlap.

## Required Work

### 1. Label placement engine (extend `labels.js`)

- Add a **placement** API separate from but sharing geometry with `analyzeLabelGeometry`:
  - input: laid-out graph + prepared semantic model;
  - output: `layout.labelPlacement` (or equivalent) with per-label anchor, side, and
    bounds used by both scoring and rendering.
- Reuse the existing approximate bounding-box provider (`METRICS`, `textBounds`, edge
  samples, vertex bounds, loop regions). Keep the provider replaceable for future exact
  font metrics.
- Generate deterministic candidate placements per label:
  - node labels: candidate `labelSide` / offset variants within margin;
  - edge labels: both normals unless `edge label'` / `momentum'` fixes the side;
  - momentum labels and arrows: treat as a group when shifting.
- Rank candidates with existing overlap penalties plus conventional preferences:
  - external-leg labels outside interaction region;
  - loop labels outside loop polygon;
  - bubble labels on opposite exterior sides;
  - minimal total `labelScoreTotal`.
- Separate **hard invalid** label collisions (overlap area above threshold, label center
  inside vertex disc) from soft penalties in diagnostics.

### 2. Renderer integration

- Wire placement output into label drawing in `feynman-diagrams.js`:
  - `labelOffset` / `edgeLabelPosition` / momentum helpers should consume resolved
    placement when present;
  - fall back to current heuristics when placement is skipped (manual diagrams, missing
    layout data).
- **Do not** change graph topology, orientation mode, or vertex coordinates.
- Adding or moving a label must not change `layout.analysis.topology` classification.

### 3. Layout pipeline hook

- Run label placement after geometric refinement (post-ELK / post-loop-candidate /
  post-symmetric-unclassified) and before final scoring when labels exist.
- Recompute `layout.score` using placed label geometry so diagnostics match rendered output.
- Optionally extend loop candidate ranking to use the same placement resolver (not a
  second divergent heuristic).

### 4. Scoring and diagnostics

- Extend `layout.diagnostics` with a `label-placement` stage:
  - labels placed vs fallback;
  - per-label chosen side/offset;
  - residual overlap totals;
  - hard-collision count.
- Keep existing `LABEL_SCORE_FIELDS`; after placement, well-formed diagrams should
  trend toward zero or near-zero overlap scores.
- Expose placement metadata under `layout.debug` when `debug: true`.

### 5. Scope boundaries

- Do not implement browser font measurement in this milestone.
- Do not implement general multiloop or nested-loop optimization (Milestone 4).
- Do not implement incremental layout stability (Phase 13 / Milestone 4).
- Do not implement full graph automorphism (Phase 10).
- Do not change public APIs:
  - preserve `parseFeynman(source)`;
  - preserve `layoutFeynman(diagram, options)`.
- Do not move manually positioned vertices.
- Do not infer `incoming` / `outgoing` from labels, fermion arrows, or momentum direction.
- Keep code modular under `src/markfeyn/renderer/layout/`.
- Use existing JavaScript/JSDoc style, not TypeScript.
- Update source renderer first, then rebuild generated bundle with `npm run build:js`.

### 6. Out of scope for 3D (optional follow-up **3E**)

- Committed SVG / pixel visual regression fixtures (`overall_plan.md` Milestone 3 bullet).
- Exact TeX font metrics.
- Label placement driving ELK node positions or global spring forces.

## Files to Inspect First

- `src/markfeyn/renderer/layout/labels.js` — boxes, scoring, loop regions (extend here)
- `src/markfeyn/renderer/layout/layout.js` — pipeline ordering
- `src/markfeyn/renderer/layout/score.js` — final score assembly
- `src/markfeyn/renderer/layout/loop-candidates.js` — label-aware candidate ranking
- `src/markfeyn/renderer/feynman-diagrams.js` — `labelOffset`, `edgeLabelPosition`,
  momentum rendering, exports
- `tests/feynman-diagrams.test.js`
- `docs/syntax.md`
- `docs/examples.md`
- `README.md`
- `.agents/overall_plan.md` (Phase 9, Phase 12, Milestone 3)
- `.agents/goal_memory.md`

## Tests

Add or update JS tests for:

- **Placement reduces overlap:** diagrams from the failing examples above have
  `nodeLabelOverlap`, `edgeLabelOverlap`, and `labelLabelOverlap` at or near zero after
  placement (use explicit thresholds, not pixel snapshots).
- **Node labels vs propagators:** a node label that would cross a propagator on the
  default side is moved to the alternate side deterministically.
- **Explicit side preserved:** `edge label'` / `momentum'` keep the declared side even
  when the unprimed side would score better.
- **Topology invariance:** adding labels does not change `detectedTopology` or loop
  candidate identity (extend existing 3B test pattern).
- **Manual positions preserved:** vertex coordinates unchanged when only labels move.
- **Loop conventions:** box/triangle loop momentum labels and arrows remain outside loop
  polygon when an exterior candidate exists.
- **Determinism:** identical input produces identical `layout.labelPlacement` and
  coordinates within tolerance.
- **Diagnostics:** `label-placement` stage reports counts and residual overlap.
- **Regression:** all Milestone 1, 2, 3A, 3B, and 3C tests continue to pass.
- **Docs examples:** every `feynman` block in `docs/examples.md` still parses and lays
  out through `testDocumentedExamplesParseAndLayout`.

Prefer geometry and placement-metadata assertions over browser pixel snapshots.

## Docs

- Update `docs/syntax.md`:
  - describe post-layout label placement and overlap avoidance;
  - distinguish soft score penalties (3B) from active placement (3D);
  - document explicit `labelSide` / primed edge label behavior.
- Add a short section to `docs/examples.md` with one dense-label tree and one loop with
  multiple edge labels, showing improved placement.
- Update `README.md` high-level summary: label placement is approximate and
  bbox-based, but actively avoids overlaps where possible.
- Update `.agents/goal_memory.md` with placement pipeline order and known limits.
- Optionally amend `.agents/overall_plan.md` Milestone 3 checklist to mark 3D complete
  and leave visual fixtures as 3E.

Keep docs honest:

- approximate font metrics, not exact TeX;
- vertex positions are not optimized for labels;
- not arbitrary multiloop label packing;
- not incremental layout stability.

## Verification Commands

```bash
npm run build:js
node --check src/markfeyn/assets/feynman-diagrams.js
node tests/feynman-diagrams.test.js
uv run --group dev pytest
```

## Definition of Done

- Label placement runs in the layout pipeline when labels are present.
- Rendered label anchors use placement output; overlap scores reflect placed geometry.
- Node, edge, and label-label overlaps are actively minimized on the concrete failing
  examples above.
- Explicit label-side and momentum-prime options are respected.
- Topology classification is unchanged by adding labels.
- Manual vertex positions are unchanged.
- `label-placement` diagnostics exist and are finite.
- Existing 3A/3B/3C behavior and tests still pass.
- All verification commands pass.

## Success Metrics

After 3D, Milestone 3’s “add label placement” bullet should be honestly complete except
for optional visual regression fixtures (3E). The README and syntax docs should no longer
imply that overlap is score-only with no placement action.
