# Milestone 3E Prompt: Symmetric Unclassified Contact Stars

You are working in `/Users/lalmei/Documents/markfeyn`.

Goal: implement a focused follow-up to symmetric mode for one-center unclassified
contact/star diagrams. This is a Milestone 3 symmetry polish task, not Milestone
4 multiloop hardening.

## Context

MarkFeyn already has:

- explicit process mode for declared `incoming` / `outgoing` states;
- symmetric mode when process roles are unknown;
- a `contactInteraction` topology classification for one internal vertex with
  three or more external leaves;
- `layoutSymmetricContact(...)` in `src/markfeyn/renderer/feynman-diagrams.js`;
- existing Milestone 1 contact coverage in `tests/feynman-diagrams.test.js`;
- Milestone 3C two-center symmetric unclassified tree and two-point loop support;
- Milestone 4 multiloop/vacuum/incremental hardening in progress or recently
  completed.

The broad roadmap in `.agents/overall_plan.md` is background context only. It
mentions that symmetric mode should avoid arbitrary asymmetry and that single
contact vertices should use evenly spaced external legs or a balanced left-right
arrangement. Do not use the broad roadmap as permission to implement a full
automorphism engine or a new renderer subsystem.

## Concrete motivating example

```feynman
fermion l1->hub1 l2->hub1 l3->hub1
fermion hub1->r2 hub1->r3
label l1:a_1 l2:a_2 l3:a_3 r2:b_2 r3:b_3
vertex hub1:blob
```

Current behavior:

- topology is `contactInteraction`;
- orientation is `symmetric`;
- all five external leaves remain `unclassified`;
- the layout uses the symmetric-contact path, but the odd five-leg star can feel
  visually arbitrary rather than obviously balanced.

Important semantic guardrail:

- Do not infer process roles from `l*` / `r*` names.
- Do not infer process roles from edge source/target spelling such as
  `l1->hub1` or `hub1->r2`.
- Do not make `l1 l2 l3` incoming or `r2 r3` outgoing unless the user declares
  those roles explicitly.

This task is about contact-star symmetry and deterministic presentation, not
about process inference.

## Required behavior

For symmetric unclassified contact interactions:

- place the contact vertex at the structural center unless it has a fixed
  manual position;
- keep unclassified external leaves on a stable ring or balanced bilateral
  arrangement around the contact vertex;
- for odd numbers of leaves, choose a deterministic anchor orientation that
  produces an obvious reflection axis, with the remaining leaves arranged in
  mirrored pairs;
- for even numbers of leaves, preserve balanced mirrored or rotational spacing;
- keep equivalent radial distances approximately equal;
- keep angular gaps approximately uniform unless label avoidance or fixed
  positions require a small deviation;
- use declaration order only as a deterministic tie-breaker, not as process
  direction;
- preserve explicit `incoming` / `outgoing` process layouts when roles are
  declared;
- preserve manual `position` coordinates exactly;
- keep blob/disk vertex sizing and labels readable.

## Scope boundaries

Do not implement:

- general graph automorphism solving;
- general tree symmetry beyond the already scoped Milestone 3C behavior;
- multiloop or vacuum packing changes;
- custom ELK processor work;
- process role inference from names, edge source/target order, fermion arrows,
  momentum arrows, labels, or particle styles;
- public API changes to `parseFeynman(source)` or `layoutFeynman(diagram, options)`.

Keep changes narrowly scoped to the existing renderer/layout pipeline.

## Files to inspect first

- `src/markfeyn/renderer/feynman-diagrams.js`
  - `layoutSymmetricContact(...)`
  - `placeNodesOnRing(...)`
  - node label placement and blob rendering helpers only if needed
- `src/markfeyn/renderer/layout/layout.js`
  - `shouldUseSymmetricContactLayout(...)`
- `src/markfeyn/renderer/layout/topology.js`
  - `contactInteraction` classification
- `src/markfeyn/renderer/layout/score.js`
  - existing symmetry/contact score fields if relevant
- `tests/feynman-diagrams.test.js`
- `.agents/overall_plan.md` as reference-only background

## Tests to add or update

Add focused JS tests before or alongside implementation.

Required tests:

- The concrete five-leg `hub1` example:
  - parses without errors;
  - detects `contactInteraction`;
  - uses `orientation.mode === "symmetric"`;
  - leaves every external vertex `unclassified`;
  - keeps `hub1` centered;
  - gives all external leaves approximately equal radial distance from `hub1`;
  - gives angular gaps approximately uniform;
  - has a visually stable reflection-axis orientation for odd leaf count;
  - has finite score breakdowns;
  - reruns deterministically.
- A four-leg unclassified contact regression still passes the existing balanced
  contact expectations.
- A six-leg unclassified contact uses balanced spacing and deterministic order.
- The same five-leg shape with explicit roles:
  - `incoming l1 l2 l3`
  - `outgoing r2 r3`
  still uses process layout and places incoming/outgoing sides conventionally.
- Changing fermion arrow direction does not change symmetric contact layout.
- Reversing edge source/target spelling without declared roles does not create
  process layout or mirror the whole diagram.
- Manual `position hub1 x y` is preserved exactly.
- Blob/disk contact vertices remain centered and labels do not produce
  non-finite label-placement scores.

Prefer geometry and layout-signature assertions over pixel snapshots.

## Suggested implementation approach

1. Add small geometry helpers in the test file:
   - angle from center to leaf;
   - normalized angular gaps;
   - radial-distance range;
   - optional mirror-pair deviation against a chosen axis.
2. Add the five-leg contact fixture as a failing or clarifying test.
3. Refine `layoutSymmetricContact(...)` only if the fixture exposes a real
   asymmetry:
   - keep the center placement;
   - compute a contact-star start angle from leaf count and orientation;
   - for odd leaf counts, align one leaf with a vertical or horizontal visual
     axis and arrange the rest as mirrored pairs;
   - for even leaf counts, preserve existing balanced behavior unless tests show
     a regression;
   - do not inspect node names or edge direction to decide sides.
4. If the current geometry already satisfies radial and angular symmetry, keep
   the implementation minimal: add regression coverage and update docs/notes to
   clarify that unclassified contact stars are symmetric but do not infer
   incoming/outgoing grouping.

## Docs

If behavior changes or the expectation needs clarification, update the relevant
docs page under `docs/`:

- explain that no-role contact diagrams use symmetric contact-star layout;
- state that names like `l1` and `r2` do not create process roles;
- show that explicit `incoming` / `outgoing` declarations are required for
  left-vs-right process grouping.

Do not reorganize docs as part of this task.

## Verification commands

Run the full local verification stack:

```bash
npm run test:js
make test-js
uv run --group dev pytest
make docs
```

Also run:

```bash
git diff --check -- src/markfeyn/assets/feynman-diagrams.js src/markfeyn/renderer/feynman-diagrams.js src/markfeyn/renderer/layout tests docs .agents
```

If repo-wide `git diff --check` fails because of unrelated pre-existing docs
whitespace, report that separately and do not fix unrelated files unless the
user asks.

## Definition of done

- The five-leg unclassified contact example has a clearly balanced symmetric
  contact-star layout.
- No incoming/outgoing semantics are invented.
- Explicit-role versions still use process layout.
- Fermion arrows and edge spelling do not control symmetric layout direction.
- Existing Milestone 1, 2, 3, and 4 tests continue to pass.
- The generated browser bundle is rebuilt with `npm run build:js` through the
  verification stack.
