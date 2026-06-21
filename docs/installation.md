# Installation

Install the package into the same environment as MkDocs or ProperDocs:

```bash
uv add markfeyn
```

This installs both supported documentation engines as runtime dependencies. Install Material for MkDocs when using the Material theme:

```bash
uv add mkdocs-material
```

For local development from this repository:

```bash
uv sync --group dev
```

## MkDocs

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

## ProperDocs

Enable the same plugin in `properdocs.yml`:

```yaml
theme:
  name: material

plugins:
  - feynman-diagrams

markdown_extensions:
  - fenced_code
```

The plugin adds this generated site asset automatically:

For ProperDocs with `theme: material`, do not add `search` explicitly; Material's `search` plugin is MkDocs-only.

```text
assets/javascripts/feynman-diagrams.js
```

To use a different output path:

```yaml
plugins:
  - search
  - feynman-diagrams:
      script_path: javascripts/feynman-diagrams.js
```

`script_path` is interpreted relative to the generated site directory. Parent-directory traversal such as `../feynman.js` is rejected.

## Manual JavaScript Mode

If a project does not want to load a plugin, copy the renderer from:

```text
src/markfeyn/assets/feynman-diagrams.js
```

to:

```text
docs/javascripts/feynman-diagrams.js
```

Then configure MkDocs or ProperDocs:

```yaml
extra_javascript:
  - javascripts/feynman-diagrams.js

markdown_extensions:
  - fenced_code
```
