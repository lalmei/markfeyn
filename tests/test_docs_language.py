"""Test that documentation uses present-tense language, not roadmap/milestone references."""

from pathlib import Path

import pytest


def test_no_milestone_in_user_docs():
    """Fail if 'milestone' appears in docs/**/*.md except docs/development.md."""
    repo_root = Path(__file__).resolve().parents[1]
    docs_dir = repo_root / "docs"

    # Find all markdown files in docs/
    doc_files = sorted(docs_dir.rglob("*.md"))

    violations = []
    for doc_file in doc_files:
        # Skip docs/development.md (it contains the history section)
        if doc_file.name == "development.md":
            continue

        content = doc_file.read_text()
        lines = content.split("\n")

        for line_num, line in enumerate(lines, start=1):
            if "milestone" in line.lower():
                rel_path = doc_file.relative_to(repo_root)
                violations.append(f"{rel_path}:{line_num}: {line.strip()}")

    if violations:
        pytest.fail(
            "Found 'milestone' references in user-facing docs:\n"
            + "\n".join(violations)
        )
