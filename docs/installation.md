# Installation

From a checkout of this repository, install MarkFeyn into your documentation
project by passing the checkout path to uv. Choose the extra for your engine.

```bash
uv add "/path/to/markfeyn[mkdocs]"
uv add "/path/to/markfeyn[properdocs]"
```

Omit the extra if the engine is already installed.

Install Material for MkDocs when using the Material theme:

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
  - pymdownx.highlight:
      anchor_linenums: true
      pygments_lang_class: true
  - pymdownx.superfences:
      custom_fences:
        - name: feynman
          class: language-feynman
          format: !!python/name:pymdownx.superfences.fence_code_format
```

## ProperDocs

Enable the same plugin in `properdocs.yml`:

```yaml
theme:
  name: material

plugins:
  - feynman-diagrams

markdown_extensions:
  - pymdownx.highlight:
      anchor_linenums: true
      pygments_lang_class: true
  - pymdownx.superfences:
      custom_fences:
        - name: feynman
          class: language-feynman
          format: !!python/name:pymdownx.superfences.fence_code_format
```

The plugin adds this generated site asset automatically:

For ProperDocs with `theme: material`, do not add `search` explicitly; Material's `search` plugin is MkDocs-only.

```text
assets/javascripts/feynman-diagrams.js
```

To use a different output path:

```yaml
plugins:
  - feynman-diagrams:
      script_path: javascripts/feynman-diagrams.js
```

`script_path` is interpreted relative to the generated site directory. Parent-directory traversal such as `../feynman.js` is rejected.

By default the plugin loads the renderer lazily: it injects a tiny loader script (`feynman-diagrams-loader.js`, written next to `script_path`) and the full renderer is only downloaded on pages that contain a `feynman` block. Set `lazy_load: false` to load the renderer on every page instead:

```yaml
plugins:
  - feynman-diagrams:
      lazy_load: false
```

## Manual JavaScript Mode

If a project does not want to load a plugin, copy the renderer. Manual mode loads the full renderer directly on every page:

```bash
python -m markfeyn copy-asset docs/javascripts/feynman-diagrams.js
```

(Source checkouts can also copy `src/markfeyn/assets/feynman-diagrams.js` directly.)

Then configure MkDocs or ProperDocs:

```yaml
extra_javascript:
  - javascripts/feynman-diagrams.js

markdown_extensions:
  - pymdownx.highlight:
      anchor_linenums: true
      pygments_lang_class: true
  - pymdownx.superfences:
      custom_fences:
        - name: feynman
          class: language-feynman
          format: !!python/name:pymdownx.superfences.fence_code_format
```
