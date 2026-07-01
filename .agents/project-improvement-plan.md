# Planning Prompt: MarkFeyn Issues, Rewrites, And Improvements

You are working in `/Users/lalmei/Documents/markfeyn`.

## Goal

Turn the current project QA evidence into a practical improvement plan for
MarkFeyn. The plan should explain how to tackle confirmed issues, technical
debt, rewrite pressure, and product/documentation improvements without losing the
working behavior the project already has.

This is a planning task, not an implementation task. Do not edit product code
unless the user explicitly changes the assignment after reviewing the plan.

## Inputs

Start from the current repo, not from stale assumptions.

Primary input, if present:

```text
.agents/project-qa-review-report.md
```

If that file does not exist, run a lighter review first using
`.agents/project-qa-review.md` as the checklist, then state that the plan is based
on a partial review.

Also read:

```bash
sed -n '1,260p' README.md
sed -n '1,340p' docs/development.md
sed -n '1,340p' docs/syntax.md
sed -n '1,260p' .agents/goal_memory.md
sed -n '1,260p' .agents/overall_plan.md
sed -n '1,220p' pyproject.toml
sed -n '1,220p' package.json
sed -n '1,220p' Makefile
but status -fv
but diff
```

Use GitButler output to distinguish this session's work from other agents' work.
Do not plan by assuming uncommitted files are safe to modify.

## Planning Principles

- Preserve the current v1 package surface by default.
- Prefer small, reviewable slices with regression gates over broad rewrites.
- Keep behavior-preserving refactors separate from behavior changes when that
  makes review easier.
- Pair renderer-source changes with regenerated
  `src/markfeyn/assets/feynman-diagrams.js` only when the source change requires
  it.
- Preserve MkDocs and ProperDocs compatibility unless the user explicitly
  chooses to drop one.
- Treat TikZ-Feynman as an inspiration and comparison point, not a promise of
  pixel or syntax compatibility.
- Keep declared `incoming`/`outgoing` order as the visible boundary-order source.
- Do not infer process roles from node names, edge direction, fermion arrows,
  momentum arrows, labels, or particle styles.
- Use tests and docs examples as contracts before changing layout behavior.
- Avoid adding abstractions unless they reduce real coupling, clarify a contract,
  or make a known regression class easier to test.

## Required First Response

Before writing the final plan, summarize:

1. The evidence you found: QA report status, current GitButler state, and any
   fresh verification you ran.
2. The top planning constraints and compatibility risks.
3. Alignment questions that truly affect the plan. Each question must include:
   your recommendation, the tradeoff, and what changes if the user chooses the
   other direction.

If there are no blocking questions, say so and proceed with a recommended plan.

## Plan Structure

Build a plan with concrete workstreams. Use these categories unless the evidence
suggests a better split:

1. **Correctness And Regression Fixes**
   - Confirmed bugs, failing tests, layout regressions, docs build failures,
     package failures, or unsafe path/config behavior.

2. **Documentation And User Experience**
   - Missing conceptual docs, examples, troubleshooting guidance, limitation
     statements, install/setup clarity, and syntax accuracy.

3. **Renderer Architecture**
   - Parser contracts, semantic model boundaries, layout strategy selection,
     normalization, topology, scoring, diagnostics, label placement, rendering,
     and generated bundle compatibility.

4. **Test And Visual QA Coverage**
   - Unit invariants, docs-example parsing, visual snapshots, edge-case fixtures,
     API/bundle surface checks, deterministic-layout checks, and packaging smoke
     tests.

5. **Packaging And Release Readiness**
   - PyPI metadata, package data, license notices, dependency boundaries,
     release commands, docs publishing, and versioning strategy.

6. **Rewrite Or V2 Candidates**
   - Larger redesigns that should be opt-in, deferred, or gated behind a stable
     compatibility layer.

## Per-Item Format

For every planned item, include:

- **Problem**: what needs attention.
- **Evidence**: file, test, docs section, QA finding, or observed failure.
- **Recommendation**: the preferred approach.
- **Scope**: likely files/modules touched.
- **Risk**: compatibility, visual churn, package behavior, or review risk.
- **Regression Gate**: exact tests, visual fixtures, docs builds, or manual
  checks required.
- **Commit Shape**: one commit, split commits, or branch stack recommendation.
- **Done When**: concrete acceptance criteria.

## Prioritization

Group work into phases:

### Phase 0: Stabilize

Fix anything that blocks tests, docs, packaging, or current user workflows.
Only include items backed by direct evidence.

### Phase 1: Document The Current System

Improve documentation of the actual architecture, limitations, debugging
workflow, and supported syntax. Prefer documenting current truth before changing
behavior.

### Phase 2: Reduce Regression Risk

Add focused tests, visual snapshots, and compatibility checks around known weak
spots before larger refactors.

### Phase 3: Incremental Refactors

Split or clarify modules where boundaries are already visible and behavior can
be preserved. Keep each refactor tied to a measurable maintenance or testing
benefit.

### Phase 4: Opt-In Redesigns

Describe larger rewrites or v2 ideas only after the incremental path is clear.
State what evidence would justify starting them and how v1 compatibility would
be preserved.

## Rewrite Decision Bar

Do not recommend a rewrite just because a module is large. Recommend a rewrite
only when at least two of these are true:

- the current design repeatedly caused regressions;
- behavior is impossible to specify or test at current boundaries;
- a compatibility-preserving refactor would be more complex than a contained
  replacement;
- user-facing capability is blocked by the current architecture;
- the current model mixes concepts that must stay independent, such as process
  role, edge direction, momentum direction, fermion flow, and visual direction.

For each rewrite candidate, include a smaller alternative and explain why it is
or is not enough.

## Verification Gates To Use In Plans

Use the existing full gate for broad changes:

```bash
npm run test:js
uv run --group dev pytest
make docs
git diff --check
```

For renderer-source changes, include the bundle-surface check:

```bash
node -e "console.log(Object.keys(require('./src/markfeyn/assets/feynman-diagrams.js')).sort().join('\n'))"
```

For layout behavior, prefer adding or updating focused fixtures under
`tests/visual/fixtures/` and deterministic assertions in
`tests/feynman-diagrams.test.js` before accepting large visual churn.

## Deliverable

Unless the user asks for a different destination, write the final plan to:

```text
.agents/project-improvement-plan-output.md
```

The plan should be copy-paste ready for future agents. Include a short executive
summary, then the phased roadmap, then detailed work items.

## Git

Use GitButler `but` for version-control inspection and any later commit work.
If committing this plan, commit only this session's planning artifacts on a
dedicated GitButler branch. Do not commit QA reports or prompt files from another
agent unless the user explicitly asks.
