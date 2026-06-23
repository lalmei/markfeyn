# Syntax

A diagram is written as a fenced code block tagged with `feynman`:

````markdown
```feynman
fermion i1->v1 v2->o1
photon v1->v2
fermion i2->v1 v2->o2
label i1:e⁻ i2:e⁺ o1:μ⁻ o2:μ⁺ v1->v2:γ
```
````

## Nodes

External nodes are inferred from visible degree-1 endpoints. A terminal that
appears as the source of its only visible edge is treated as incoming; a
terminal that appears as the target of its only visible edge is treated as
outgoing:

```feynman
fermion e->v1 v1->muon
fermion positron->v1 v1->antimuon
label e:e⁻ positron:e⁺ muon:μ⁻ antimuon:μ⁺
```

Use `incoming` and `outgoing` when you want to override inference or set an
explicit terminal order:

```feynman
incoming positron e
outgoing antimuon muon
fermion e->v1 v1->muon
fermion positron->v1 v1->antimuon
label e:e⁻ positron:e⁺ muon:μ⁻ antimuon:μ⁺
```

Internal vertices do not need separate declarations. Any node used in a visible
edge with degree greater than one, or any node not inferred or declared as a
terminal, is treated as an internal vertex.

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
| Labels | Supports a small TeX-like label subset for common symbols, scripts, and overlines; arbitrary LaTeX math is not typeset. |
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
| Layered layout | PGF's `layered layout` is the modular Sugiyama method: cycle removal, layer assignment, crossing minimization, node positioning, and edge routing. Its default node ranking uses a network-simplex implementation, and its default crossing minimization uses weighted-median sweeps. | Uses ELK `layered`, with inferred or declared incoming nodes constrained to the first layer and outgoing nodes to the last layer before MarkFeyn terminal-side normalization. |
| Tree layout | PGF's `tree layout` uses the Reingold-Tilford algorithm on a tree or spanning tree, with subtree contour spacing and options for missing children. | Uses ELK `mrtree`, preserving declared external sides and manual positions. Tree layout does not infer degree-1 terminals automatically. |
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
- External nodes are placed on terminal sides after ELK normalization.
- Single visible terminal legs are kept straight where possible by matching the
  terminal node's cross-axis coordinate to its adjacent internal node.

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

MarkFeyn's `orientation` command is different. It places inferred or declared
external nodes on terminal sides before layout: `horizontal` places incoming
nodes on the left and outgoing nodes on the right, while `horizontal-reverse`
swaps those sides. `vertical` and `vertical-reverse` keep the same terminal-side
idea but use a taller canvas and encourage internal vertices to stack
vertically.

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
2. `layoutFeynman` returns a promise. It infers missing spring/layered terminal
   classifications from visible degree-1 endpoints, merges defaults, diagram
   options, and caller options, sends the graph to ELK, then normalizes the
   result into the selected viewBox.
3. `renderFeynmanElement` draws the positioned graph as SVG paths, markers,
   labels, vertex shapes, and braces. Parse errors are kept visible in a
   caption instead of failing silently.

The automatic layouts share the same coordinate model. Inferred or declared
incoming nodes are placed on one terminal side, outgoing nodes on the opposite
terminal side, and the orientation option controls which side is considered the
start or end. Manual `position` commands are reapplied after automatic layout
and post-layout orientation, so absolute coordinates always win.
Hidden or invisible edges still participate in layout, but are skipped by the
SVG renderer.

After ELK returns coordinates, MarkFeyn applies a small normalization layer to
match common Feynman-diagram expectations:

- Spring and layered layouts infer external terminals from visible degree-1
  endpoints when `incoming` and `outgoing` are omitted.
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
| `layered` | ELK `layered`, with inferred or declared incoming nodes constrained to the first layer and outgoing nodes constrained to the last layer where applicable. |
| `tree` | ELK `mrtree`, preserving declared external sides and manual positions without automatic terminal inference. |
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
