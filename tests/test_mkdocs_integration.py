from pathlib import Path

from mkdocs.commands.build import build
from mkdocs.config import load_config


def test_mkdocs_build_injects_and_copies_renderer(tmp_path):
    docs_dir = tmp_path / "docs"
    site_dir = tmp_path / "site"
    docs_dir.mkdir()
    (docs_dir / "index.md").write_text(
        """# Integration

```feynman
incoming i1
outgoing o1
fermion i1->v1 v1->o1
label i1:e⁻ o1:e⁻ v1:γ
```
""",
        encoding="utf-8",
    )
    config_file = tmp_path / "mkdocs.yml"
    config_file.write_text(
        f"""site_name: Integration
docs_dir: {docs_dir}
site_dir: {site_dir}
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
""",
        encoding="utf-8",
    )

    config = load_config(str(config_file))
    build(config)

    rendered_index = (site_dir / "index.html").read_text(encoding="utf-8")
    rendered_asset = site_dir / "assets/javascripts/feynman-diagrams.js"

    assert rendered_asset.exists()
    assert "assets/javascripts/feynman-diagrams.js" in rendered_index
    assert "language-feynman" in rendered_index
    assert "parseFeynman" in rendered_asset.read_text(encoding="utf-8")


def test_mkdocs_build_respects_custom_script_path(tmp_path):
    docs_dir = tmp_path / "docs"
    site_dir = tmp_path / "site"
    docs_dir.mkdir()
    (docs_dir / "index.md").write_text("# Custom path\n", encoding="utf-8")
    config_file = tmp_path / "mkdocs.yml"
    config_file.write_text(
        f"""site_name: Custom Path
docs_dir: {docs_dir}
site_dir: {site_dir}
theme:
  name: material
plugins:
  - search
  - feynman-diagrams:
      script_path: javascripts/markfeyn.js
markdown_extensions:
  - pymdownx.highlight:
      anchor_linenums: true
      pygments_lang_class: true
  - pymdownx.superfences:
      custom_fences:
        - name: feynman
          class: language-feynman
          format: !!python/name:pymdownx.superfences.fence_code_format
""",
        encoding="utf-8",
    )

    config = load_config(str(config_file))
    build(config)

    rendered_index = (site_dir / "index.html").read_text(encoding="utf-8")

    assert (site_dir / "javascripts/markfeyn.js").exists()
    assert "javascripts/markfeyn.js" in rendered_index
