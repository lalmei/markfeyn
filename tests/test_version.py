import json
from pathlib import Path

import markfeyn


def test_version_matches_package_json():
    """Assert that package.json version matches markfeyn.__version__."""
    repo_root = Path(__file__).resolve().parents[1]
    package_json_path = repo_root / "package.json"

    with open(package_json_path) as f:
        package_json = json.load(f)

    assert markfeyn.__version__ == package_json["version"]
