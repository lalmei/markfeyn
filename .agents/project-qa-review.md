# QA Prompt: Project-Wide MarkFeyn Review

You are working in `/Users/lalmei/Documents/markfeyn`.

## Goal

Perform a project-wide QA review of MarkFeyn so the project has clearer
documentation of:

- how the package works end to end;
- how well the current implementation behaves;
- what is well covered by tests and docs;
- where correctness, architecture, documentation, packaging, or usability still
  falls short.

Take a code-review and product-quality stance. Do not implement fixes unless the
user explicitly asks after the review. Your deliverable is a concise,
evidence-backed report that can guide planning work.

## Current Project Shape To Re-check

Re-check the current repo before making claims. Do not rely on this prompt as a
snapshot.

MarkFeyn currently has these broad surfaces:

- Python package and plugin integration under `src/markfeyn/`.
- MkDocs and ProperDocs entry points in `markfeyn.mkdocs_plugin` and
  `markfeyn.properdocs_plugin`.
- Shared plugin logic in `src/markfeyn/core.py`.
- Browser renderer source under `src/markfeyn/renderer/`.
- Generated browser bundle at `src/markfeyn/assets/feynman-diagrams.js`.
- Documentation under `docs/`.
- Python tests under `tests/test_*.py`.
- JavaScript renderer and visual tests under `tests/*.test.js`,
  `tests/visual/fixtures/`, and `tests/visual/snapshots/`.
- Developer prompts and roadmap notes under `.agents/`.

The generated bundle is the real browser test surface. If renderer source files
changed, verify through the normal JS build/test path rather than source
inspection alone.

## First Actions

1. Inspect the GitButler workspace:

   ```bash
   but status -fv
   but diff
   ```

   Identify active branches, uncommitted files, and any work that appears to
   belong to another agent. Do not modify or commit another agent's work.

2. Read the high-signal project files:

   ```bash
   sed -n '1,260p' README.md
   sed -n '1,320p' docs/development.md
   sed -n '1,320p' docs/syntax.md
   sed -n '1,220p' pyproject.toml
   sed -n '1,220p' package.json
   sed -n '1,220p' Makefile
   find src/markfeyn -maxdepth 4 -type f | sort
   find tests -maxdepth 3 -type f | sort
   find .agents -maxdepth 1 -type f | sort
   ```

3. Inspect the main runtime paths. At minimum, read the relevant facades before
   drilling into internals:

   ```bash
   sed -n '1,260p' src/markfeyn/core.py
   sed -n '1,220p' src/markfeyn/mkdocs_plugin.py
   sed -n '1,220p' src/markfeyn/properdocs_plugin.py
   sed -n '1,260p' src/markfeyn/renderer/feynman-diagrams.js
   sed -n '1,280p' src/markfeyn/renderer/parser/index.js
   sed -n '1,320p' src/markfeyn/renderer/layout/layout.js
   sed -n '1,260p' src/markfeyn/renderer/render/svg-renderer.js
   ```

   Then inspect focused modules based on what those facades show.

## Review Scope

Review these areas with evidence and concrete file references.

### Product And User Surface

- Is the documented syntax accurate and understandable?
- Are examples representative of common Feynman-diagram use cases?
- Are limitations stated clearly, especially compared with TikZ-Feynman?
- Does the project explain when to use MkDocs, ProperDocs, manual JS setup, and
  local development flows?
- Are parse errors, unsupported syntax, and runtime failures visible enough for
  users to diagnose?

### Package And Integration

- Do MkDocs and ProperDocs plugin paths share behavior through `core.py` without
  divergent config or asset-copy logic?
- Are entry points, package data, license files, and bundled assets correctly
  declared?
- Is `script_path` handling safe and documented?
- Is the package shape consistent with `README.md`, `docs/development.md`, and
  `pyproject.toml`?

### Renderer Architecture

- Is the parser, semantic model, layout analysis, placement, normalization,
  scoring, and SVG rendering pipeline understandable from the code?
- Are modules split along stable boundaries, or are there remaining
  mixed-responsibility files?
- Does the layout pipeline preserve the key semantic distinctions:
  `incoming`/`outgoing` roles, unclassified external states, edge direction,
  fermion arrows, momentum arrows, and visual layout direction?
- Are custom loop, multiloop, symmetric, label-placement, and normalization paths
  coordinated without circular coupling or hidden ordering dependencies?
- Are diagnostics and scores useful enough to debug layout failures?

### Physics And Layout Behavior

- Do documented conventions match rendered behavior for process diagrams,
  no-role symmetric diagrams, loops, multiloops, self-energy diagrams, contact
  interactions, parallel propagators, manual positions, braces, vertex shapes,
  labels, and momentum arrows?
- Are there places where MarkFeyn claims TikZ-Feynman-like behavior but only
  approximates it?
- Are declared `incoming` and `outgoing` orders preserved as visible boundary
  order?
- Are unclassified endpoints kept unclassified rather than silently assigned
  process roles?
- Are deterministic layouts actually covered by tests?

### Tests And Verification

- Do Python tests cover package integration, docs config, path handling, and both
  documentation engines?
- Do JS tests cover parser behavior, layout invariants, diagnostics, and public
  bundle exports?
- Do visual snapshots cover representative diagrams and recent regression
  surfaces?
- Are docs examples included in the test surface?
- Are there fragile tests, missing assertions, or fixture gaps that would allow
  major behavior changes to pass?

### Documentation Quality

- Does the documentation explain the runtime model, architecture, development
  workflow, and limitations at the right level?
- Are users told how to debug failed diagrams?
- Are developers told how to safely change renderer source, rebuild the bundle,
  update visual snapshots, and preserve compatibility?
- Are roadmap and prompt files clearly separated from shipped user docs?

### Maintainability And Rewrite Pressure

- Which areas are healthy enough to extend incrementally?
- Which areas are showing rewrite pressure because of accidental complexity,
  missing contracts, poor boundaries, or repeated regression risk?
- Which rewrite ideas should stay deferred because compatibility risk is higher
  than payoff?

## Verification Commands

Run the normal gate unless the repo state makes that unsafe. If a command fails,
inspect and report the relevant failure lines before continuing.

```bash
npm run test:js
uv run --group dev pytest
make docs
git diff --check
```

Also inspect the bundle public surface:

```bash
node -e "console.log(Object.keys(require('./src/markfeyn/assets/feynman-diagrams.js')).sort().join('\n'))"
```

If you skip a command, explain why and state the resulting review risk.

## Optional Focused Checks

Use these if the first pass suggests risk:

```bash
rg -n "TODO|FIXME|throw new Error|console\\.warn|console\\.error" src tests docs
rg -n "incoming|outgoing|unclassified|fermionFlow|momentum|diagnostics|score" src/markfeyn/renderer tests docs
wc -l src/markfeyn/renderer/**/*.js
```

You may add targeted node scripts or temporary commands for analysis, but do not
leave generated temporary files in the repo.

## Report Output

Start with findings, ordered by severity. For each finding include:

- severity: `P0`, `P1`, `P2`, or `P3`;
- file and line reference when applicable;
- what is wrong;
- why it matters;
- the smallest likely fix;
- which test or doc should guard the fix.

Then include these sections:

1. **Project Map**: a short end-to-end explanation of how MarkFeyn works from
   fenced block to rendered SVG in MkDocs and ProperDocs.
2. **Quality Assessment**: what works well today, backed by tests or docs.
3. **Coverage Gaps**: missing tests, visual fixtures, examples, or docs.
4. **Known Limits**: limits that are acceptable if documented clearly.
5. **Rewrite Pressure**: areas where refactor or redesign may be justified, with
   evidence.
6. **Verification Results**: exact commands run and pass/fail status.
7. **Residual Risk**: what you did not verify.

If there are no serious issues, say so clearly and still list lower-severity
gaps and residual risks.

## Artifact

Unless the user asks for a different destination, write the final report to:

```text
.agents/project-qa-review-report.md
```

Keep the report concise enough to be reviewed in one sitting, but detailed enough
that another agent can plan work from it without repeating the whole audit.

## Git

Use GitButler `but` for version-control inspection and any later commit work.
Do not commit the review report unless the user asks, or unless the active
session instructions explicitly require a checkpoint commit. Never push or open a
pull request unless the user asks.
