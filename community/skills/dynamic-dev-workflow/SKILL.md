---
name: dynamic-dev-workflow
description: Use this skill for a large or multi-file coding task too big for one pass — refactors, migrations, multi-module features, broad sweeping edits. It runs the "dynamic dev" pattern (Sonnet explores, Fable 5 plans and decomposes, parallel implementers each work in an isolated git worktree, Opus 4.8 integrates and reviews) via a ready-made Workflow script. Aimed at dev/orchestrator agents (e.g. zerocool, acid-burn). Not for one-file tweaks or tightly-coupled changes that cannot be split.
---

# Dynamic Dev Workflow

A ready-to-run Claude Code Workflow that fans a big coding task out across model tiers, mirroring the Fable-5 dynamic-workflow pattern:

- **Explore** (Sonnet 5) — maps the relevant code, writes nothing.
- **Plan** (Fable 5) — decomposes the task into independent, parallel-safe work items (disjoint files).
- **Implement** (parallel) — one implementer per item, each in its own git worktree so they never conflict.
- **Integrate + Review** (Opus 4.8) — merges the worktree branches and reviews against each item's acceptance criteria.

The value is not "many agents." It is a strong planner on top, isolated parallel implementers in the middle, and a review gate at the bottom — an auditable loop you can rerun and inspect.

## When to use it

- Multi-file refactors, migrations, or features that touch several **independent** areas.
- Broad mechanical sweeps across many files.

## When NOT to use it

- A one-file tweak — just do it directly.
- Tightly-coupled changes that cannot be split — the planner returns a single item and the parallelism is wasted; a normal session is better.

## How to run it

From a dev agent session, invoke the **Workflow** tool with this skill's bundled script and your task:

```
Workflow({
  scriptPath: "<this-skill-dir>/dynamic-dev-task.workflow.js",
  args: { task: "<clear description of the whole change>", maxItems: 5 }
})
```

- `args` may be a plain string (the task) or `{ task, maxItems }` (default `maxItems` 5).
- The workflow returns `{ task, plan_summary, items, implemented, review }`. Read `review.verdict` (`ship` | `rework` | `blocked`) and `review.summary`; act on `review.rework_items` if any.
- Watch live progress with `/workflows`.

## Guardrails

- **Start on a feature branch, not main.** The implementers commit inside worktrees and the lead merges back.
- **First-run check:** the Integrate step asks Opus to `git merge` each implementer's worktree branch. Confirm on your first real run that the worktree branches are reachable in your harness; if not, the lead reconstructs each change from the plan (report this back so the merge step can be hardened).
- Keep tasks decomposable into disjoint files. If the planner keeps returning one item, the task is coupled — run it as a normal session instead.
- This spawns several agents across tiers (Sonnet + Fable + N Sonnet implementers + Opus). Use it for tasks that justify that fan-out, not routine edits.

## Origin

Encodes the Fable-5 dynamic-workflow pattern (agentic.james demo, 2026-07). Complements the `workflows-engineering` reference skill (which is the theory); this one is the ready-to-run loop.
