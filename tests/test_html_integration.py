"""Exercise the Python-Markdown recipe as written in the installation guide."""

import re
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1] / "docs" / "installation.md"


def test_python_markdown_recipe(tmp_path, monkeypatch):
    docs = DOCS.read_text(encoding="utf-8")
    recipe = re.search(r"````python\n(from pathlib import Path\n.*?)````", docs, flags=re.S)
    assert recipe is not None
    monkeypatch.chdir(tmp_path)
    exec(recipe[1], {})
    html = (tmp_path / "index.html").read_text(encoding="utf-8")
    assert '<pre><code class="language-feynman">incoming a\noutgoing b\nphoton a-&gt;b' in html
    assert '<script defer src="feynman-diagrams.js"></script>' in html
