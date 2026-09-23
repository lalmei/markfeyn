"""Tests for the MarkFeyn CLI."""

from __future__ import annotations

from markfeyn import __version__
from markfeyn.__main__ import main
from markfeyn.core import ASSET_NAME, read_bundled_asset


class TestCopyAsset:
    """Tests for the copy-asset subcommand."""

    def test_copy_asset_to_file_path(self, tmp_path, capsys):
        """Test copying asset to a file path."""
        dest = tmp_path / "output" / "feynman.js"

        result = main(["copy-asset", str(dest)])

        assert result == 0
        assert dest.exists()
        assert dest.read_bytes() == read_bundled_asset()

        # Check output contains the written path
        captured = capsys.readouterr()
        assert str(dest.resolve()) in captured.out

    def test_copy_asset_to_existing_directory(self, tmp_path, capsys):
        """Test copying asset to an existing directory."""
        dest_dir = tmp_path / "output"
        dest_dir.mkdir()

        result = main(["copy-asset", str(dest_dir)])

        assert result == 0
        target = dest_dir / ASSET_NAME
        assert target.exists()
        assert target.read_bytes() == read_bundled_asset()

        # Check output contains the written path with asset name
        captured = capsys.readouterr()
        assert str(target.resolve()) in captured.out

    def test_copy_asset_creates_parent_directories(self, tmp_path, capsys):
        """Test that parent directories are created."""
        dest = tmp_path / "a" / "b" / "c" / "feynman.js"

        result = main(["copy-asset", str(dest)])

        assert result == 0
        assert dest.exists()
        assert dest.read_bytes() == read_bundled_asset()

    def test_copy_asset_bytes_match(self, tmp_path):
        """Test that copied bytes match the bundled asset exactly."""
        dest = tmp_path / "test.js"

        main(["copy-asset", str(dest)])

        assert dest.read_bytes() == read_bundled_asset()


class TestAssetPath:
    """Tests for the asset-path subcommand."""

    def test_asset_path_prints_path(self, capsys):
        """Test that asset-path prints a path ending in feynman-diagrams.js."""
        result = main(["asset-path"])

        assert result == 0
        captured = capsys.readouterr()
        output = captured.out.strip()
        assert output.endswith(ASSET_NAME)
        assert len(output) > 0


class TestVersion:
    """Tests for the --version flag."""

    def test_version_flag(self, capsys):
        """Test that --version prints the version."""
        result = main(["--version"])

        # argparse exits with code 0 for --version
        assert result == 0
        captured = capsys.readouterr()
        assert __version__ in captured.out


class TestMainFunction:
    """Tests for the main function's callable interface."""

    def test_main_with_none_argv_prints_help(self, capsys):
        """Test that main(argv=None) with no args prints help."""
        result = main([])

        # Empty argv should print help and return non-zero
        assert result != 0
        captured = capsys.readouterr()
        # Help should be printed
        assert "usage:" in captured.out or "usage:" in captured.err

    def test_main_returns_zero_on_success(self, tmp_path):
        """Test that main returns 0 on successful command."""
        dest = tmp_path / "test.js"

        result = main(["copy-asset", str(dest)])

        assert result == 0

    def test_main_returns_error_code_on_failure(self):
        """Test that main returns error code on invalid command."""
        result = main(["invalid-command"])

        assert result == 2
