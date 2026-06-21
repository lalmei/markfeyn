from importlib.metadata import entry_points

import pytest
from mkdocs.config.defaults import MkDocsConfig
from properdocs.config.defaults import ProperDocsConfig

from markfeyn.core import (
    DEFAULT_SCRIPT_PATH,
    normalize_script_path,
    read_bundled_asset,
)
from markfeyn.mkdocs_plugin import FeynmanDiagramsPlugin as MkDocsFeynmanDiagramsPlugin
from markfeyn.properdocs_plugin import (
    FeynmanDiagramsPlugin as ProperDocsFeynmanDiagramsPlugin,
)
from mkdocs_feynman_diagrams.plugin import (
    FeynmanDiagramsPlugin as LegacyMkDocsFeynmanDiagramsPlugin,
)
from properdocs_feynman_diagrams.plugin import (
    FeynmanDiagramsPlugin as LegacyProperDocsFeynmanDiagramsPlugin,
)


def test_normalize_script_path():
    assert normalize_script_path("/custom/feynman.js") == "custom/feynman.js"
    assert normalize_script_path("./custom/feynman.js") == "custom/feynman.js"
    assert normalize_script_path("custom\\feynman.js") == "custom/feynman.js"
    assert normalize_script_path("  ") == DEFAULT_SCRIPT_PATH
    assert normalize_script_path("docs/feynman.js") == "docs/feynman.js"


def test_normalize_script_path_rejects_directory_traversal():
    with pytest.raises(ValueError, match="site directory"):
        normalize_script_path("../feynman.js")


@pytest.mark.parametrize(
    ("plugin_class", "config_class"),
    [
        (MkDocsFeynmanDiagramsPlugin, MkDocsConfig),
        (ProperDocsFeynmanDiagramsPlugin, ProperDocsConfig),
    ],
)
def test_plugin_adds_extra_javascript_when_missing(plugin_class, config_class):
    plugin = plugin_class()
    plugin.load_config({})

    config = config_class()
    config["extra_javascript"] = []

    plugin.on_config(config)

    assert config["extra_javascript"] == [DEFAULT_SCRIPT_PATH]


@pytest.mark.parametrize(
    ("plugin_class", "config_class"),
    [
        (MkDocsFeynmanDiagramsPlugin, MkDocsConfig),
        (ProperDocsFeynmanDiagramsPlugin, ProperDocsConfig),
    ],
)
def test_plugin_does_not_duplicate_extra_javascript(plugin_class, config_class):
    plugin = plugin_class()
    plugin.load_config({})

    config = config_class()
    config["extra_javascript"] = [DEFAULT_SCRIPT_PATH]

    plugin.on_config(config)

    assert config["extra_javascript"] == [DEFAULT_SCRIPT_PATH]


@pytest.mark.parametrize(
    ("plugin_class", "config_class"),
    [
        (MkDocsFeynmanDiagramsPlugin, MkDocsConfig),
        (ProperDocsFeynmanDiagramsPlugin, ProperDocsConfig),
    ],
)
def test_plugin_respects_custom_script_path(tmp_path, plugin_class, config_class):
    plugin = plugin_class()
    plugin.load_config({"script_path": "/custom/feynman.js"})

    config = config_class()
    config["extra_javascript"] = []
    config["site_dir"] = str(tmp_path)

    plugin.on_config(config)
    plugin.on_post_build(config)

    assert config["extra_javascript"] == ["custom/feynman.js"]
    assert (tmp_path / "custom/feynman.js").read_bytes() == read_bundled_asset()


@pytest.mark.parametrize(
    ("plugin_class", "config_class"),
    [
        (MkDocsFeynmanDiagramsPlugin, MkDocsConfig),
        (ProperDocsFeynmanDiagramsPlugin, ProperDocsConfig),
    ],
)
def test_plugin_copies_bundled_asset_to_default_path(tmp_path, plugin_class, config_class):
    plugin = plugin_class()
    plugin.load_config({})

    config = config_class()
    config["site_dir"] = str(tmp_path)

    plugin.on_post_build(config)

    target = tmp_path / DEFAULT_SCRIPT_PATH
    assert target.exists()
    assert target.read_bytes() == read_bundled_asset()
    assert b"parseFeynman" in target.read_bytes()


@pytest.mark.parametrize(
    ("group", "plugin_class"),
    [
        ("mkdocs.plugins", MkDocsFeynmanDiagramsPlugin),
        ("properdocs.plugins", ProperDocsFeynmanDiagramsPlugin),
    ],
)
def test_plugin_entry_point_is_registered(group, plugin_class):
    plugins = entry_points(group=group)
    entry_point = next(item for item in plugins if item.name == "feynman-diagrams")

    assert entry_point.load() is plugin_class


def test_legacy_module_paths_still_resolve():
    assert LegacyMkDocsFeynmanDiagramsPlugin is MkDocsFeynmanDiagramsPlugin
    assert LegacyProperDocsFeynmanDiagramsPlugin is ProperDocsFeynmanDiagramsPlugin
