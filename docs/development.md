# Development

Install dependencies:

```bash
uv sync --group dev
npm install
```

The development dependency group includes `mkdocs-material`, which is used by both local MkDocs and ProperDocs documentation builds.
The npm dependencies bundle the browser renderer with ELK.js.

Build the JavaScript renderer:

```bash
make build-js
```

Run Python tests:

```bash
make test-py
```

Run JavaScript checks:

```bash
make test-js
```

Build both documentation variants:

```bash
make docs
```

Build one documentation engine:

```bash
make docs-mkdocs
make docs-properdocs
```

Serve documentation locally:

```bash
make serve-mkdocs
make serve-properdocs
```

The serve targets bind to `localhost:8001` by default to avoid the common `localhost:8000` collision. Override it when needed:

```bash
make serve-properdocs DOCS_ADDR=localhost:8010
make serve-mkdocs DOCS_ADDR=localhost:8011
```

Build distribution artifacts:

```bash
make build
```

Publish when release credentials are configured:

```bash
make publish
```

For TestPyPI:

```bash
make publish-test
```

`uv publish` reads credentials from the environment. For token auth, set `UV_PUBLISH_TOKEN`.

The publish targets upload only `dist/markfeyn-*` artifacts.

## Package Shape

```text
src/markfeyn/
  __init__.py
  core.py
  mkdocs_plugin.py
  properdocs_plugin.py
  renderer/
    feynman-diagrams.js
  assets/
    feynman-diagrams.js
```

The plugin entry points are declared in `pyproject.toml`:

```toml
[project.entry-points."mkdocs.plugins"]
feynman-diagrams = "markfeyn.mkdocs_plugin:FeynmanDiagramsPlugin"

[project.entry-points."properdocs.plugins"]
feynman-diagrams = "markfeyn.properdocs_plugin:FeynmanDiagramsPlugin"
```
