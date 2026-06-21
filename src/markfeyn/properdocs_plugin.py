from __future__ import annotations

from properdocs.config import config_options
from properdocs.plugins import BasePlugin

from .core import DEFAULT_SCRIPT_PATH, configure_javascript, copy_renderer_asset


class FeynmanDiagramsPlugin(BasePlugin):
    """Bundle and inject the MarkFeyn browser renderer into ProperDocs sites."""

    config_scheme = (
        ("script_path", config_options.Type(str, default=DEFAULT_SCRIPT_PATH)),
    )

    def on_config(self, config, **kwargs):
        return configure_javascript(config, self.config)

    def on_post_build(self, config, **kwargs):
        copy_renderer_asset(config, self.config)
