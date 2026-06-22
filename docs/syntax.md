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

External nodes are declared with `incoming` and `outgoing`:

```feynman
incoming e positron
outgoing muon antimuon
fermion e->v1 v1->muon
fermion positron->v1 v1->antimuon
label e:e⁻ positron:e⁺ muon:μ⁻ antimuon:μ⁺
```

Internal vertices do not need separate declarations. Any node used in an edge that is not listed as incoming or outgoing is treated as an internal vertex.

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
sides of the edge:

```feynman
photon a->b[edge label=\gamma]
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
| Layout algorithms | Uses built-in `spring`, `spring-electrical`, `layered`, and `tree` heuristics; these are not TikZ graph drawing algorithms and will not produce identical node placement. |
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
LuaTeX. MarkFeyn does not embed or port those algorithms; it implements small
deterministic browser-side layout routines tuned for common documentation
diagrams.

| Concept | TikZ-Feynman / PGF | MarkFeyn |
| --- | --- | --- |
| Automatic placement backend | TikZ-Feynman is a wrapper around TikZ `\graph` and PGF graphdrawing. Automatic placement requires LuaTeX; without it, TikZ-Feynman falls back to a rudimentary mode and warns. | Uses JavaScript functions bundled with MarkFeyn; no TeX, LuaTeX, PGF, or external graph layout backend is involved. |
| Default layout | `\feynmandiagram` and non-starred `\diagram` inject TikZ's `spring layout`. Starred `\diagram*` does not inject the automatic layout and is intended for manually placed vertices. | `layout spring` is the default for every diagram unless the source selects another MarkFeyn layout. |
| Spring layout | PGF's `spring layout` selects Hu's 2006 spring layout. The implementation supports fixed `desired at` nodes, graph-distance forces, adaptive step length, convergence tolerance, and optional multilevel coarsening. | Starts from MarkFeyn's `layered` result, pins external and manually positioned nodes, then runs 90 fixed iterations of pairwise repulsion plus edge-length springs. |
| Spring-electrical layout | PGF's `spring electrical layout` selects a separate Hu 2006 electrical algorithm. It supports per-node `electric charge`, a spring constant, optional quadtree approximation for remote repulsive forces, adaptive convergence, and optional coarsening. | Uses the same implementation as `spring`, but with a larger repulsion coefficient. It has no per-node charge model, quadtree approximation, or adaptive convergence. |
| Layered layout | PGF's `layered layout` is the modular Sugiyama method: cycle removal, layer assignment, crossing minimization, node positioning, and edge routing. Its default node ranking uses a network-simplex implementation, and its default crossing minimization uses weighted-median sweeps. | `layered` is a lightweight depth heuristic: external nodes are fixed on terminal layers, internal depth is propagated from incoming edges, and same-layer nodes are spaced apart. It does not run cycle removal, dummy-node routing, network simplex ranking, or crossing minimization. |
| Tree layout | PGF's `tree layout` uses the Reingold-Tilford algorithm on a tree or spanning tree, with subtree contour spacing and options for missing children. | `tree` builds parent-child relationships from MarkFeyn edges, assigns recursive subtree slots, and keeps declared outgoing nodes on the terminal side. |
| Manual placement | TikZ accepts coordinates, relative positioning, scopes, transforms, and TeX dimensions. | `position node x y` pins absolute SVG coordinates only. These pinned nodes are respected by all MarkFeyn layouts. |
| Invisible edges | TikZ-Feynman recommends `draw=none` edges because PGF layout still treats them as edges, while the drawing pass skips them. | `invisible` and `hidden` edges are kept in most layout calculations and skipped by the SVG renderer. |
| Edge paths | TikZ-Feynman draws particle lines through PGF styles, postactions, and decorations. Photons use a custom `complete sines` decoration, gluons use PGF's `coil` decoration, and momentum arrows use path-construction decorations. | MarkFeyn converts each edge to a straight line or cubic Bezier, then samples that geometry for photon waves, gluon loops, labels, and momentum arrows. |
| Determinism | PGF's force layouts use algorithm parameters such as random initial layouts, convergence tolerances, cooling, and optional coarsening, so exact placement is PGF-engine behavior rather than TikZ-Feynman code. | MarkFeyn uses fixed defaults and fixed iteration counts, so the same source should produce the same browser SVG across documentation builds. |

### Compatible JavaScript Layouts

MarkFeyn can use a JavaScript implementation of a graph layout algorithm as
long as it can preserve the renderer's graph contract:

- Manual `position` values must be treated as pinned nodes.
- Hidden and invisible edges must remain available to the layout backend, even
  though they are skipped by SVG rendering.
- `incoming` and `outgoing` nodes must be expressible as terminal-side
  constraints, or converted to fixed/pinned coordinates before layout.
- The backend must return stable node coordinates in SVG units; MarkFeyn still
  owns particle edge drawing, labels, braces, and momentum arrows.
- Orientation must be normalized after layout if the backend uses TikZ-style
  pair alignment rather than MarkFeyn's terminal-side model.

ELK.js or another Sugiyama-style implementation is the closest match for a
more TikZ-like `layered` layout. A force library can be used for `spring`, but
it should be treated as a compatible force layout rather than an exact copy of
PGF's Hu implementation unless it exposes the same force model, pinning,
coarsening, convergence, and charge controls.

### TikZ-Feynman Initial Settings

TikZ-Feynman does not have `incoming` or `outgoing` declarations. Its automatic
orientation keys work after graph layout by rotating, and optionally flipping,
the completed graph:

| TikZ-Feynman key | PGF orientation meaning |
| --- | --- |
| `horizontal=a to b` | Shorthand for `orient tail=a`, `orient head=b`, and `orient=0`; the line from `a` to `b` is aligned with the positive x-axis. |
| `horizontal'=a to b` | Same line alignment as `horizontal`, with the rest of the graph flipped across that line. |
| `vertical=a to b` | Shorthand for `orient tail=a`, `orient head=b`, and `orient=-90`; the line from `a` to `b` is aligned vertically. |
| `vertical'=a to b` | Same line alignment as `vertical`, with the rest of the graph flipped across that line. |

MarkFeyn's `orientation` command is different. It places declared external
nodes on terminal sides before layout: `horizontal` places incoming nodes on
the left and outgoing nodes on the right, while `horizontal-reverse` swaps those
sides. `vertical` and `vertical-reverse` keep the same terminal-side idea but
use a taller canvas and encourage internal vertices to stack vertically. They
are not direct aliases for TikZ-Feynman's `vertical=a to b` post-layout
rotation.

TikZ-Feynman's size presets also seed PGF graphdrawing distances:

| TikZ-Feynman size | `node distance` | graphdrawing `node distance` | `level distance` | `sibling distance` |
| --- | --- | --- | --- | --- |
| `small` | `1cm` | `1.25cm` | `1cm` | `1.5cm` |
| `medium` | `1.5cm` | `1.9cm` | `1.5cm` | `2.25cm` |
| `large` | `2cm` | `2.5cm` | `2cm` | `3cm` |

MarkFeyn size presets are SVG-pixel viewBox defaults instead. The current
presets are `small` at `420 x 280`, `medium` at `520 x 330`, and `large` at
`760 x 480`, with separate margins and external-node gaps. A future JS layout
backend should translate MarkFeyn's pixel presets into the backend's spacing
options rather than assuming TikZ's centimeter-based defaults.

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
   incoming nodes, outgoing nodes, edges, labels, braces, manual positions,
   vertex shapes, options, and parse errors.
2. `layoutFeynman` merges defaults, diagram options, and caller options, then
   dispatches to the selected automatic layout.
3. `renderFeynmanElement` draws the positioned graph as SVG paths, markers,
   labels, vertex shapes, and braces. Parse errors are kept visible in a
   caption instead of failing silently.

The automatic layouts share the same coordinate model. Incoming nodes are placed
on one terminal side, outgoing nodes on the opposite terminal side, and the
orientation option controls which side is considered the start or end. Manual
`position` commands are applied before automatic layout and remain pinned.
Hidden or invisible edges still participate in layout, but are skipped by the
SVG renderer.

Layout implementations:

| Layout | Implementation |
| --- | --- |
| `layered` | Places external nodes on terminal layers, computes internal node layers by propagating depth from incoming edges, estimates each internal node's cross-axis position from fixed neighbors, then distributes nodes in each layer with a minimum gap. This is the most deterministic layout. |
| `tree` | Builds parent-child relationships from edge direction, preferring incoming nodes as roots and outgoing nodes as leaves. A recursive subtree pass assigns depths and slots, centering parents over their children and placing declared outgoing nodes on the terminal side. |
| `spring` | Starts from the `layered` result, pins external and manually positioned nodes, then runs a fixed force-directed pass with pairwise repulsion and edge-length springs. Positions are clamped inside the SVG margins, with extra terminal spacing for internal nodes. |
| `spring-electrical` | Uses the same force-directed implementation as `spring`, but doubles the repulsion coefficient so connected internal vertices spread apart more aggressively. |

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
