from __future__ import annotations

from mkdocs.config import config_options
from mkdocs.plugins import BasePlugin

from .core import DEFAULT_SCRIPT_PATH, configure_javascript, copy_renderer_asset


class FeynmanDiagramsPlugin(BasePlugin):
    """Bundle and inject the MarkFeyn browser renderer into MkDocs sites."""

    config_scheme = (
        ("script_path", config_options.Type(str, default=DEFAULT_SCRIPT_PATH)),
    )

    def on_config(self, config):
        return configure_javascript(config, self.config)

    def on_post_build(self, config):
        copy_renderer_asset(config, self.config)
