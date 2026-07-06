export const meta = {
  name: 'dynamic-dev-task',
  description:
    'Dynamic dev workflow (the Fable-5 pattern): Sonnet explores, Fable 5 plans + decomposes into parallel-safe work items, one implementer per item runs in its own git worktree, Opus 4.8 integrates + reviews. Pass the task via args (a string, or {task, maxItems}).',
  phases: [
    { title: 'Explore', detail: 'Sonnet 5 maps the relevant code (writes nothing)', model: 'sonnet' },
    { title: 'Plan', detail: 'Fable 5 decomposes into independent, disjoint-file work items', model: 'fable' },
    { title: 'Implement', detail: 'one implementer per item, each in an isolated git worktree' },
    { title: 'Integrate + Review', detail: 'Opus 4.8 merges the worktrees and reviews vs acceptance', model: 'opus' },
  ],
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'short kebab slug' },
          title: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          acceptance: { type: 'string' },
        },
        required: ['id', 'title', 'description', 'acceptance'],
      },
    },
    risks: { type: 'string' },
  },
  required: ['items'],
}

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    files_changed: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['status', 'summary'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['ship', 'rework', 'blocked'] },
    integrated: { type: 'boolean' },
    conflicts: { type: 'string' },
    rework_items: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['verdict', 'summary'],
}

const task = typeof args === 'string' ? args : (args && args.task) || ''
if (!task) throw new Error('dynamic-dev-task: provide a task description via args (a string, or {task, maxItems})')
const maxItems = (args && args.maxItems) || 5

// 1. EXPLORE — Sonnet maps the code, writes nothing.
phase('Explore')
const exploration = await agent(
  [
    'You are the EXPLORER. Do NOT modify any files. Map the parts of THIS repository relevant to the task below.',
    'Report: the exact files/modules involved, what each does, the conventions and patterns to follow (naming, tests, build), where changes will be needed, and any gotchas an implementer must respect.',
    'Be concrete with real file paths. Keep it tight and factual.',
    '',
    `TASK: ${task}`,
  ].join('\n'),
  { label: 'explore', phase: 'Explore', model: 'sonnet' }
)

// 2. PLAN — Fable decomposes into independent, parallel-safe work items.
phase('Plan')
const plan = await agent(
  [
    'You are the PLANNING LEAD. Using the exploration below, produce an implementation plan for the task, DECOMPOSED into independent work items that can be implemented IN PARALLEL without conflicting.',
    'Rules: each item must touch a DISJOINT set of files from the others (no two items editing the same file). If two changes must share a file, MERGE them into one item. Prefer 2-5 items. If the task is genuinely one unit, return a single item.',
    'For each item: id (short slug), title, files (paths it will touch), description (the precise change), acceptance (how to verify it).',
    '',
    `TASK: ${task}`,
    '',
    'EXPLORATION:',
    exploration,
  ].join('\n'),
  { label: 'plan', phase: 'Plan', model: 'fable', schema: PLAN_SCHEMA }
)

const items = (plan.items || []).slice(0, maxItems)
if (!items.length) throw new Error('Planner returned no work items')
log(`Plan: ${items.length} parallel-safe item(s)${plan.risks ? ` — risks: ${plan.risks}` : ''}`)

// 3. IMPLEMENT — one agent per item, each in its own git worktree (parallel, conflict-free).
phase('Implement')
const built = await parallel(
  items.map((it) => () =>
    agent(
      [
        'You are an IMPLEMENTER working in an ISOLATED git worktree. Implement ONLY your work item. Follow the repo conventions from the plan. Touch only your item files. Make it build/pass. Commit your change in the worktree with a clear message.',
        '',
        `ITEM ${it.id}: ${it.title}`,
        `FILES: ${(it.files || []).join(', ') || '(discover from the description)'}`,
        `CHANGE: ${it.description}`,
        `ACCEPTANCE: ${it.acceptance}`,
      ].join('\n'),
      { label: `impl:${it.id}`, phase: 'Implement', model: 'sonnet', isolation: 'worktree', schema: IMPL_SCHEMA }
    )
      .then((r) => ({ item: it, result: r }))
      .catch(() => null)
  )
)
const done = built.filter(Boolean)
log(`Implemented ${done.length}/${items.length} item(s)`)

// 4. INTEGRATE + REVIEW — Opus merges the worktree branches and reviews vs acceptance.
phase('Integrate + Review')
const review = await agent(
  [
    'You are the INTEGRATION + REVIEW LEAD. Several implementers each completed one work item in its own git worktree/branch for the task below.',
    'Job: integrate their branches into the working branch (git merge each implementer branch; resolve conflicts using the plan as source of truth), then REVIEW the combined result for correctness, convention adherence, and completeness against each item\'s acceptance criteria. Run the build/tests if present.',
    'If a worktree branch is not directly reachable in this environment, reconstruct its change from the item description. Report which items shipped, any conflicts, and which need rework.',
    '',
    `TASK: ${task}`,
    '',
    'ITEMS + IMPLEMENTER RESULTS:',
    ...done.map(
      (d) =>
        `- [${d.item.id}] ${d.item.title} — status:${d.result && d.result.status}; ${d.result && d.result.summary}; files:${((d.result && d.result.files_changed) || d.item.files || []).join(', ')}`
    ),
  ].join('\n'),
  { label: 'integrate-review', phase: 'Integrate + Review', model: 'opus', schema: REVIEW_SCHEMA }
)

log(`Review verdict: ${review.verdict}`)
return {
  task,
  plan_summary: plan.summary || '',
  items: items.map((it) => ({ id: it.id, title: it.title, files: it.files })),
  implemented: done.map((d) => ({ id: d.item.id, status: d.result && d.result.status, summary: d.result && d.result.summary })),
  review,
}
