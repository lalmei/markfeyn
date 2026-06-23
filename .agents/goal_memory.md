# Goal Memory

Lessons and decisions that were not obvious from milestone prompts or the overall
plan alone. Update this when implementation feedback reveals a gap between spec
intent and user/physics expectations.

## Symmetric unclassified two-center trees (Milestone 3C)

### Visual identity with explicit-role diagrams

For balanced two-center trees that look like 2→2 scattering (e.g. `e^- e^+ → γ → μ^+ μ^-`),
users expect the **no-role** and **explicit `incoming`/`outgoing`** versions to render
**identically**. The only difference should be semantic metadata (`unclassified` vs
`incoming`/`outgoing`), not geometry.

The milestone phrase “place equivalent external leaves symmetrically around the internal
edge” is easy to misread as **vertical fans from a clustered internal pair at the canvas
center**. That produces a squashed, unreadable diagram. The correct convention for
horizontal orientation is **left-to-right scattering geometry**:

- left-center leaves on the **left boundary** (`marginX`), vertically fanned;
- right-center leaves on the **right boundary** (`width - marginX`), vertically fanned;
- internal vertices on a **horizontal backbone** using the same terminal-gap band as
  process 2-in-2-out exchange (`layerStart + terminalGap`, `layerEnd - terminalGap`);
- internal cross (y) centered on the fan midpoint of attached leaves.

After this fix, no-role and explicit-role annihilation diagrams share the same numeric
positions; only `kind` differs.

### Do not infer roles; do match conventional shape

Symmetric refinement must **not** assign `incoming`/`outgoing`, but it **should** still
draw recognizable physics layouts when topology clearly supports them. Symmetry here means
reflection-balanced **process-shaped** placement, not “everything at the center.”

### Detection guardrails

Two-center symmetric refinement applies when:

- exactly **two** internal vertices connected by one backbone edge;
- **equal** counts of unclassified leaves on each center (**any N→N including 1→1, 2→2, 3→3, …**), or
  counts that differ by **at most one** (for example 2→1);
- each center’s only neighbors are its leaf fan plus the other internal.

**Even vs odd** is determined by the **total** unclassified count across both centers
(not per side). Balanced 3→3 means six externals → even → all on margins.

Refinement is **skipped** when leaf counts differ by more than one (for example one
leaf on one side and three on the other), or when the topology is not a balanced
two-center tree / symmetric two-point self-energy loop.

**Odd unclassified placement (horizontal orientation):**

- **Even total** unclassified count: all terminals on left/right margins (including
  balanced 3→3 per center, six overall).
- **Odd total** unclassified count: median leaf by declaration order → top center if
  attached to left internal, bottom center if attached to right internal; remaining
  leaves on margins.

### Self-energy two-point loops (gamma–gamma bubble)

Self-energy two-point loops (gamma–gamma bubble) also match **horizontal**
left-to-right process geometry when orientation is horizontal: externals at
`marginX` / `width - marginX`, loop endpoints inset along the backbone. Do **not**
place externals above/below a clustered internal pair — that was the bug that
produced the vertical squashed loop in docs.

Loop chord length uses `span * 0.452` (capped) so internal `a`/`b` spacing matches
spring process layout within a few pixels of ELK.

## Layout pipeline ordering

Symmetric unclassified refinement runs **after** loop candidates and symmetric contact,
**before** generic `layoutSymmetricTree` and ELK. `shouldUseSymmetricTreeLayout` must
exclude diagrams that already matched unclassified refinement.

Self-energy diagrams skip loop-candidate layout (`loopCandidate` is null when topology is
`selfEnergy`); they rely on unclassified refinement or ELK + parallel curve plan.

## Tests and docs

- Assert **scattering geometry** for annihilation no-role tests (`e_minus.x < ann.x`,
  leaves at `marginX` / `width - marginX`), not only vertical fan symmetry around a
  centered backbone.
- Optional: compare `positionSignature` between no-role and explicit-role versions when
  geometry should match.
- `docs/examples.md` side-by-side no-role vs explicit-role blocks are the main visual
  regression surface; they require `npm run build:js` so `src/markfeyn/assets/feynman-diagrams.js`
  is current.

## Parser quirks (tests)

- Standalone `label side=right` in edge options is **not** parsed; use `momentum` /
  `momentum'` or `edge label'` for label-side tests.
- Curve options live on `edge.curve.side`, not `edge.curveSide`.

## Score fields (3C)

Symmetric unclassified scoring adds five breakdown fields:
`symmetricUnclassifiedBranchLengths`, `BranchAngles`, `MirrorDeviation`,
`CenteredInteraction`, `ExternalLegBalance`. Diagnostics stage:
`symmetric-unclassified`.

## Label placement (Milestone 3D)

Final label placement runs after geometric layout/refinement and before final
`scoreLayout`. The pass writes `layout.labelPlacement`, then `scoreLabelGeometry`
reads those resolved anchors so `layout.score` matches the rendered output.

Placement is deliberately local and deterministic:

- node labels try top/bottom/left/right offsets plus small same-side shifts;
- edge labels try normal-side and tangent-shift candidates unless an explicit
  primed/right-side option fixes the side;
- momentum labels and arrows are scored as one group so side flips do not
  separate the label from its arrow;
- hard collisions are tracked separately from the residual soft label score and
  reported by diagnostic stage `label-placement`.

This pass does **not** infer process roles, change topology, move vertices, or
feed labels back into ELK/spring forces. It is an approximate SVG bounding-box
resolver, not exact TeX/TikZ font measurement or a global label-packing solver.
