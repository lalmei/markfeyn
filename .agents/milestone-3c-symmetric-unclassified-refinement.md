# Milestone 3C Prompt: Symmetric Unclassified Tree and Two-Point Loop Refinement

You are working in `/Users/lalmei/Documents/markfeyn`.

Goal: implement MarkFeyn Feynman-layout Milestone 3C: symmetric unclassified tree and two-point loop refinement.

## Context

MarkFeyn already has:

- Milestone 1 semantic layout/orientation/topology analysis.
- Milestone 2 stable ordering, ELK ports, parallel propagators, and score diagnostics.
- Milestone 3A loop candidate layouts for triangle, box, tadpole, and simple one-loop diagrams.
- Milestone 3B label-aware scoring, generic polygon/vacuum one-loop behavior, soft loop symmetry scoring, and label-aware loop candidate diagnostics.

Current issue: diagrams with no explicit `incoming` / `outgoing` roles correctly enter `orientation.mode === "symmetric"` and keep degree-1 endpoints as `unclassified`, but some diagrams still produce visually asymmetric geometry.

Implement Milestone 3C only.

## Concrete Failing Tree Example

```feynman
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\mu^+ mu_minus:\mu^- ann->prod:\gamma
```

Observed current behavior:

- Topology is `tree`.
- Orientation is `symmetric`.
- `e_minus`, `e_plus`, `mu_plus`, and `mu_minus` remain `unclassified`.
- Geometry is not visually symmetric around the two internal vertices.

Required behavior:

- Do not infer `incoming` or `outgoing`.
- Detect this as a symmetric unclassified two-center tree when topology supports it.
- Place the two internal vertices on a stable central axis.
- Place equivalent external leaves symmetrically around that internal edge.
- Keep equivalent external leg lengths approximately equal.
- Prefer reflection symmetry when topology supports it.

## Concrete Failing Two-Point Loop Example

```feynman
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\gamma gamma2:\gamma
```

Observed current behavior:

- `incoming` and `outgoing` are empty.
- `gamma1` and `gamma2` remain `unclassified`.
- Topology is `selfEnergy`.
- Orientation is `symmetric`.
- Geometry places both unclassified external photons on the same side, so the diagram is not visually symmetric.

Required behavior:

- Do not infer `incoming` or `outgoing`.
- For symmetric two-point loops with one unclassified external leg attached to each loop endpoint, place the external legs on opposite sides of the loop axis.
- Keep internal loop vertices centered.
- Keep the two external leg lengths approximately equal.
- Preserve existing parallel/self-energy loop arc behavior.
- Preserve momentum-label outside placement.

## Required Work

### 1. Symmetric Unclassified Topology Refinement

- Add focused support for symmetric unclassified trees and two-point loop/self-energy-like diagrams.
- Detect simple two-center trees with equivalent leaf branches, especially diagrams with two internal vertices connected by one internal edge and equal numbers of unclassified external leaves attached to each internal vertex.
- Detect symmetric two-point self-energy-like diagrams with one unclassified external leg attached to each of two internal loop endpoints.
- Preserve asymmetric trees as asymmetric. Do not force false symmetry.
- Do not implement a broad graph automorphism engine.
- Do not infer `incoming` or `outgoing` roles.
- Do not use fermion arrows, momentum arrows, or edge source/target spelling as process-direction hints.

### 2. Geometry Behavior

- For balanced two-center unclassified trees:
  - place internal vertices on a stable central axis;
  - place equivalent external leaves symmetrically around the internal edge;
  - keep equivalent external leg lengths approximately equal.
- For symmetric two-point loops:
  - place internal endpoints on a stable central axis;
  - place unclassified external legs on opposite sides of the loop;
  - keep external leg lengths approximately equal;
  - preserve existing loop/parallel curve assignments.
- Preserve deterministic output.
- Preserve manual `position` coordinates exactly.
- Preserve explicit curve, label side, momentum, and arrow options.
- Preserve existing loop candidate behavior from Milestones 3A and 3B unless shared scoring integration requires harmless additions.

### 3. Scoring and Diagnostics

- Add or extend renderer-neutral scoring for symmetric unclassified refinement:
  - equivalent branch length variation;
  - equivalent branch angle variation;
  - mirrored-coordinate deviation;
  - centered interaction region;
  - two-point loop external leg side balance.
- Expose finite score fields in `layout.score.breakdown`.
- Add diagnostics/debug metadata explaining when symmetric unclassified refinement was applied or skipped.
- Keep diagnostics clear about scope: focused tree/two-point-loop refinement, not full automorphism solving.

### 4. Scope Boundaries

- Do not implement general graph automorphism.
- Do not implement general multiloop or nested-loop optimization.
- Do not implement incremental layout stability.
- Do not change public APIs:
  - preserve `parseFeynman(source)`;
  - preserve `layoutFeynman(diagram, options)`.
- Do not move manually positioned vertices.
- Do not treat particle labels, momentum direction, fermion arrows, or edge source/target order as process-direction hints.
- Keep code modular under `src/markfeyn/renderer/layout/`.
- Use existing JavaScript/JSDoc style, not TypeScript.
- Update source renderer first, then rebuild generated bundle with `npm run build:js`.

## Files to Inspect First

- `src/markfeyn/renderer/feynman-diagrams.js`
- `src/markfeyn/renderer/layout/layout.js`
- `src/markfeyn/renderer/layout/topology.js`
- `src/markfeyn/renderer/layout/score.js`
- `src/markfeyn/renderer/layout/labels.js`
- `src/markfeyn/renderer/layout/parallel.js`
- `src/markfeyn/renderer/layout/external-order.js`
- `tests/feynman-diagrams.test.js`
- `docs/syntax.md`
- `.agents/overall_plan.md`

## Tests

Add or update JS tests for:

- The no-role annihilation tree example above produces symmetric geometry.
- The same annihilation diagram with explicit `incoming` / `outgoing` still uses process layout.
- The gamma-to-gamma no-role loop places `gamma1` and `gamma2` as `unclassified` on opposite sides of the loop.
- The same gamma-to-gamma loop with explicit `incoming gamma1` and `outgoing gamma2` still uses process layout.
- Unclassified external endpoints remain `unclassified`; no incoming/outgoing roles are invented.
- Fermion arrows do not change symmetric-tree or symmetric-loop geometry.
- Momentum direction does not change symmetric-tree or symmetric-loop geometry.
- Manual positions are preserved.
- Explicit curve and label-side options are preserved.
- Asymmetric unclassified trees are not forced into false symmetry.
- Symmetric-refinement score fields are finite.
- Diagnostics/debug explain applied or skipped symmetric unclassified refinement.
- Existing two-edge loop momentum labels remain outside.
- Existing self-energy parallel-propagator tests still pass.
- Existing Milestone 1, 2, 3A, and 3B tests continue to pass.
- Every new `docs/examples.md` block added for this milestone parses and lays out through the existing documented-examples test.

Prefer deterministic geometry or layout-signature assertions over browser pixel snapshots.

## Docs

- Update `docs/syntax.md` with Milestone 3C behavior.
- Add a focused section to `docs/examples.md` for symmetric mode / no-role diagrams so visual docs exercise the Milestone 1 and 2 semantics that this milestone depends on.
- Include examples for:
  - no-role annihilation tree, showing unclassified symmetric tree behavior;
  - explicit-role annihilation tree, showing process mode still wins when `incoming` / `outgoing` are declared;
  - no-role gamma-to-gamma two-point loop, showing unclassified external legs on opposite sides;
  - explicit-role gamma-to-gamma two-point loop, showing process mode still wins;
  - one asymmetric unclassified tree, showing the layout is not forced into false symmetry.
- Keep these examples automatic-layout only unless the example is explicitly demonstrating manual `position`.
- Keep docs honest:
  - this is a focused unclassified tree and two-point-loop heuristic;
  - it is not a full automorphism engine;
  - it is not general multiloop optimization;
  - it is not incremental layout stability;
  - it does not infer process roles.
- Update `README.md` only if the high-level feature summary changes.

## Verification Commands

```bash
npm run build:js
node --check src/markfeyn/assets/feynman-diagrams.js
node tests/feynman-diagrams.test.js
uv run --group dev pytest
```

## Definition of Done

- The concrete no-role annihilation tree is visibly and geometrically symmetric.
- The concrete no-role gamma-to-gamma two-point loop is visibly and geometrically symmetric.
- No process roles are invented in either no-role example.
- Explicit `incoming` / `outgoing` versions still use process layout.
- Manual positions and explicit curve/label/momentum options are preserved.
- Existing loop candidate behavior from 3A/3B still passes.
- All verification commands pass.
