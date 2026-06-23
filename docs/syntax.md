# Syntax

A diagram is written as a fenced code block tagged with `feynman`:

````markdown
```feynman
incoming i1 i2
outgoing o1 o2
fermion i1->v1 v2->o1
photon v1->v2
fermion i2->v1 v2->o2
label i1:e⁻ i2:e⁺ o1:μ⁻ o2:μ⁺ v1->v2:γ
```
````

## Nodes

Visible degree-1 endpoints are external nodes, but MarkFeyn does not infer
incoming or outgoing roles from edge source/target order. A degree-1 endpoint
without an explicit role is unclassified and is laid out symmetrically when no
reliable process direction exists:

```feynman
fermion e->v1 v1->muon
fermion positron->v1 v1->antimuon
label e:e⁻ positron:e⁺ muon:μ⁻ antimuon:μ⁺
```

Use `incoming` and `outgoing` when the diagram has a known process direction or
when you need an explicit terminal order:

```feynman
incoming positron e
outgoing antimuon muon
fermion e->v1 v1->muon
fermion positron->v1 v1->antimuon
label e:e⁻ positron:e⁺ muon:μ⁻ antimuon:μ⁺
```

Internal vertices do not need separate declarations. Any node used in a visible
edge with degree greater than one, or any node not declared or detected as an
external endpoint, is treated as an internal vertex.

## Vertex Shapes

Internal vertices are coordinate points by default, so no marker is drawn. Use
`vertex` with `node:shape` pairs when a visible vertex marker is needed:

```feynman
incoming a
outgoing b c
fermion a->v v->b
photon v->blob blob->c
vertex v:dot blob:blob
label a:e^- b:e^- c:\gamma
```

Supported vertex shapes:

| Shape | Rendering |
| --- | --- |
| `dot` | Small filled circle |
| `square-dot` | Small filled square |
| `empty-dot` | Small open circle |
| `crossed-dot` | Open circle with a cross |
| `cross` | Cross marker without an enclosing circle |
| `blob` | Large shaded circle for effective interactions |
| `disk`, `large-blob` | Larger shaded disk for contact regions |

Shape names with spaces can be quoted, such as `vertex v:"crossed dot"`.
Blob and disk vertices also accept bracketed options:

```feynman
incoming a
outgoing b
plain a->disk disk->b
vertex disk:disk[hatch=cross,size=52]
```

Supported hatch fills are `diagonal`, `diagonal-reverse`, `cross`,
`horizontal`, `vertical`, and `grid`. TikZ-style aliases such as
`north east lines` and `north west lines` are accepted. `size` and `radius`
set the circle radius in SVG pixels; `diameter` sets the full circle width.
Named sizes are `tiny`, `small`, `medium`, `large`, `huge`, and `disk`.

## Edges

Edges use `from->to` notation. Multiple edges of the same type can be written on one line.

Supported particle types:

| Type | Rendering |
| --- | --- |
| `plain`, `line`, `propagator` | Solid line without an arrow |
| `fermion` | Solid line with centered arrow |
| `anti fermion`, `anti-fermion` | Solid line with reversed centered arrow |
| `photon` | Sinusoidal wave |
| `boson` | Alias for `photon` |
| `gluon` | Looped path |
| `scalar` | Dashed line |
| `charged scalar`, `charged-scalar` | Dashed line with centered arrow |
| `ghost` | Dotted line |
| `invisible`, `hidden` | A layout-only edge that is not rendered |

Invisible edges are useful when the automatic layout needs a hint:

```feynman
layout spring
incoming pi0
outgoing gamma1 gamma2
scalar pi0->t1
fermion t1->t2 t2->t3 t3->t1
photon t2->gamma1 t3->gamma2
invisible gamma1->gamma2
label pi0:\pi^0 gamma1:\gamma gamma2:\gamma
```

Per-edge options can be written after an edge with brackets. `draw=none`,
`hidden`, and `invisible` hide an edge while keeping it in the layout;
`reverse` flips an edge arrow. TikZ-Feynman-style curve options are supported
for loops and bent propagators:

```feynman
fermion a->b[reverse]
scalar c->d[draw=none]
fermion b->c[half left] c->b[half left]
boson d->e[bend left]
fermion f->g[out=180, in=45]
```

Supported curve options are `half left`, `half right`, `quarter left`,
`quarter right`, `bend left`, `bend right`, `out=...`, `in=...`, and
`looseness=...`.

Inline edge labels can be written as `edge label=...` or `edge label'=...`.
The `momentum=...` and `momentum'=...` aliases place the same text on opposite
sides of the edge. A declared `label from->to:...` remains a normal edge label,
so it can be combined with an inline momentum arrow:

```feynman
photon a->b[momentum'=k]
label a->b:\gamma
fermion b->c[momentum=k] c->b[momentum'=k-p]
```

## TikZ-Feynman Differences

MarkFeyn is TikZ-Feynman-inspired, not TikZ-compatible. It uses a small
line-oriented DSL that renders directly to browser SVG, so it does not evaluate
TeX macros, PGF keys, or TikZ graph syntax.

The main overlaps are particle names and a small set of familiar edge options:
`half left`, `half right`, `quarter left`, `quarter right`, `bend left`,
`bend right`, `out=...`, `in=...`, `looseness=...`, `edge label=...`,
`momentum=...`, and their primed label variants.

The obvious differences are:

| Area | MarkFeyn behavior |
| --- | --- |
| Input syntax | Uses commands such as `incoming`, `outgoing`, `fermion a->b`, and `label a:text`; it does not parse `\feynmandiagram`, `\diagram*`, or TikZ `a -- [fermion] b` syntax. |
| Rendering engine | Produces native SVG in the browser; it does not run LaTeX, TikZ, PGF, LuaTeX, or Graphviz. |
| Layout algorithms | Uses bundled ELK.js backends for `spring`, `spring-electrical`, `layered`, and `tree`; these are compatible graph-layout families, not pixel-identical TikZ/PGF output. |
| Option support | Only documented options are recognized. Unknown TikZ keys are ignored only when they are part of unsupported edge options, or reported as parse errors for diagram-level options. |
| Coordinates | Manual `position node x y` values are absolute SVG coordinates, not TeX dimensions or TikZ coordinate expressions. |
| Labels | Supports a small TeX-like label subset for common symbols, scripts, and overlines. When MathJax is loaded on the page (as in the bundled docs sites), labels with richer subscripts such as `g_{\pi\pi n}` are typeset through MathJax automatically. |
| Styling | Uses bundled CSS classes and fixed SVG geometry defaults instead of TikZ styles, scopes, layers, decorations, and reusable PGF styles. |
| Arrows and momenta | Arrowheads and momentum arrows are SVG glyphs computed from the edge geometry, so spacing and orientation are approximate rather than TikZ-identical. |

### Graph Algorithm Comparison

TikZ-Feynman delegates automatic vertex placement to the TikZ/PGF graph drawing
system. In its source, `\feynmandiagram` and non-starred `\diagram` select
TikZ's `spring layout` by default, and TikZ-Feynman loads PGF's `circular`,
`force`, `layered`, and `trees` graph drawing libraries when running under
LuaTeX. MarkFeyn uses ELK.js in the browser for compatible layout families and
then normalizes the result into its SVG coordinate model.

| Concept | TikZ-Feynman / PGF | MarkFeyn |
| --- | --- | --- |
| Automatic placement backend | TikZ-Feynman is a wrapper around TikZ `\graph` and PGF graphdrawing. Automatic placement requires LuaTeX; without it, TikZ-Feynman falls back to a rudimentary mode and warns. | Bundles ELK.js into MarkFeyn's browser renderer; no TeX, LuaTeX, PGF, Graphviz, or runtime network dependency is involved. |
| Default layout | `\feynmandiagram` and non-starred `\diagram` inject TikZ's `spring layout`. Starred `\diagram*` does not inject the automatic layout and is intended for manually placed vertices. | `layout spring` is the default for every diagram unless the source selects another MarkFeyn layout. |
| Spring layout | PGF's `spring layout` selects Hu's 2006 spring layout. The implementation supports fixed `desired at` nodes, graph-distance forces, adaptive step length, convergence tolerance, and optional multilevel coarsening. | Uses ELK `force`, normalized into MarkFeyn's viewBox and terminal-side model. |
| Spring-electrical layout | PGF's `spring electrical layout` selects a separate Hu 2006 electrical algorithm. It supports per-node `electric charge`, a spring constant, optional quadtree approximation for remote repulsive forces, adaptive convergence, and optional coarsening. | Uses ELK `force` with stronger spacing and repulsion settings than `spring`. |
| Layered layout | PGF's `layered layout` is the modular Sugiyama method: cycle removal, layer assignment, crossing minimization, node positioning, and edge routing. Its default node ranking uses a network-simplex implementation, and its default crossing minimization uses weighted-median sweeps. | Uses ELK `layered`, with declared incoming nodes constrained to the first layer and outgoing nodes to the last layer before MarkFeyn terminal-side normalization. Unclassified endpoints do not receive process-side constraints. |
| Tree layout | PGF's `tree layout` uses the Reingold-Tilford algorithm on a tree or spanning tree, with subtree contour spacing and options for missing children. | Uses MarkFeyn's deterministic tree placer after semantic analysis, preserving declared external sides and manual positions. |
| Manual placement | TikZ accepts coordinates, relative positioning, scopes, transforms, and TeX dimensions. | `position node x y` pins absolute SVG coordinates only. These pinned nodes are respected by all MarkFeyn layouts. |
| Invisible edges | TikZ-Feynman recommends `draw=none` edges because PGF layout still treats them as edges, while the drawing pass skips them. | `invisible` and `hidden` edges are kept in most layout calculations and skipped by the SVG renderer. |
| Edge paths | TikZ-Feynman draws particle lines through PGF styles, postactions, and decorations. Photons use a custom `complete sines` decoration, gluons use PGF's `coil` decoration, and momentum arrows use path-construction decorations. | MarkFeyn converts each edge to a straight line or cubic Bezier, then samples that geometry for photon waves, gluon loops, labels, and momentum arrows. |
| Determinism | PGF's force layouts use algorithm parameters such as random initial layouts, convergence tolerances, cooling, and optional coarsening, so exact placement is PGF-engine behavior rather than TikZ-Feynman code. | MarkFeyn uses fixed ELK options and a fixed random seed where applicable, so the same source should produce stable browser SVG across documentation builds. |

### Bundled ELK Layouts

ELK computes node coordinates only. MarkFeyn still draws particle paths,
labels, braces, momentum arrows, vertex markers, and parse errors itself.

The renderer keeps this graph contract around ELK:

- Manual `position` values are reapplied after automatic layout.
- Hidden and invisible edges are passed to ELK but skipped by SVG rendering.
- `incoming` and `outgoing` remain optional MarkFeyn side/order hints, not
  TikZ syntax.
- Unclassified external endpoints remain distinct from incoming and outgoing
  states; they do not create a process direction by themselves.
- Declared incoming and outgoing nodes are placed on terminal sides after ELK
  normalization.
- Single visible terminal legs are kept straight where possible by matching the
  terminal node's cross-axis coordinate to its adjacent internal node.

Milestone 2 adds a stricter semantic ordering and diagnostics contract:

- External ordering is stable. Declared `incoming` and `outgoing` nodes keep
  their declaration order on process boundaries. If a previous semantic order
  is supplied by API options it is used next, followed by source declaration
  order, then stable node id order.
- Symmetric diagrams keep unclassified degree-1 endpoints unclassified. They
  are ordered deterministically for balanced contact and tree placement without
  assigning incoming or outgoing process meaning.
- Layered process diagrams use explicit ELK ports. Incoming terminal legs use
  the process-start side and adjacent internal ports use the opposite side;
  outgoing terminal legs use the process-end side and adjacent internal ports
  use the opposite side. Fermion arrows, momentum arrows, and edge source/target
  spelling do not determine process direction.
- Spring, spring-electrical, and symmetric layouts still avoid applying those
  layered port constraints, although debug diagnostics can show the inferred
  port plan.
- Multiple visible internal propagators between the same two interaction
  vertices are detected as parallel propagator groups. When the group is an
  internal two-vertex bubble, topology reports it as `selfEnergy`.
- Uncurved parallel internal propagators are assigned deterministic cubic arcs.
  For two propagators, the arcs are placed on opposite sides of the principal
  axis. Existing label and momentum helpers then sample those curved paths, so
  labels and momentum arrows stay outside the loop where the geometry allows it.
- `layout.score` contains a lightweight numeric score with a breakdown for
  missing coordinates, non-finite coordinates, external boundary role
  violations, parallel-edge overlap, external alignment, rough symmetry, loop
  edge overlap, loop readability, loop symmetry, external leg straightness,
  node-label overlap, edge-label overlap, label-label overlap, labels inside
  loop interiors, and momentum-label or momentum-arrow loop collisions.
- `layout.diagnostics` includes topology, orientation evidence, external
  ordering, port constraints, parallel-edge groups, label placement, and the
  score summary. ELK's compiled graph remains debug-only under `layout.debug`.

Milestones 3A, 3B, and 3D add focused one-loop candidate layouts plus final
label placement:

- Topology analysis detects triangle loops, box loops, tadpoles, and simple
  one-loop polygon cycles among interaction vertices. Generic polygon loops
  with five or more loop vertices use the `polygonLoop` topology. Two-vertex
  self-energy bubbles made from parallel internal propagators keep the
  Milestone 2 `selfEnergy` behavior and are not replaced by the loop-candidate
  path.
- The candidate generator tries deterministic placements for the detected loop
  and chooses the lowest-scoring candidate. The implemented score checks cover
  missing or non-finite coordinates, external role placement, edge overlap,
  loop readability, soft loop symmetry, label placement, and straightness for
  declared external legs.
- Label-aware scoring estimates node-label, edge-label, momentum-label,
  momentum-arrow, and loop-edge-label boxes without browser font metrics.
  Triangle, box, polygon, tadpole, and self-energy-like loop labels prefer
  exterior placements when the candidate geometry makes an outside placement
  available. Explicit label-side options such as `edge label'` and
  `momentum'` are preserved; scoring may choose a different loop candidate, but
  it does not rewrite the label option.
- After geometric placement finishes, a deterministic label-placement pass
  evaluates local bounding-box candidates for node labels, edge labels, and
  momentum label/arrow groups. It chooses concrete anchors that minimize
  residual overlap with vertices, sampled propagators, loop interiors, and
  previously placed labels. The result is exposed as `layout.labelPlacement`,
  reported with diagnostic stage `label-placement`, and reused by the SVG
  renderer so final score diagnostics reflect the rendered anchors.
- Vacuum one-loop diagrams without external states use deterministic centered
  polygon placement and keep symmetric orientation. Disconnected two-loop
  vacuum regions are separated deterministically; arbitrary higher-order vacuum
  packing remains a documented limitation.
- Multi-loop diagrams with two nested, overlapping, or disjoint loop regions are
  decomposed into loop regions and assigned bounded semantic candidates before
  falling back to ELK. The topology diagnostics expose `loopRegions`,
  `biconnectedComponents`, articulation vertices, bridges, and the multiloop
  sub-kind.
- Candidate generation is semantic. Declared `incoming` and `outgoing` roles
  influence external placement, but fermion arrows, momentum-arrow direction,
  and edge source/target spelling do not infer a process direction.
- Manual `position` coordinates are preserved. Existing explicit curve options,
  `out=...`, and `in=...` are preserved; only uncurved tadpole self-loops get
  an automatic self-loop curve.
- `preservePreviousLayout: true` with a `previousLayout` object preserves shared
  vertex coordinates and external ordering for small source edits. This is a
  stability hint, not a guarantee when the topology class changes.
- Selected label-aware candidates are reported in `layout.diagnostics` with
  stage `loop-candidate`. When label-aware scoring changes the choice from the
  non-label baseline, the diagnostic and `layout.debug.loopCandidates` expose
  that fact. Candidate summaries include total, non-label, and label score
  totals.
- Pass `{ profile: true }` or `{ debug: true }` to include stage timings in
  `layout.debug.profile`. The `quality` option (`fast`, `balanced`, or `high`)
  bounds deterministic loop-candidate enumeration.

Current automatic-layout limitations are intentional: label placement uses
estimated SVG text boxes, not exact TeX/TikZ font metrics; MarkFeyn uses
bounded two-loop heuristics rather than a complete N-loop optimizer; and
incremental layout stability is best-effort for unchanged vertices.
- Labels and momentum arrows still use the normal SVG geometry helpers with
  resolved placement anchors. For loop edges this keeps them outside the loop
  where the selected geometry and side options make that possible, but it does
  not run a global label-packing optimizer or move vertices to create label
  space.

Current automatic layout still does not perform general higher-order multiloop
optimization. Use manual positions or explicit curve options when exact
publication geometry matters.

### TikZ-Feynman Initial Settings

TikZ-Feynman does not have `incoming` or `outgoing` declarations. Its automatic
orientation keys work after graph layout by rotating, and optionally flipping,
the completed graph:

| TikZ-Feynman key | PGF orientation meaning | MarkFeyn command |
| --- | --- | --- |
| `horizontal=a to b` | Shorthand for `orient tail=a`, `orient head=b`, and `orient=0`; the line from `a` to `b` is aligned with the positive x-axis. | `horizontal a to b` |
| `horizontal'=a to b` | Same line alignment as `horizontal`, with the rest of the graph flipped across that line. | `horizontal' a to b` |
| `vertical=a to b` | Shorthand for `orient tail=a`, `orient head=b`, and `orient=-90`; the line from `a` to `b` is aligned vertically. | `vertical a to b` |
| `vertical'=a to b` | Same line alignment as `vertical`, with the rest of the graph flipped across that line. | `vertical' a to b` |

MarkFeyn's `orientation` command is different. It places declared external
roles on terminal sides before layout: `horizontal` places incoming nodes on the
left and outgoing nodes on the right, while `horizontal-reverse` swaps those
sides. `vertical` and `vertical-reverse` keep the same terminal-side idea but
use a taller canvas and encourage internal vertices to stack vertically.

The TikZ-style `horizontal a to b` and `vertical a to b` commands are separate
post-layout alignment commands. They rotate the completed layout so the named
pair has the requested angle. Primed variants also mirror the graph across that
named line.

TikZ's `vertical=a to b` uses `orient=-90` in TikZ's y-up coordinate system.
MarkFeyn maps that to the corresponding visual direction in SVG, so `a`
appears above `b` in the rendered diagram.

When `vertical a to b` or `vertical' a to b` is used without explicit
`options width=... height=...`, MarkFeyn chooses a portrait viewBox so the
rotated diagram has room for standard-length external legs.

TikZ-Feynman's size presets also seed PGF graphdrawing distances:

| TikZ-Feynman size | `node distance` | graphdrawing `node distance` | `level distance` | `sibling distance` |
| --- | --- | --- | --- | --- |
| `small` | `1cm` | `1.25cm` | `1cm` | `1.5cm` |
| `medium` | `1.5cm` | `1.9cm` | `1.5cm` | `2.25cm` |
| `large` | `2cm` | `2.5cm` | `2cm` | `3cm` |

MarkFeyn size presets are SVG-pixel viewBox defaults instead. The current
presets are `small` at `420 x 280`, `medium` at `520 x 330`, and `large` at
`760 x 480`, with separate margins and external-node gaps. The ELK result is
scaled into that viewBox rather than using TikZ's centimeter-based distances.

The practical result is that MarkFeyn can mimic simple TikZ-Feynman diagram
shapes, but matching TikZ output exactly requires manual `position` commands
and sometimes invisible layout edges.

## Layout Options

Use diagram-level commands before or after edge declarations:

```feynman
layout spring
orientation vertical
size small
options width=560 height=420 margin_x=64 margin_y=56
```

Supported layouts:

| Layout | Use case |
| --- | --- |
| `spring` | Default, force-directed placement that spreads connected internal vertices |
| `spring-electrical` | Spring layout with stronger charge-like repulsion between vertices |
| `layered` | Stable side-to-side diagrams with deterministic vertex layers |
| `tree` | Branching decays and hierarchy-like diagrams |

Supported orientations:

| Orientation | Direction |
| --- | --- |
| `horizontal` | Incoming nodes on the left, outgoing nodes on the right |
| `horizontal-reverse` | Incoming nodes on the right, outgoing nodes on the left |
| `vertical` | Incoming nodes on the left, outgoing nodes on the right, with internal vertices encouraged to stack vertically |
| `vertical-reverse` | Incoming nodes on the right, outgoing nodes on the left, with internal vertices encouraged to stack vertically |

The size presets are `small`, `medium`, and `large`. `options width=...` and
`options height=...` override the SVG viewBox size.

## Implementation Summary

Rendering happens entirely in the bundled browser script. The documentation
plugin only copies and injects that script; the browser then parses each
`feynman` block, chooses a layout, and replaces the original code block with an
SVG figure.

The implementation pipeline is:

1. `parseFeynman` reads the block line by line into a diagram object containing
   explicit incoming and outgoing hints, edges, labels, braces, manual
   positions, vertex shapes, options, and parse errors.
2. `layoutFeynman` returns a promise. It converts the parsed diagram into a
   semantic graph with incoming, outgoing, unclassified, and internal vertices;
   validates references and role conflicts; classifies simple topology; chooses
   process, symmetric, or fixed orientation; sends eligible graphs to ELK; then
   normalizes the result into the selected viewBox.
3. `renderFeynmanElement` draws the positioned graph as SVG paths, markers,
   labels, vertex shapes, and braces. Parse errors are kept visible in a
   caption instead of failing silently.

The automatic layouts share the same coordinate model. Declared incoming nodes
are placed on one terminal side, declared outgoing nodes on the opposite
terminal side, and the orientation option controls which side is considered the
start or end. Unclassified external nodes remain unclassified and use symmetric
placement when no reliable process direction exists. Manual `position` commands
are reapplied after automatic layout and post-layout orientation, so absolute
coordinates always win.
Hidden or invisible edges still participate in layout, but are skipped by the
SVG renderer.

After ELK returns coordinates, MarkFeyn applies a small normalization layer to
match common Feynman-diagram expectations:

- Visible degree-1 endpoints without explicit roles are represented as
  unclassified external states instead of inferred from edge direction.
- Symmetric unclassified contact and tree diagrams use deterministic balanced
  placement rather than invented incoming/outgoing sides.
- Balanced two-center trees with matching unclassified leaf fans (any N→N per center,
  even **total** unclassified count), and unequal N→(N±1) splits with **odd total**
  count and the median leaf at top or bottom center, and symmetric two-point self-energy loops with one
  unclassified external leg on each loop endpoint, receive focused reflection-symmetric
  refinement. Balanced two-center trees use the same left-to-right scattering geometry as
  explicit-role process diagrams, without inferring process roles. This heuristic does
  not solve general graph automorphisms or force symmetry when leaf counts differ.
- Common two-in/two-out exchange topologies center their interaction vertices
  between paired terminal legs so the internal propagator is not tilted by
  arbitrary force-layout coordinates.
- Spring and spring-electrical layouts align the shortest internal backbone
  between incoming-attached and outgoing-attached vertices onto a common
  horizontal line, matching the usual TikZ-Feynman `horizontal=a to b` flow
  without requiring an explicit orientation command.
- Curved internal edge groups on spring layouts are chord-limited and
  vertically centered so semicircle loops such as `half left` pairs stay inside
  the viewBox.
- Straight single-terminal legs are aligned with their internal attachment
  point on every layout.
- Invisible terminal pairs align their attached internal vertices across the
  layer axis.
- When rendered edge geometry still crosses the viewBox margin, the layout is
  translated as a final pass.
- TikZ-style `horizontal a to b` and `vertical a to b` are post-layout
  transforms. `vertical` is mapped from TikZ's y-up angle convention into SVG's
  y-down coordinates, then uses a portrait default viewBox when dimensions are
  not explicit.
- Orientation endpoints with one incoming and one outgoing terminal are opened
  into mixed fans, so vertical scattering diagrams have the standard long,
  shallow external legs.
- Manual `position` values are applied again after all automatic placement and
  orientation steps, so pinned coordinates always win.

Layout implementations:

| Layout | Implementation |
| --- | --- |
| `layered` | ELK `layered`, with declared incoming nodes constrained to the first layer and outgoing nodes constrained to the last layer where applicable. |
| `tree` | Deterministic MarkFeyn tree placement, preserving declared external sides and manual positions without automatic terminal-role inference. |
| `spring` | ELK `force`, with fixed MarkFeyn spacing and seed options. |
| `spring-electrical` | ELK `force` with stronger spacing and repulsion settings than `spring`. |

If ELK fails at runtime, `layoutFeynman` falls back to MarkFeyn's legacy
synchronous layout helper. The helper is also exposed as
`layoutFeynmanFallbackSync` for tests and emergency rendering fallback.

Edge rendering uses the same geometry helpers for straight and curved edges.
Curve options create cubic Bezier geometry; photons and gluons sample wave or
loop points along that geometry, while fermions and charged particles draw a
centered arrow glyph. Edge labels and momentum arrows sample the edge midpoint
and offset along the local normal.

## Manual Positions

Pin specific nodes with absolute SVG coordinates:

```feynman
options width=520 height=300
position a 80 150
position b 260 80
position c 260 220
position d 440 150
fermion a->b b->d
photon a->c c->d
label a:e^- d:e^+ b:\gamma c:Z
```

## Braces

Use `brace from->to[side]:label` to draw a grouping brace between two
positioned nodes. The supported sides are `left`, `right`, `top`, and `bottom`:

```feynman
position a1 80 120
position b1 80 200
brace b1->a1[left]:B^0
```

## Labels

Node labels use `node:text`:

```feynman
incoming q
outgoing q2
fermion q->v1 v1->q2
label q:q q2:q v1:V
```

Labels with spaces can be quoted:

```feynman
incoming i1
outgoing o1
fermion i1->v1 v1->o1
label i1:"incoming particle" o1:"outgoing particle"
```

Labels support a small TeX-like subset for common symbols and scripts. Use
`\mu`, `\gamma`, and other Greek symbol commands directly, plus `^` and `_` for
superscripts and subscripts. `\overline{...}` and `\bar{...}` are supported for
anti-particle labels. Braces group multi-character scripts:

```feynman
incoming e positron
outgoing muon antimuon
fermion e->v1 positron->v1 v1->muon v1->antimuon
label e:e^- positron:e^+ muon:\mu^- antimuon:\mu^+ v1:\gamma
```

```feynman
incoming p1
outgoing p2
fermion p1->v1 v1->p2
label p1:p_{T} p2:m_{\mu}^{2}
```

Edge labels use `from->to:text`. For repeated edges with the same endpoints,
append a 1-based index such as `from->to#2:text`:

```feynman
incoming i1
outgoing o1
fermion i1->v1
photon v1->o1
label v1->o1:γ
```

## Comments

Blank lines and lines starting with `#` are ignored.
