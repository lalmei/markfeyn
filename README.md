# MarkFeyn

MarkFeyn renders fenced `feynman` code blocks as native SVG diagrams in MkDocs and ProperDocs.

## Installation

From PyPI:

```bash
uv add markfeyn
```

This installs both supported documentation engines as runtime dependencies so the same package exposes both plugin entry points. Install Material for MkDocs when using the Material theme:

```bash
uv add mkdocs-material
```

From a source checkout:

```bash
uv sync
```

For local development:

```bash
uv sync --group dev
```

## MkDocs Setup

Enable the plugin in `mkdocs.yml`:

```yaml
theme:
  name: material

plugins:
  - search
  - feynman-diagrams

markdown_extensions:
  - fenced_code
```

## ProperDocs Setup

Enable the same plugin in `properdocs.yml`:

```yaml
theme:
  name: material

plugins:
  - feynman-diagrams

markdown_extensions:
  - fenced_code
```

The plugin injects and copies the bundled browser renderer automatically. The Markdown parser stays lightweight because diagram parsing and SVG generation happen in the browser.

For ProperDocs with `theme: material`, do not add `search` explicitly; Material's `search` plugin is MkDocs-only.

To customize the emitted script path:

```yaml
plugins:
  - search
  - feynman-diagrams:
      script_path: assets/javascripts/feynman-diagrams.js
```

`script_path` is interpreted relative to the generated site directory. Parent-directory traversal such as `../feynman.js` is rejected.

## Syntax

````markdown
```feynman
incoming i1 i2
outgoing o1 o2
fermion i1->v1 v2->o1
photon v1->v2
gluon v2->v3
scalar i2->v2 v2->o2
label i1:e⁻ i2:e⁺ o1:μ⁻ o2:μ⁺ v1:γ
```
````

Supported particles:

- `fermion`: solid line with centered arrow
- `photon`: sinusoidal wave
- `gluon`: looped/cycloid path
- `scalar`: dashed line

Labels use `node:text`. Edge labels are also accepted with `from->to:text`.

## Manual JavaScript Setup

If you do not want to use a plugin, copy the bundled renderer from:

```text
src/markfeyn/assets/feynman-diagrams.js
```

to:

```text
docs/javascripts/feynman-diagrams.js
```

Then configure MkDocs or ProperDocs directly:

```yaml
extra_javascript:
  - javascripts/feynman-diagrams.js

markdown_extensions:
  - fenced_code
```

## Package Layout

```text
src/markfeyn/
  __init__.py
  core.py
  mkdocs_plugin.py
  properdocs_plugin.py
  assets/
    feynman-diagrams.js
```

The package exposes both plugin entry points:

```toml
[project.entry-points."mkdocs.plugins"]
feynman-diagrams = "markfeyn.mkdocs_plugin:FeynmanDiagramsPlugin"

[project.entry-points."properdocs.plugins"]
feynman-diagrams = "markfeyn.properdocs_plugin:FeynmanDiagramsPlugin"
```

## Verification

```bash
make test
make docs
make build
```

Serve docs locally:

```bash
make serve-properdocs
make serve-mkdocs
```

The serve targets use `localhost:8001` by default. Override with `DOCS_ADDR=localhost:8010` if that port is busy.

## Publishing

Build and publish to PyPI:

```bash
make publish
```

The publish targets upload only `dist/markfeyn-*` artifacts.

Publish to TestPyPI first:

```bash
make publish-test
```

`uv publish` reads credentials from the environment. For PyPI token auth, set:

```bash
export UV_PUBLISH_TOKEN="pypi-..."
```

## Design Choices

- Rendering happens in the browser, so MkDocs and ProperDocs builds remain static and fast.
- MkDocs and ProperDocs use separate adapter classes over the same core implementation.
- The script supports themes that expose Material-style instant loading through `document$.subscribe`.
- It falls back to `DOMContentLoaded` for standard static documentation themes.
- The browser renderer has no JavaScript runtime dependencies.
