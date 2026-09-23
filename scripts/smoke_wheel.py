"""Smoke test script for the MarkFeyn wheel package."""

import importlib
import sys
import zipfile
from importlib.metadata import entry_points, version
from pathlib import Path

# Test 1: Import markfeyn
import markfeyn
import markfeyn.core

assert "site-packages" in markfeyn.__file__, (
    f"markfeyn imported from {markfeyn.__file__}, not the installed wheel"
)


def entry_points_for(group):
    # entry_points(group=...) is Python 3.10+; 3.9 returns a dict of groups.
    found = entry_points()
    return found.select(group=group) if hasattr(found, "select") else found.get(group, [])


print(f"✓ markfeyn imported successfully (version {version('markfeyn')})")

# Test 2: Load entry points for mkdocs.plugins
mkdocs_eps = entry_points_for("mkdocs.plugins")
mkdocs_ep = next((ep for ep in mkdocs_eps if ep.name == "feynman-diagrams"), None)
assert mkdocs_ep is not None, "feynman-diagrams entry point not found in mkdocs.plugins"
mkdocs_plugin_class = mkdocs_ep.load()
print(f"✓ mkdocs.plugins entry point loaded: {mkdocs_plugin_class}")

# Test 3: Load entry points for properdocs.plugins
properdocs_eps = entry_points_for("properdocs.plugins")
properdocs_ep = next((ep for ep in properdocs_eps if ep.name == "feynman-diagrams"), None)
assert properdocs_ep is not None, "feynman-diagrams entry point not found in properdocs.plugins"
properdocs_plugin_class = properdocs_ep.load()
print(f"✓ properdocs.plugins entry point loaded: {properdocs_plugin_class}")

# Test 4: Check read_bundled_asset() is non-empty
asset_bytes = markfeyn.core.read_bundled_asset()
assert len(asset_bytes) > 0, "read_bundled_asset() returned empty bytes"
print(f"✓ read_bundled_asset() returned {len(asset_bytes)} bytes")

# Test 5: Import legacy shims

for shim in ("mkdocs_feynman_diagrams", "properdocs_feynman_diagrams"):
    importlib.import_module(shim).FeynmanDiagramsPlugin  # noqa: B018

print("✓ Legacy module shims imported successfully")

# Test 6: Check LICENSE/THIRD_PARTY_NOTICES in dist-info
# Find the .whl file in dist/
dist_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "dist")
whl_files = list(dist_dir.glob("*.whl"))
assert len(whl_files) > 0, "No .whl files found in dist/"
whl_path = whl_files[0]

print(f"✓ Found wheel: {whl_path.name}")

with zipfile.ZipFile(whl_path) as whl:
    all_files = whl.namelist()
    dist_info_dir = next((f for f in all_files if ".dist-info/" in f), None)
    assert dist_info_dir is not None, "No .dist-info directory found in wheel"

    # Check for LICENSE
    license_files = [
        f for f in all_files if ".dist-info/licenses" in f and "LICENSE" in f
    ]
    assert any("LICENSE" in f for f in license_files), "LICENSE not found in dist-info"
    print("✓ LICENSE found in dist-info")

    # Check for THIRD_PARTY_NOTICES
    third_party_files = [
        f for f in all_files
        if ".dist-info/licenses" in f and "THIRD_PARTY" in f
    ]
    assert any("THIRD_PARTY" in f for f in third_party_files), (
        "THIRD_PARTY_NOTICES not found in dist-info"
    )
    print("✓ THIRD_PARTY_NOTICES found in dist-info")

print("\n✅ All smoke tests passed!")
