from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_docs_configs_use_material_for_both_engines():
    properdocs = ROOT / "properdocs.yml"
    mkdocs = ROOT / "mkdocs.yml"
    properdocs_text = properdocs.read_text()
    mkdocs_text = mkdocs.read_text()

    assert properdocs.exists()
    assert mkdocs.exists()
    assert "feynman-diagrams" in properdocs_text
    assert "feynman-diagrams" in mkdocs_text
    assert "MkDocs and ProperDocs" in properdocs_text
    assert "name: material" in properdocs_text
    assert "name: material" in mkdocs_text
    assert "  - search" not in properdocs_text
    assert "  - search" in mkdocs_text
