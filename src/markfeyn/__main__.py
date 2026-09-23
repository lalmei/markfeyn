"""CLI for MarkFeyn package utilities."""

from __future__ import annotations

import argparse
import sys
from importlib import resources
from pathlib import Path

from markfeyn import __version__
from markfeyn.core import ASSET_NAME, read_bundled_asset


def get_asset_path() -> str:
    """Return the filesystem path of the bundled asset.

    Returns a string representation of the asset path. Note that in zipped
    installs or other non-filesystem contexts, this may not be a real file path.
    """
    return str(resources.files("markfeyn").joinpath("assets", ASSET_NAME))


def copy_asset(dest: str) -> None:
    """Copy the bundled asset to the specified destination.

    If DEST is an existing directory, write feynman-diagrams.js inside it.
    Otherwise, treat DEST as a file path and create parent directories as needed.

    Args:
        dest: Destination path (file or directory).

    Raises:
        SystemExit: If writing fails.
    """
    dest_path = Path(dest)

    # If destination is an existing directory, write the asset inside it
    if dest_path.is_dir():
        target = dest_path / ASSET_NAME
    else:
        target = dest_path

    # Create parent directories
    target.parent.mkdir(parents=True, exist_ok=True)

    # Write the asset
    asset_bytes = read_bundled_asset()
    target.write_bytes(asset_bytes)

    # Print the path that was written
    print(str(target.resolve()))


def main(argv: list[str] | None = None) -> int:
    """Main CLI entry point.

    Args:
        argv: Command-line arguments (defaults to sys.argv[1:]).

    Returns:
        Exit code (0 for success, 2 for errors).
    """
    parser = argparse.ArgumentParser(
        prog="python -m markfeyn",
        description="MarkFeyn utility commands.",
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"markfeyn {__version__}",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # copy-asset subcommand
    copy_parser = subparsers.add_parser(
        "copy-asset",
        help="Copy the bundled Feynman diagram renderer asset to a destination.",
    )
    copy_parser.add_argument(
        "dest",
        help="Destination path (file path or existing directory).",
    )

    # asset-path subcommand
    subparsers.add_parser(
        "asset-path",
        help="Print the filesystem path of the bundled asset.",
    )

    try:
        args = parser.parse_args(argv)
    except SystemExit as e:
        return e.code if isinstance(e.code, int) else 2

    # Handle commands
    if args.command == "copy-asset":
        try:
            copy_asset(args.dest)
            return 0
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            return 2
    elif args.command == "asset-path":
        print(get_asset_path())
        return 0
    else:
        # No command specified
        parser.print_help()
        return 2


if __name__ == "__main__":
    sys.exit(main())
