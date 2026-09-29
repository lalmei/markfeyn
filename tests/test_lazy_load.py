import pytest
from mkdocs.commands.build import build as mkdocs_build
from mkdocs.config import load_config as mkdocs_load_config
from properdocs.commands.build import build as properdocs_build
from properdocs.config import load_config as properdocs_load_config

ENGINES = [
    pytest.param(mkdocs_build, mkdocs_load_config, id="mkdocs"),
    pytest.param(properdocs_build, properdocs_load_config, id="properdocs"),
]


def build_site(tmp_path, build, load_config, plugin_options=""):
    docs_dir = tmp_path / "docs"
    site_dir = tmp_path / "site"
    docs_dir.mkdir()
    (docs_dir / "index.md").write_text("# Lazy\n", encoding="utf-8")
    config_file = tmp_path / "config.yml"
    config_file.write_text(
        f"""site_name: Lazy
docs_dir: {docs_dir}
site_dir: {site_dir}
theme:
  name: material
plugins:
  - feynman-diagrams:{plugin_options}
""",
        encoding="utf-8",
    )
    build(load_config(str(config_file)))
    return site_dir


@pytest.mark.parametrize(("build", "load_config"), ENGINES)
def test_lazy_load_is_default(tmp_path, build, load_config):
    site_dir = build_site(tmp_path, build, load_config)
    index = (site_dir / "index.html").read_text(encoding="utf-8")
    loader = (site_dir / "assets/javascripts/feynman-diagrams-loader.js").read_text(
        encoding="utf-8"
    )

    assert "assets/javascripts/feynman-diagrams-loader.js" in index
    assert "assets/javascripts/feynman-diagrams.js" not in index
    assert (site_dir / "assets/javascripts/feynman-diagrams.js").exists()
    assert "feynman-diagrams.js" in loader
    assert "__MARKFEYN_RENDERER_FILE__" not in loader


@pytest.mark.parametrize(("build", "load_config"), ENGINES)
def test_lazy_load_follows_custom_script_path(tmp_path, build, load_config):
    site_dir = build_site(
        tmp_path, build, load_config, "\n      script_path: js/fd.js"
    )
    index = (site_dir / "index.html").read_text(encoding="utf-8")
    loader = (site_dir / "js/feynman-diagrams-loader.js").read_text(encoding="utf-8")

    assert (site_dir / "js/fd.js").exists()
    assert "js/feynman-diagrams-loader.js" in index
    assert "js/fd.js" not in index
    assert '"fd.js"' in loader
    assert "__MARKFEYN_RENDERER_FILE__" not in loader


@pytest.mark.parametrize(("build", "load_config"), ENGINES)
def test_lazy_load_disabled_keeps_eager_behaviour(tmp_path, build, load_config):
    site_dir = build_site(tmp_path, build, load_config, "\n      lazy_load: false")
    index = (site_dir / "index.html").read_text(encoding="utf-8")

    assert "assets/javascripts/feynman-diagrams.js" in index
    assert "feynman-diagrams-loader.js" not in index
    assert not (site_dir / "assets/javascripts/feynman-diagrams-loader.js").exists()
