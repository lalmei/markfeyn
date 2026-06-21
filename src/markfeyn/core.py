from __future__ import annotations

from importlib import resources
from pathlib import Path, PurePosixPath
from typing import MutableMapping


ASSET_NAME = "feynman-diagrams.js"
DEFAULT_SCRIPT_PATH = "assets/javascripts/feynman-diagrams.js"


def configure_javascript(config: MutableMapping, plugin_config: MutableMapping) -> MutableMapping:
    script_path = normalize_script_path(plugin_config["script_path"])
    plugin_config["script_path"] = script_path

    extra_javascript = list(config.get("extra_javascript", []) or [])
    if script_path not in [str(item) for item in extra_javascript]:
        extra_javascript.append(script_path)

    config["extra_javascript"] = extra_javascript
    return config


def copy_renderer_asset(config: MutableMapping, plugin_config: MutableMapping) -> None:
    script_path = normalize_script_path(plugin_config["script_path"])
    target = Path(config["site_dir"]) / script_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(read_bundled_asset())


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
