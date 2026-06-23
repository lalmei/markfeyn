You are working in an existing codebase that needs automatic layout of publication-quality Feynman diagrams using Eclipse Layout Kernel’s ELK Layered algorithm.

Your task is to design and implement a Feynman-aware layout system around ELK.

Do not begin by forking or modifying ELK internals. First implement the physics-aware behavior as a domain-specific layer consisting of:

1. a semantic Feynman graph model;
2. graph validation and topology analysis;
3. a compiler from the semantic graph into an ELK graph with appropriate ports, ordering, layer constraints, priorities, and layout hints;
4. ELK Layered invocation;
5. Feynman-specific postprocessing and geometric refinement;
6. candidate generation and scoring for ambiguous layouts;
7. deterministic tests and visual fixtures.

Inspect the repository before making architectural decisions. Reuse its language, graph representation, build system, test framework, and rendering abstractions.

If the repository has no established ELK integration, use TypeScript with `elkjs`.

# Primary objective

Generic layered layout optimizes graph-theoretic criteria such as crossings, edge lengths, and bends. It does not understand Feynman-diagram conventions.

The new layout system should produce diagrams that resemble what a theoretical physicist would conventionally draw in a paper.

It should understand conventions such as:

- incoming external particles usually appear on the left;
- outgoing external particles usually appear on the right;
- a known process direction should normally run left to right;
- if incoming and outgoing roles are not known, the layout should not invent them;
- when no reliable process direction exists, the diagram should be as symmetric as its topology permits;
- external states should lie on clean boundaries;
- interaction vertices should follow the causal or process topology when one is known;
- fermion arrows indicate fermion-number flow and must not determine layout direction by themselves;
- momentum flow, fermion flow, edge source/target order, and visual layout direction are distinct concepts;
- decay products should be ordered stably and symmetrically;
- loops should look like recognizable bubbles, triangles, boxes, polygons, or self-energy insertions;
- backward edges introduced by generic cycle breaking should not create visually arbitrary loop geometry;
- crossed propagators should be avoided unless required by topology;
- parallel propagators should be visibly separated;
- tadpoles and self-loops require dedicated geometry;
- momentum labels and particle labels require reserved space;
- production and decay subgraphs should remain visually grouped;
- graph automorphisms and repeated physical structures should lead to approximately symmetric layouts;
- small edits should not unnecessarily rearrange the full diagram;
- identical input and options must produce identical output.

The goal is not only to minimize crossings.

The objective is:

```text
physically conventional
+ topologically clear
+ symmetric where appropriate
+ deterministic
+ easy to render
+ compatible with ELK
```

# Important conceptual distinctions

Represent these independently in the domain model:

```ts
type LayoutDirection = "forward" | "backward" | "neutral" | "unspecified";

type MomentumDirection =
  | "source-to-target"
  | "target-to-source"
  | "unspecified";

type FermionFlow =
  | "source-to-target"
  | "target-to-source"
  | "none"
  | "unspecified";

type ExternalRole = "incoming" | "outgoing" | "unclassified" | "none";
```

Do not infer one directly from another.

For example, an antifermion may be laid out from left to right while its fermion arrow points from right to left.

Changing a fermion arrow must not mirror or reverse the entire layout.

# Domain model

Introduce or extend a typed semantic representation resembling:

```ts
interface FeynmanDiagram {
  id: string;
  vertices: FeynmanVertex[];
  propagators: Propagator[];
  process?: ProcessMetadata;
  layoutHints?: DiagramLayoutHints;
}

interface FeynmanVertex {
  id: string;

  kind:
    | "interaction"
    | "external"
    | "effective"
    | "counterterm"
    | "operatorInsertion"
    | "cut"
    | "auxiliary";

  externalRole?: ExternalRole;
  particle?: ParticleSpec;

  positionHint?: Point;
  fixed?: boolean;

  groupId?: string;
  metadata?: Record<string, unknown>;
}

interface Propagator {
  id: string;

  source: string;
  target: string;

  particle: ParticleSpec;

  style:
    | "fermion"
    | "antiFermion"
    | "photon"
    | "gluon"
    | "scalar"
    | "ghost"
    | "boson"
    | "plain";

  layoutDirection?: LayoutDirection;
  momentumDirection?: MomentumDirection;
  fermionFlow?: FermionFlow;

  momentumLabel?: string;
  particleLabel?: string;

  loopId?: string;

  preferredSide?: "above" | "below" | "left" | "right" | "inside" | "outside";

  routingHint?:
    | "straight"
    | "arc"
    | "loop"
    | "orthogonal"
    | "spline"
    | "automatic";

  metadata?: Record<string, unknown>;
}

interface ParticleSpec {
  name?: string;
  pdgId?: number;

  massClass?: "massless" | "massive" | "unknown";

  spinClass?: "scalar" | "fermion" | "vector" | "ghost" | "unknown";
}

interface ProcessMetadata {
  initialState?: string[];
  finalState?: string[];
  hardVertices?: string[];

  preferredFlow?:
    | "left-to-right"
    | "right-to-left"
    | "top-to-bottom"
    | "bottom-to-top"
    | "symmetric";
}

interface DiagramLayoutHints {
  topology?:
    | "auto"
    | "tree"
    | "decay"
    | "scattering"
    | "selfEnergy"
    | "vertexCorrection"
    | "triangle"
    | "box"
    | "polygonLoop"
    | "tadpole"
    | "multiLoop"
    | "vacuum";

  orientationMode?: "auto" | "process" | "symmetric" | "fixed";

  symmetryGroups?: string[][];
  sameLayerGroups?: string[][];

  orderingConstraints?: OrderingConstraint[];
  preferredExternalOrder?: string[];

  preservePreviousLayout?: boolean;
}
```

Adapt these names to the repository rather than duplicating equivalent types.

Validate all references and produce actionable errors for malformed input.

# High-level architecture

Implement the system as explicit stages:

```text
Feynman semantic graph
    ↓
validation
    ↓
topology analysis
    ↓
orientation analysis
    ↓
canonicalization
    ↓
external ordering
    ↓
ELK graph compilation
    ↓
ELK Layered
    ↓
geometry extraction
    ↓
Feynman-specific refinement
    ↓
candidate scoring and selection
    ↓
renderer-neutral layout result
```

Use small, testable modules.

A suggested organization is:

```text
src/
  feynman-layout/
    model.*
    validate.*
    graph-utils.*
    topology.*
    automorphisms.*
    orientation.*
    canonicalize.*
    external-order.*
    ports.*
    elk-compiler.*
    elk-options.*
    elk-runner.*
    layout.*
    refine.*
    loops.*
    labels.*
    symmetry.*
    score.*
    candidates.*
    geometry.*
    diagnostics.*
    types.*
```

Do not place all logic in a single layout function.

# Phase 1: validation

Validate:

- unique vertex IDs;
- unique propagator IDs;
- all source and target references exist;
- no malformed self-reference unless explicitly supported;
- external vertices have valid degree;
- fixed nodes have position hints;
- loop IDs reference real edges;
- symmetry and same-layer groups reference valid vertices;
- ordering constraints are consistent;
- process metadata references valid vertices;
- previous-layout references are compatible.

Return structured errors and warnings.

Do not silently repair ambiguous semantic input unless the behavior is explicitly documented.

# Phase 2: topology analysis

Before invoking ELK, classify the graph.

Detect at minimum:

- connected components;
- internal and external vertices;
- incoming, outgoing, and unclassified external states;
- articulation vertices;
- bridges;
- biconnected components;
- self-loops;
- parallel edges;
- simple cycles;
- a stable cycle basis;
- overlapping cycles;
- nested cycles;
- principal paths between external regions;
- repeated branches;
- structurally equivalent vertices and subgraphs;
- graph center or centers;
- graph diameter;
- common Feynman motifs.

Compute loop order where meaningful:

\[
L = E - V + C
\]

where \(C\) is the number of connected components of the relevant internal graph.

Recognize at least:

- tree or decay;
- \(1\to n\) decay;
- cascade decay;
- \(2\to n\) scattering;
- contact interaction;
- \(s\)-channel exchange;
- \(t\)-channel exchange;
- \(u\)-channel exchange;
- self-energy bubble;
- vertex-correction triangle;
- one-loop box;
- crossed box;
- generic one-loop polygon;
- tadpole;
- disconnected vacuum bubble;
- nested loops;
- overlapping loops;
- generic multi-loop graph.

Use graph topology, not propagator rendering style, to recognize motifs.

Return a structured object such as:

```ts
interface TopologyAnalysis {
  connectedComponents: string[][];
  externalVertices: string[];
  internalVertices: string[];

  cycles: CycleAnalysis[];
  biconnectedComponents: BiconnectedComponent[];

  articulationVertices: string[];
  bridges: string[];

  loopOrder?: number;

  detectedTopology:
    | "tree"
    | "decay"
    | "scattering"
    | "selfEnergy"
    | "triangle"
    | "box"
    | "polygonLoop"
    | "tadpole"
    | "multiLoop"
    | "vacuum"
    | "unknown";

  confidence: number;

  graphCenters: string[];
  repeatedStructures: RepeatedStructure[];
  inferredSymmetryGroups: string[][];
}
```

Keep the classification deterministic and explainable.

# Phase 3: orientation analysis

Determine whether a reliable process direction exists.

Use this evidence in priority order:

1. explicit incoming and outgoing external roles;
2. explicit process metadata;
3. explicit layout-direction hints;
4. fixed positions that imply an axis;
5. previous-layout orientation when incremental layout is enabled;
6. a clear directed process backbone inferred independently of fermion and momentum arrows.

Return:

```ts
interface OrientationAnalysis {
  mode: "process" | "symmetric" | "fixed";
  confidence: number;

  direction?: "RIGHT" | "LEFT" | "DOWN" | "UP";

  axis?: Vector;

  evidence: string[];
  ambiguities: string[];
}
```

## Process mode

Use process mode only when the evidence is sufficiently strong.

Default process convention:

- incoming external states occupy the west boundary;
- outgoing external states occupy the east boundary;
- internal interaction vertices occupy intermediate layers;
- the main process direction is left to right unless explicitly overridden.

Do not orient the graph using fermion arrows.

Construct a separate layout DAG where necessary.

For physical cycles, select temporary layout directions that preserve the principal process backbone while marking loop-closing edges separately.

Cycle breaking should prefer reversing, in order:

1. known loop-closing propagators;
2. neutral or unspecified layout edges;
3. edges marked as visually backward;
4. edges outside the principal process backbone;
5. internal secondary edges;
6. external legs only as a last resort.

Record every inferred or reversed layout edge in diagnostics.

## Symmetric mode

If incoming and outgoing roles are unknown, incomplete, or insufficiently reliable, do not invent a process direction.

Enter symmetric mode.

In symmetric mode:

- treat unclassified external states as equivalent unless metadata distinguishes them;
- identify graph automorphisms, repeated branches, and equivalent subgraphs;
- place the diagram around its structural center;
- maximize reflection, rotational, radial, or branch symmetry appropriate to the topology;
- minimize variation in equivalent edge lengths;
- minimize variation in equivalent branch angles;
- avoid arbitrary left-right asymmetry;
- do not assign incoming or outgoing semantics;
- do not use fermion arrows or momentum arrows to infer process direction;
- preserve declaration order only as a deterministic tie-breaker;
- prefer conventional topology-specific embeddings.

Suggested topology-specific symmetric embeddings:

- single contact vertex:
  evenly spaced external legs, or a balanced left-right arrangement;

- tree:
  balanced around the graph center or principal articulation vertex;

- decay-like tree with no known direction:
  identify a structural root only if one is topologically distinguished; otherwise use balanced radial or bilateral layout;

- bubble:
  equal upper and lower paths around a central axis;

- triangle:
  centered non-degenerate triangle;

- box:
  rectangle or balanced convex quadrilateral;

- polygon loop:
  approximately regular convex polygon;

- tadpole:
  compact loop placed on a deterministic preferred side;

- disconnected vacuum graph:
  centered radial or polygonal placement;

- repeated branches:
  mirrored or rotationally equivalent placement.

Symmetry is a soft objective, not an unconditional constraint.

Explicit fixed positions, explicit ordering, collision avoidance, labels, and topological clarity take precedence.

An asymmetric graph should remain asymmetric. The algorithm should avoid introducing arbitrary asymmetry, not force symmetry that the graph does not possess.

## Canonical orientation in symmetric mode

A symmetric graph may have rotational or reflection degeneracy.

Resolve it deterministically using:

1. fixed positions;
2. previous layout;
3. explicit ordering constraints;
4. stable vertex IDs;
5. declaration order;
6. canonical graph labeling;
7. a fixed rotation and reflection convention.

For example:

- place the smallest canonical external vertex in the upper-left or top-most allowed position;
- choose clockwise cycle ordering according to canonical vertex order;
- prefer horizontal major axis over vertical when both are equivalent;
- prefer the embedding with the smallest lexicographic coordinate signature after normalization.

Record the chosen convention in diagnostics.

# Phase 4: canonicalization

Create a canonical semantic representation before compiling to ELK.

Canonicalization should:

- normalize source and target ordering without changing physical meaning;
- maintain separate physical and layout directions;
- assign stable canonical indices;
- canonicalize cycle order;
- canonicalize repeated branch order;
- identify preferred principal paths;
- assign symmetry groups;
- preserve explicit user order when supplied;
- remain stable under repeated runs.

Do not rewrite fermion flow or momentum direction.

# Phase 5: external-state ordering

Create stable ordering for external legs.

Priority:

1. explicit `preferredExternalOrder`;
2. explicit ordering constraints;
3. prior layout order;
4. known process ordering;
5. user declaration order;
6. canonical graph order.

In process mode:

- incoming states should form a clean aligned boundary;
- outgoing states should form a clean aligned boundary;
- corresponding or symmetry-related states should align where appropriate.

For conventional \(2\to2\) scattering, prefer a balanced arrangement such as:

```text
incoming 1 ──────╲      ╱────── outgoing 1
                  ●────●
incoming 2 ──────╱      ╲────── outgoing 2
```

or the appropriate channel-specific variant.

In symmetric mode:

- distribute equivalent external legs evenly;
- use branch symmetry where possible;
- avoid arbitrary clustering on one side;
- use stable canonical ordering around the center.

# Phase 6: ELK graph compilation

Compile interaction vertices as ELK nodes.

Represent incident propagators with explicit ELK ports.

Use fixed port sides and fixed port ordering where necessary.

General port-side conventions in process mode:

- incoming process edges use WEST ports;
- outgoing process edges use EAST ports;
- upper loop branches prefer NORTH ports;
- lower loop branches prefer SOUTH ports;
- tadpoles use dedicated loop ports;
- parallel propagators use distinct ports;
- external legs use dedicated ports;
- labels should not share identical attachment geometry.

In symmetric mode:

- assign ports according to topology-specific angular sectors;
- preserve cyclic ordering around loop vertices;
- use NORTH, SOUTH, EAST, and WEST ports only as a coarse discretization;
- allow postprocessing to refine angular placement;
- do not assign WEST/EAST merely to imply incoming/outgoing roles.

Use ELK properties equivalent to:

```ts
{
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.portConstraints": "FIXED_ORDER",
  "elk.edgeRouting": "...",
  "elk.layered.layering.strategy": "...",
  "elk.layered.nodePlacement.strategy": "...",
  "elk.layered.considerModelOrder.strategy": "...",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "..."
}
```

Do not assume option names or enum values from memory.

Inspect the installed ELK or `elkjs` version and verify supported options.

Centralize all ELK option strings and enum values in one module.

Add comments explaining every non-default option.

Use ELK layer constraints for:

- incoming external states: first layer;
- outgoing external states: last layer;
- explicitly same-layer groups;
- operator insertions;
- cuts;
- loop-pair alignment;
- topology-specific upper and lower tracks;
- fixed interaction regions.

Use port order to preserve intended cyclic ordering around high-valence vertices.

Use edge priority or equivalent weighting so that:

- external legs remain straight;
- main process paths remain short and straight;
- loop-closing edges absorb bends;
- secondary propagators absorb more curvature;
- label-heavy edges receive additional clearance.

ELK should determine coarse placement.

Do not rely on ELK alone to generate final loop curves or publication-quality propagator paths.

# Phase 7: topology-specific constraint generators

Implement topology handlers as constraint generators and refiners.

Do not create completely separate renderers unless a topology cannot be handled robustly through ELK.

## Trees and decays

- use layered process flow when a root or process direction is known;
- otherwise use a balanced tree around the structural center;
- keep parent-child branches balanced;
- place equivalent siblings symmetrically;
- preserve explicit sibling order;
- minimize variation in equivalent branch lengths;
- avoid unnecessarily deep or wide layouts.

## Scattering diagrams

- place known incoming states on the left;
- place known outgoing states on the right;
- center the hard-scattering region;
- keep external legs straight where possible;
- preserve upper/lower channel conventions;
- prevent \(t\)- and \(u\)-channel structures from swapping arbitrarily;
- preserve crossing symmetry where applicable.

## Contact interactions

If process roles are known:

- align incoming and outgoing states on opposite boundaries.

If roles are unknown:

- distribute external legs evenly around the interaction vertex;
- use a balanced cross, radial arrangement, or bilateral arrangement;
- preserve explicit cyclic order;
- maximize angular separation.

## Self-energy bubbles

For two principal vertices connected by multiple internal propagators:

- place the principal vertices on a common axis;
- route one internal edge above and one below;
- preserve similar curvature;
- preserve similar path length when physically equivalent;
- keep external legs collinear when appropriate;
- separate all parallel propagators;
- place labels on opposite exterior sides.

If process direction is unknown:

- choose the principal axis deterministically;
- prefer horizontal orientation;
- preserve reflection symmetry across the axis.

## Triangle corrections

- preserve the three loop vertices as a non-degenerate triangle;
- do not collapse them into one layer;
- preserve cyclic adjacency;
- orient the triangle consistently with the process axis when known;
- otherwise use a centered canonical triangle;
- attach external legs without collapsing a side;
- place labels outside the loop by default.

## Boxes and polygon loops

- identify the ordered simple cycle;
- preserve cyclic adjacency;
- assign loop vertices to upper and lower tracks in process mode;
- produce a recognizable rectangle or convex polygon;
- do not let layered ranking collapse all loop vertices onto one line;
- preserve external attachment order;
- use deterministic clockwise ordering.

For a conventional one-loop box, prefer:

```text
external ──●────────●── external
            │        │
            │        │
external ──●────────●── external
```

or a slightly slanted convex variant.

If process direction is unknown:

- use a centered rectangle or approximately regular polygon;
- choose horizontal major axis deterministically;
- maximize reflection symmetry.

## Tadpoles

- keep the host process line straight when one exists;
- route the tadpole as a compact loop;
- place it on an explicitly preferred side when provided;
- otherwise choose a deterministic side using available free space;
- keep the label outside the loop;
- avoid intersection with the host vertex and nearby propagators.

## Multi-loop diagrams

- decompose the graph into biconnected loop regions;
- preserve the principal skeleton;
- assign loop regions separate sides or lanes;
- avoid arbitrary interleaving;
- preserve nested-loop containment where appropriate;
- preserve repeated-loop symmetry;
- generate bounded candidates where several embeddings are plausible;
- expose unresolved ambiguity through diagnostics.

## Vacuum diagrams

Do not force a left-to-right process interpretation.

Use:

- centered circular layout;
- regular polygon layout;
- radial layout;
- nested radial layout for multiple loops;
- balanced component packing.

# Phase 8: postprocessing and geometric refinement

After ELK returns coarse node coordinates, apply renderer-neutral Feynman refinement.

The refinement stage may:

- align external boundaries;
- straighten nearly horizontal or vertical external legs;
- center the interaction region;
- equalize equivalent branch lengths;
- symmetrize equivalent branches;
- symmetrize bubble geometry;
- convert coarse box layouts into balanced quadrilaterals;
- regularize polygon loops;
- separate parallel propagators;
- generate arc and spline control points;
- reserve label space;
- eliminate meaningless micro-bends;
- snap nearly aligned interaction vertices;
- enforce minimum spacing;
- normalize scale and margins;
- preserve fixed positions;
- preserve previous layout when requested.

Do not move nodes in ways that:

- create new crossings;
- violate fixed constraints;
- invert explicit ordering;
- collapse loops;
- break external boundaries;
- destroy a previously valid symmetry.

Represent routed propagators with a semantic path model:

```ts
type PropagatorPath =
  | {
      kind: "line";
      start: Point;
      end: Point;
    }
  | {
      kind: "polyline";
      points: Point[];
    }
  | {
      kind: "quadratic";
      start: Point;
      control: Point;
      end: Point;
    }
  | {
      kind: "cubic";
      start: Point;
      control1: Point;
      control2: Point;
      end: Point;
    }
  | {
      kind: "arc";
      start: Point;
      end: Point;
      center: Point;
      radius: number;
      clockwise: boolean;
    }
  | {
      kind: "closedLoop";
      center: Point;
      radiusX: number;
      radiusY: number;
      rotation: number;
    };
```

The renderer should later decorate the path as a fermion, photon, gluon, scalar, ghost, or other propagator.

# Phase 9: label placement

Momentum and particle labels are part of layout quality.

For each edge, generate label candidates using:

- local edge tangent;
- local normal;
- preferred side;
- loop interior versus exterior;
- free-space estimates;
- distance to nodes;
- distance to other labels;
- arrowhead position;
- conventional placement.

Conventions:

- labels on external legs should usually lie outside the interaction region;
- loop momentum labels should usually lie outside the loop;
- bubble labels should occupy opposite exterior sides;
- box and polygon labels should usually lie outside the polygon;
- labels must not overlap vertices, propagators, arrowheads, or other labels.

Implement an approximate label bounding-box provider.

Make the metric provider replaceable so exact font metrics can be added later.

Adding a label must not change graph topology or process semantics.

# Phase 10: symmetry

Support explicit and inferred symmetry.

Use graph automorphisms or safe structural equivalence detection to identify:

- equivalent external legs;
- equivalent branches;
- repeated subgraphs;
- mirrored loop paths;
- rotationally equivalent polygon vertices;
- equivalent decay products.

Define soft symmetry objectives such as:

- equal branch length;
- equal branch angle;
- mirrored coordinates;
- equal loop curvature;
- centered interaction region;
- equal external-leg length;
- balanced vertical or radial displacement;
- regular polygon spacing.

Do not allow inferred symmetry to override:

- explicit fixed positions;
- explicit ordering;
- explicit external roles;
- labels and collision constraints;
- prior layout preservation;
- topology clarity.

Symmetry should follow the graph’s real structure.

Do not make unrelated nodes symmetric merely because doing so looks balanced.

# Phase 11: candidate generation

ELK may produce a valid graph layout that is still a poor Feynman diagram.

For ambiguous graphs, generate a small deterministic candidate set by varying only meaningful choices:

- external-state ordering;
- loop above/below assignment;
- cycle-breaking edge;
- canonical reflection;
- canonical rotation;
- box or polygon orientation;
- port ordering;
- upper/lower channel assignment;
- node-placement strategy;
- layer-assignment strategy;
- previous-layout preservation strength.

Do not brute-force arbitrary permutations.

Candidate count must be bounded and configurable.

Suggested defaults:

```ts
fast: 1-2 candidates
balanced: 4-8 candidates
high: 8-24 candidates
```

Use stable enumeration order.

# Phase 12: candidate scoring

Score candidates using a weighted objective:

\[
S =
w_c C

- w_x X
- w_b B
- w_l L
- w*s S*{\mathrm{sym}}
- w*e E*{\mathrm{ext}}
- w_p P
- w_o O
- w_i I
- w_t T
- w_a A.
  \]

Include at least:

- \(C\): propagator crossings;
- \(X\): node-edge, node-label, edge-label, and label-label intersections;
- \(B\): unnecessary bends and excessive curvature;
- \(L\): normalized total edge length;
- \(S\_{\mathrm{sym}}\): deviation from expected structural symmetry;
- \(E\_{\mathrm{ext}}\): external-boundary misalignment and external-leg length variation;
- \(P\): parallel-edge overlap or insufficient separation;
- \(O\): deviation from explicit or canonical ordering;
- \(I\): instability relative to previous layout;
- \(T\): topology recognizability penalty;
- \(A\): angular imbalance for equivalent branches.

Examples of topology recognizability penalties:

- degenerate triangle;
- collapsed box;
- self-energy bubble drawn as overlapping lines;
- polygon loop with self-intersection;
- tadpole intersecting the host line;
- equivalent decay branches placed on the same side;
- vacuum diagram forced into an arbitrary process direction.

Create named scoring weights with documented defaults.

Return a detailed score breakdown.

Hard invalidity must be separate from soft scoring.

Reject candidates with:

- node overlap;
- non-finite coordinates;
- missing vertices or edges;
- invalid port references;
- broken fixed-position constraints;
- external states on the wrong explicit boundary;
- collapsed required loops;
- self-intersecting loop polygons where not intended;
- loop paths passing through unrelated vertices;
- zero-area triangle or box;
- duplicate propagator paths that should be separated.

# Phase 13: incremental stability

When a previous layout is supplied:

- use previous node coordinates as hints;
- preserve external ordering;
- preserve loop orientation;
- preserve clockwise cycle order;
- preserve upper/lower branch assignment;
- preserve symmetric mode versus process mode unless semantics changed;
- minimize displacement for unchanged nodes;
- avoid reflecting or rotating the full graph after a local edit;
- preserve label side where possible.

Include a displacement term:

\[
I =
\frac{1}{|V*{\mathrm{shared}}|}
\sum*{v\in V\_{\mathrm{shared}}}
\left\|
x_v^{\mathrm{new}}

- x_v^{\mathrm{old}}
  \right\|^2.
  \]

Normalize translation and global scale before comparison.

Optionally evaluate reflection and rotation equivalence only when the prior layout had no fixed orientation.

# Public API

Expose a small API resembling:

```ts
interface FeynmanLayoutOptions {
  orientationMode?: "auto" | "process" | "symmetric" | "fixed";

  direction?: "RIGHT" | "LEFT" | "DOWN" | "UP";

  topology?: DiagramLayoutHints["topology"];

  quality?: "fast" | "balanced" | "high";

  deterministicSeed?: number;

  preservePreviousLayout?: boolean;
  previousLayout?: FeynmanLayoutResult;

  elkOptions?: Record<string, string>;

  scoringWeights?: Partial<FeynmanScoringWeights>;

  debug?: boolean;
}

interface FeynmanLayoutResult {
  width: number;
  height: number;

  vertices: Record<string, PositionedVertex>;
  propagators: Record<string, PositionedPropagator>;
  labels: PositionedLabel[];

  analysis: {
    topology: TopologyAnalysis;
    orientation: OrientationAnalysis;
  };

  score: LayoutScore;
  diagnostics: LayoutDiagnostic[];

  debug?: FeynmanLayoutDebugData;
}

async function layoutFeynmanDiagram(
  diagram: FeynmanDiagram,
  options?: FeynmanLayoutOptions,
): Promise<FeynmanLayoutResult>;
```

Keep ELK-specific types out of the public result where possible.

# Diagnostics

Provide structured diagnostics.

Examples:

```text
Detected topology: one-loop box
Topology confidence: 0.94
Orientation mode: symmetric
Reason: no incoming/outgoing metadata
Graph symmetry: reflection across horizontal axis
Canonical cycle order: v2, v5, v8, v3
ELK candidate count: 8
Selected candidate: 5
Selected orientation: horizontal major axis
Rejected candidate 2: box collapsed to one layer
Rejected candidate 4: label-edge collision
Final symmetry error: 0.031
```

Debug output should optionally include:

- validated semantic graph;
- topology analysis;
- graph automorphisms or equivalence groups;
- orientation evidence;
- canonical graph order;
- inferred layout directions;
- cycle-breaking decisions;
- generated ELK graph;
- exact ELK options;
- node and port assignments;
- candidate list;
- score tables;
- rejected-candidate reasons;
- pre-refinement geometry;
- final geometry.

# Tests

Add:

- unit tests;
- property-based tests where practical;
- deterministic snapshot tests;
- geometry assertions;
- visual regression fixtures.

Create fixtures for at least:

1. simple \(1\to2\) decay;
2. \(1\to3\) decay;
3. cascade decay;
4. \(2\to2\) contact interaction;
5. \(s\)-channel exchange;
6. \(t\)-channel exchange;
7. \(u\)-channel exchange;
8. self-energy bubble;
9. vertex-correction triangle;
10. one-loop box;
11. crossed box;
12. tadpole;
13. parallel propagators;
14. fermion line whose arrow opposes layout direction;
15. mixed fermion-photon diagram;
16. gluon loop;
17. operator insertion;
18. disconnected vacuum bubble;
19. two-loop nested topology;
20. overlapping two-loop topology;
21. diagram with labels on every propagator;
22. unlabeled four-point contact vertex with no incoming/outgoing roles;
23. unlabeled symmetric box with no process metadata;
24. asymmetric tree with no process metadata;
25. symmetric repeated-branch graph;
26. graph with previous-layout hints.

For each fixture, assert semantic properties rather than only pixel snapshots.

Examples:

- incoming vertices are left of internal vertices;
- outgoing vertices are right of internal vertices;
- external boundaries are aligned within tolerance;
- unclassified external vertices are not assigned invented incoming/outgoing roles;
- symmetric contact diagrams have balanced external-leg angles;
- equivalent branches have similar lengths;
- bubble paths occupy opposite sides;
- triangle area exceeds a minimum threshold;
- box forms a non-degenerate convex quadrilateral;
- polygon loop preserves cyclic order;
- no unrelated node lies inside an edge collision corridor;
- no label overlaps a node;
- parallel propagators remain separated;
- deterministic reruns produce identical coordinates within tolerance;
- changing a fermion arrow does not mirror the layout;
- changing momentum direction does not change coarse geometry;
- adding a label does not alter topology classification;
- incremental edits preserve unchanged regions;
- an asymmetric graph is not artificially forced into false symmetry;
- a symmetric graph does not acquire arbitrary asymmetry.

Generate SVG fixtures if the repository supports rendering.

# Implementation sequence

Work incrementally.

## Milestone 1

- inspect repository;
- document current graph and rendering architecture;
- identify installed ELK or `elkjs` version;
- add semantic graph model;
- add validation;
- add topology analysis;
- add orientation analysis;
- support process mode and symmetric mode;
- add a basic ELK compiler;
- support trees, decays, contact interactions, and simple scattering;
- add deterministic tests.

## Milestone 2

- add explicit ports;
- add stable external ordering;
- separate layout direction, momentum direction, and fermion flow;
- add self-energy bubble handling;
- add parallel-edge routing;
- add scoring;
- add structured diagnostics.

## Milestone 3

- add triangle, box, polygon-loop, tadpole, and vacuum handlers;
- add candidate generation;
- add symmetry refinement;
- add label placement (implemented as a post-layout bounding-box resolver; exact
  TeX/TikZ metrics and global label packing remain out of scope);
- add visual regression fixtures.

## Milestone 4

- add multi-loop decomposition;
- add nested and overlapping loop handling;
- add incremental stability;
- profile performance;
- document unresolved limitations;
- determine whether any custom ELK processor is actually necessary.

Do not attempt all milestones in one unreviewable change.

Complete the earliest coherent milestone supported by the current repository.

# Engineering constraints

- preserve backward compatibility unless clearly impossible;
- do not introduce global mutable state;
- keep output deterministic;
- do not use unseeded randomization;
- keep topology analysis independent of rendering;
- keep physics semantics independent of ELK types;
- centralize ELK options and version-sensitive behavior;
- avoid hard-coded coordinates except in explicit topology refinements;
- use tolerances rather than exact floating-point equality;
- add concise comments for non-obvious Feynman conventions;
- document behavior ELK cannot enforce directly;
- prefer composable constraints and scoring over unexplained special cases;
- never infer process direction from fermion flow alone;
- never infer incoming/outgoing roles merely from edge source and target order;
- never force a process axis when symmetric mode is more appropriate.

# Required first response before coding

Before modifying files, report:

1. the repository architecture relevant to graph layout;
2. the current graph model;
3. the renderer and path representation;
4. the installed ELK or `elkjs` version;
5. the existing tests and fixture system;
6. the proposed module boundaries;
7. the smallest useful milestone to implement first;
8. assumptions you need to make;
9. files you expect to add or modify;
10. risks or limitations in the first milestone.

Then implement the first milestone.

# Definition of done for the first milestone

The first milestone is complete only when:

- the semantic graph model distinguishes layout direction, momentum direction, and fermion flow;
- incoming, outgoing, and unclassified external states are represented separately;
- malformed graphs are validated;
- topology analysis distinguishes at least trees, contact interactions, and simple scattering;
- orientation analysis chooses process mode only when justified;
- unknown incoming/outgoing roles trigger symmetric mode;
- process-mode diagrams lay out left to right;
- symmetric-mode contact diagrams produce balanced layouts;
- no incoming/outgoing semantics are invented in symmetric mode;
- layout is deterministic;
- tests include:
  - one decay;
  - one \(2\to2\) process;
  - one symmetric unclassified contact diagram;
  - one asymmetric unclassified tree;
  - one antifermion whose arrow opposes layout direction;
- debug output shows:
  - topology classification;
  - orientation mode;
  - orientation evidence;
  - compiled ELK graph;
  - inferred ports and constraints;
- all existing and new tests pass;
- the architecture and known limitations are documented.
