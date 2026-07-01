# MarkFeyn Project QA Review

## Findings

### P1 - Validation and layout diagnostics are invisible in normal rendered docs

- **References:** `src/markfeyn/renderer/render/svg-renderer.js:21`, `src/markfeyn/renderer/render/svg-renderer.js:74`, `src/markfeyn/renderer/layout/layout.js:37`, `src/markfeyn/renderer/layout/layout.js:127`, `src/markfeyn/renderer/layout/validate.js:42`, `src/markfeyn/renderer/layout-engine.js:24`
- **What is wrong:** MarkFeyn computes validation, topology, port, multiloop, label-placement, and score diagnostics, but the DOM renderer only displays `diagram.errors` from parsing or a thrown render error. Layout validation errors such as `Vertex "a" is declared both incoming and outgoing.` are present in `layout.diagnostics` but produce no visible message in the rendered figure. ELK failures are also caught and silently routed to fallback without preserving the original error as a user-visible diagnostic.
- **Why it matters:** Users reading MkDocs or ProperDocs output cannot diagnose semantic failures, topology limitations, fallback layout behavior, or physics-recognition warnings without manually calling the JS API. That undermines the otherwise strong diagnostics architecture and makes incorrect diagrams look successfully rendered.
- **Smallest likely fix:** Surface severe layout diagnostics in the rendered figure, at least validation errors and fallback events. Keep lower-level debug data opt-in, but expose enough text or `data-*` state for normal docs users and tests.
- **Guard:** Add a DOM-render test that renders an invalid role declaration and asserts the visible figure includes the validation error. Add a forced-ELK-failure/fallback test that asserts a fallback diagnostic is retained.

### P2 - Shipped syntax docs still read like milestone planning notes

- **References:** `docs/syntax.md:222`, `docs/syntax.md:263`, `docs/syntax.md:318`
- **What is wrong:** User-facing syntax docs use milestone language such as "Milestone 2 adds..." and "Milestones 3A, 3B, and 3D add...". The content is useful, but it mixes shipped behavior with implementation history.
- **Why it matters:** A user trying to learn the current DSL has to mentally separate roadmap history from current guarantees. It also conflicts with the otherwise clean separation where `.agents/` contains planning prompts and roadmap notes.
- **Smallest likely fix:** Rewrite those sections as current behavior contracts, move historical milestone context to `docs/development.md` or a changelog, and keep `.agents/` as the planning surface.
- **Guard:** Add a docs review/lint check or simple grep in CI that prevents "Milestone" language from reappearing in shipped user docs unless it is in an explicit history/changelog page.

### P2 - Manual JavaScript setup is documented as a source-checkout workflow

- **References:** `README.md:220`, `README.md:225`, `docs/installation.md:85`, `docs/installation.md:90`, `pyproject.toml:49`
- **What is wrong:** Manual JS docs tell users to copy `src/markfeyn/assets/feynman-diagrams.js`. That path exists in the repository, but installed package users normally interact with package data, not a `src/` checkout path. The package correctly declares `markfeyn = ["assets/*.js"]`, but the docs do not show a reliable installed-package extraction path.
- **Why it matters:** Users who install from PyPI and want manual JS mode may not know where the bundled asset lives or how to copy it without cloning the repository.
- **Smallest likely fix:** Add a documented package-data extraction command, or provide a tiny CLI such as `python -m markfeyn.copy_asset docs/javascripts/feynman-diagrams.js`.
- **Guard:** Add a package smoke test that builds or installs the wheel in a temporary environment and verifies the asset can be read through `importlib.resources`.

### P2 - Visual snapshots are narrower than the behavioral surface

- **References:** `tests/feynman-visual-snapshots.test.js:14`, `tests/feynman-visual-snapshots.test.js:125`, `tests/visual/fixtures/box-loop-labels.feynman:1`, `tests/feynman-diagrams.test.js:1221`, `tests/feynman-diagrams.test.js:3011`, `tests/feynman-diagrams.test.js:3090`
- **What is wrong:** The visual snapshot runner is sound and uses the generated bundle, but the fixture set has only seven SVG snapshots. Important current behaviors such as declared process ordering, Bhabha-style vertical ordering, Drell-Yan corridor normalization, contact-star symmetry, and representative docs examples are covered by coordinate assertions or parse/layout smoke tests rather than SVG snapshots.
- **Why it matters:** A rendering-layer change could preserve coordinates and pass the JS assertions while breaking labels, classes, marker order, overlay layering, accessible text, or final SVG shape for common physics diagrams.
- **Smallest likely fix:** Add focused visual fixtures for one declared process-order diagram, one vertical Bhabha/cyclic-order example, one Drell-Yan/corridor example, one contact-star example, and one docs-derived representative example.
- **Guard:** Keep `npm run test:visual` in `npm run test:js`, and require snapshots for new renderer surfaces that change SVG output.

### P3 - Package release contents are not verified from a built artifact

- **References:** `pyproject.toml:40`, `pyproject.toml:49`, `Makefile:67`, `tests/test_plugin.py:121`
- **What is wrong:** Source-tree tests verify entry points, compatibility shims, config behavior, and bundled asset reads, but the normal gate does not build a wheel/sdist and inspect or install it. The package metadata looks correct, but the test surface does not prove release artifacts contain the asset, license files, notices, and legacy shim packages.
- **Why it matters:** Packaging regressions are easy to miss because the source checkout can import files that a built wheel might omit.
- **Smallest likely fix:** Add a package artifact smoke test that builds into a temp directory, installs the wheel into an isolated environment, imports `markfeyn`, loads both plugin entry points, reads the bundled asset, and checks license/notice inclusion.
- **Guard:** Run that smoke test in CI or behind `make build`/release gates.

### P3 - Some renderer modules still carry high rewrite pressure

- **References:** `src/markfeyn/renderer/layout/score.js:4`, `src/markfeyn/renderer/layout/loop-candidates.js:15`, `src/markfeyn/renderer/layout/multiloop.js:50`, `src/markfeyn/renderer/layout/normalization.js:24`
- **What is wrong:** The renderer is much more modular than a single-file bundle, but several modules remain large and mixed-responsibility: `score.js` owns many unrelated score families, `loop-candidates.js` owns enumeration, placement, scoring summaries, and tie-breaks, `multiloop.js` owns analysis-facing diagnostics plus candidate placement, and `normalization.js` coordinates many order-sensitive post-layout passes.
- **Why it matters:** The current architecture is extendable, but these files concentrate regression risk. Hidden ordering dependencies in normalization and scoring are especially risky for physics-layout semantics.
- **Smallest likely fix:** Continue incremental facade-preserving splits: score families by domain, loop candidate enumeration vs placement vs summary, multiloop analysis vs placement, and named normalization phases with explicit pre/postconditions.
- **Guard:** Preserve the generated bundle public surface and keep source+bundle tests paired with every split.

## Project Map

MkDocs and ProperDocs load the same plugin name, `feynman-diagrams`, through separate entry points declared in `pyproject.toml`. Both adapters are thin wrappers around `markfeyn.core`: `configure_javascript` normalizes and injects `extra_javascript`, and `copy_renderer_asset` copies the packaged `assets/feynman-diagrams.js` into the generated site.

At build/runtime, fenced `feynman` blocks are left as highlighted code by `pymdownx.superfences`. In the browser, the bundled renderer finds `code.language-feynman` blocks, replaces each `<pre>` with a loading figure, parses the source with `parseFeynman`, computes a layout with `layoutFeynman`, and emits an SVG.

The renderer pipeline is: parser facade -> semantic model -> validation -> topology/fermion-flow analysis -> orientation and external ordering -> port and parallel-edge diagnostics -> strategy selection. Strategy selection uses custom analytic layouts for loop, multiloop, symmetric contact, symmetric unclassified, and tree cases before falling back to ELK-backed layered/force/tree placement. Finalization applies normalization, TikZ-style post-layout orientation, manual positions, label placement, scoring, diagnostics, and SVG rendering.

## Quality Assessment

- Package integration is healthy. `core.py` centralizes script path normalization, JS injection, and asset copying; MkDocs and ProperDocs wrappers share that behavior.
- The generated bundle is the real JS test surface. `npm run test:js` rebuilds `src/markfeyn/assets/feynman-diagrams.js`, checks syntax, runs the JS behavior suite, and runs visual snapshots.
- Physics/layout semantics are unusually well tested for this stage: explicit roles, unclassified endpoints, declared external order, fermion-flow conservation diagnostics, arrow/momentum independence, self-energy parallel arcs, one-loop candidate layouts, multiloops, contact stars, manual positions, label placement, and deterministic reruns all have JS assertions.
- Docs examples are part of the JS test surface: every fenced block under `docs/examples/*.md` is parsed and laid out.
- Documentation now includes a useful end-to-end architecture map in `docs/development.md`, plus clear TikZ-Feynman difference tables and current limitations in `docs/syntax.md`.

## Coverage Gaps

- DOM rendering does not surface layout diagnostics.
- Visual snapshots do not yet cover several high-value process and regression diagrams.
- Built wheel/sdist contents are not verified by the normal gate.
- Docs examples are parse/layout-smoked but not rendered as SVG snapshots.
- There is no automated comparison against upstream TikZ-Feynman behavior; MarkFeyn wisely documents approximation, but parity claims still depend on local knowledge and examples.
- The JS suite is comprehensive but monolithic, which makes gaps harder to see at review time.

## Known Limits

- MarkFeyn is TikZ-Feynman-inspired, not TikZ-compatible.
- ELK layouts are compatible graph-layout families, not pixel-identical PGF/TikZ layouts.
- Labels use estimated SVG boxes and optional MathJax, not TeX/TikZ font metrics.
- General higher-order multiloop optimization is intentionally bounded.
- Manual `position` coordinates are absolute SVG coordinates, not TikZ coordinate expressions.
- Exact publication-quality placement may still require manual positions or explicit curves.

## Rewrite Pressure

Incremental extension is still the right path. The package/plugin boundary, parser facade, semantic model, topology facade, and renderer entrypoint are healthy enough to extend without a wholesale rewrite.

Rewrite pressure is concentrated in scoring, loop/multiloop candidate placement, and post-layout normalization. Those areas should be split only behind existing facades and with the current regression gates, because they encode important compatibility behavior: declared boundary order, unclassified endpoint preservation, fermion/momentum layout independence, and deterministic loop placement.

Deferred rewrite ideas: replacing the layout engine wholesale, making a literal TikZ/PGF port, or introducing a new renderer API by default. Compatibility risk is higher than payoff unless a concrete class of diagrams cannot be supported by the current architecture.

## Verification Results

- `but status -fv` - passed. Initial workspace had active branches `leo/label-placement-module-split` and `leo/project-qa-prompts`, plus pre-existing uncommitted `.agents/label-placement-module-split-qa.md`; I did not modify that file.
- `but diff` - passed. Confirmed the only initial uncommitted file was `.agents/label-placement-module-split-qa.md`.
- `npm run test:js` - passed. Rebuilt bundle, ran JS behavior tests, and passed 7 visual snapshots.
- `uv run --group dev pytest` - passed. 18 Python tests passed.
- `make docs` - passed. Built ProperDocs and MkDocs strictly after rebuilding the bundle.
- `git diff --check` - passed with no whitespace errors.
- `node -e "console.log(Object.keys(require('./src/markfeyn/assets/feynman-diagrams.js')).sort().join('\n'))"` - passed. Bundle public keys were:

```text
braceGeometry
doubleLinePath
doubleLinePathForEdge
edgeLabelPosition
edgePath
gluonPath
gluonPathForEdge
junctionCapNodes
labelMarkupToText
labelNeedsMathJax
labelSegmentText
layoutFeynman
layoutFeynmanFallbackSync
materializePendingMathLabels
mathJaxDisplayFontSize
momentumArrowGeometry
parseFeynman
parseLabelMarkup
parseMathJaxSvgLength
renderAll
squarePath
squarePathForEdge
trianglePath
trianglePathForEdge
visualDefaults
wavePath
wavePathForEdge
```

## Residual Risk

- I did not run a wheel/sdist build-and-install smoke test; package artifact contents are inferred from metadata and source-tree tests.
- I did not perform a fresh upstream TikZ-Feynman source audit; TikZ comparison is based on current repo docs and local behavior.
- I did not inspect every renderer module line-by-line; review drilled into facades and high-risk modules surfaced by the architecture and tests.
