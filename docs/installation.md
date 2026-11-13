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

### Python-Markdown and other HTML renderers

Any HTML page can render a `feynman` fence if its Markdown engine emits
`<pre><code class="language-feynman">…</code></pre>` and the page loads the
MarkFeyn bundle. Python-Markdown's `fenced_code` extension does this by default.

```sh
python -m pip install markfeyn Markdown
python -m markfeyn copy-asset feynman-diagrams.js
```

Save this as `build.py` and run `python build.py`. Open the generated
`index.html` alongside the copied bundle.

````python
from pathlib import Path

from markdown import markdown

source = """# Photon exchange

```feynman
incoming a
outgoing b
photon a->b
label a:e^- b:e^- a->b:\\gamma
```
"""

body = markdown(source, extensions=["fenced_code"])
Path("index.html").write_text(
    '<!doctype html><meta charset="utf-8"><title>Photon exchange</title>'
    '<script defer src="feynman-diagrams.js"></script>'
    f"<main id='content'>{body}</main>",
    encoding="utf-8",
)
````

If your application inserts Markdown-generated HTML after page load, call
`renderAll` on the container after updating it. Load the bundle before this
code runs and pass HTML from a trusted source or your application's sanitizer.

```javascript
function showRenderedMarkdown(container, html) {
  container.innerHTML = html;
  FeynmanDiagrams.renderAll(container);
}
```

If a syntax highlighter takes over unknown code languages, configure it to
preserve `language-feynman` on the `code` or `pre` element and leave the
diagram source intact.

## Export a standalone SVG

For a source checkout, run `npm ci` and `npm run build:js` before installing
MarkFeyn. Put Node.js 22 or newer on `PATH`. The export command
uses the renderer and MathJax bundled in the Python package, so it runs
offline without a browser or an npm install.

Save one diagram's source in `diagram.feynman` without the Markdown fences.

```sh
markfeyn render diagram.feynman -o diagram.svg
python -m markfeyn render - < diagram.feynman > diagram.svg
```

Use `-` as the input path to read stdin. SVG goes to stdout unless you pass
`-o`. Invalid diagram source or math labels produce a diagnostic on stderr
and a nonzero exit status. Embed the resulting file in Markdown as
`![Photon exchange](diagram.svg)`.
