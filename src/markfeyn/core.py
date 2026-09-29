from __future__ import annotations

from collections.abc import MutableMapping
from importlib import resources
from pathlib import Path, PurePosixPath

ASSET_NAME = "feynman-diagrams.js"
LOADER_NAME = "feynman-diagrams-loader.js"
RENDERER_PLACEHOLDER = "__MARKFEYN_RENDERER_FILE__"
DEFAULT_SCRIPT_PATH = "assets/javascripts/feynman-diagrams.js"


def configure_javascript(config: MutableMapping, plugin_config: MutableMapping) -> MutableMapping:
    script_path = normalize_script_path(plugin_config["script_path"])
    plugin_config["script_path"] = script_path

    entry = loader_path(script_path) if plugin_config.get("lazy_load", True) else script_path
    extra_javascript = [
        item for item in (config.get("extra_javascript", []) or []) if str(item) != script_path
    ]
    if entry not in [str(item) for item in extra_javascript]:
        extra_javascript.append(entry)

    config["extra_javascript"] = extra_javascript
    return config


def copy_renderer_asset(config: MutableMapping, plugin_config: MutableMapping) -> None:
    script_path = normalize_script_path(plugin_config["script_path"])
    target = Path(config["site_dir"]) / script_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(read_bundled_asset())

    if plugin_config.get("lazy_load", True):
        loader = Path(config["site_dir"]) / loader_path(script_path)
        loader.write_text(render_loader(script_path), encoding="utf-8")


def loader_path(script_path: str) -> str:
    return PurePosixPath(script_path).with_name(LOADER_NAME).as_posix()


def render_loader(script_path: str) -> str:
    return read_bundled_loader().replace(RENDERER_PLACEHOLDER, PurePosixPath(script_path).name)


def normalize_script_path(script_path: str) -> str:
    normalized = script_path.strip().replace("\\", "/")

    while normalized.startswith("./"):
        normalized = normalized[2:]

    normalized = normalized.lstrip("/")

    if not normalized:
        return DEFAULT_SCRIPT_PATH

    path = PurePosixPath(normalized)
    if any(part == ".." for part in path.parts):
        raise ValueError("script_path must stay within the generated site directory")

    return path.as_posix()


def read_bundled_asset() -> bytes:
    return resources.files("markfeyn").joinpath("assets", ASSET_NAME).read_bytes()


def read_bundled_loader() -> str:
    return resources.files("markfeyn").joinpath("assets", LOADER_NAME).read_text(encoding="utf-8")
