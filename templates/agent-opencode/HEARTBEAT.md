# Heartbeat Checklist - EXECUTE EVERY STEP. SKIP NOTHING.

This runs on your heartbeat cron (every 4 hours). Execute EVERY step in order.
Skipping steps = broken system. The dashboard monitors your compliance.

## Step 1: Update heartbeat (DO THIS FIRST)

```bash
cortextos bus update-heartbeat "<1-sentence summary of current work>"
```

If this fails, your agent shows as DEAD on the dashboard. Fix it before anything else.

**Note:** `update-heartbeat` (Step 1) and `log-event heartbeat agent_heartbeat` (Step 4) are NOT interchangeable.
- `update-heartbeat` refreshes the dashboard status-string field.
- `log-event heartbeat …` appends to the activity feed (JSONL append-only event log).

Both are required every cycle.

## Step 2: Sweep inbox for un-ACK'd messages

Messages arrive in real time via the fast-checker daemon. This step is a safety sweep for anything that wasn't ACK'd.

Full reference: `plugins/cortextos-agent-skills/skills/comms/SKILL.md`

```bash
cortextos bus check-inbox
```

For any messages returned: process and ACK each one:

```bash
cortextos bus ack-inbox "<message_id>"
```

Un-ACK'd messages are re-delivered after 5 minutes. Target: 0 un-ACK'd after this sweep.

If any of those messages were Telegram-shape (`=== TELEGRAM from`), you should already have replied via `cortextos bus send-telegram` when they first arrived — if not, do it NOW before continuing.

## Step 3: Check task queue + stale task detection

Full reference: `plugins/cortextos-agent-skills/skills/tasks/SKILL.md`

```bash
cortextos bus list-tasks --agent $CTX_AGENT_NAME --status pending
cortextos bus list-tasks --agent $CTX_AGENT_NAME --status in_progress
```

- If you have pending tasks: pick the highest priority one
- If you have in_progress tasks older than 2 hours: either complete them NOW or update their status with a note
- If you have NO tasks: check GOALS.md for objectives, then message the orchestrator

## Step 4: Log heartbeat event

Full reference: `plugins/cortextos-agent-skills/skills/event-logging/SKILL.md`

```bash
cortextos bus log-event heartbeat agent_heartbeat info --meta '{"agent":"'$CTX_AGENT_NAME'"}'
```

## Step 5: Write daily memory

Full reference: `plugins/cortextos-agent-skills/skills/memory/SKILL.md`

```bash
TODAY=$(date -u +%Y-%m-%d)
LOCAL_TIME=$(date +'%-I:%M %p %Z' 2>/dev/null || date)
# MAKE THE STEP FAIL, DO NOT MAKE A LATER CHECK DETECT (california-tom, 2026-07-27).
# A failing $(...) INSIDE a heredoc still appends the block: the substitution yields "",
# the write succeeds, mtime updates. So the freshness check below passes on a write that
# produced garbage — it verifies that SOMETHING was written, not that it was CORRECT, and
# the motivating bug (`date -u +%H:%M UTC` -> "illegal time format") is entirely the second
# kind. Hoisting the value out and testing it CONSUMES it at the moment it is produced.
UTC_TS=$(date -u +'%H:%M UTC') || UTC_TS=""
# PREVENT, do not DESCRIBE. `echo FATAL` does NOT abort — the heredoc runs regardless and
# appends the malformed entry the guard exists to stop. And >&2, because stdout is "a stream
# nobody treats as a signal" — the exact diagnosis of the original bug, which would otherwise
# describe the WARNING about it. (california-tom, 2026-07-27)
[ -n "$UTC_TS" ] || { echo "FATAL: step 5 timestamp empty, skipping malformed write" >&2; exit 1; }
MEMORY_DIR="$(pwd)/memory"
mkdir -p "$MEMORY_DIR"
cat >> "$MEMORY_DIR/$TODAY.md" << MEMORY

## Heartbeat Update - $UTC_TS / $LOCAL_TIME
- WORKING ON: <task_id or "none">
- Status: <healthy/working/blocked>
- Inbox: <N messages processed>
- Next action: <what you will do next>
MEMORY

# VERIFY THE SIDE EFFECT — a step whose product is a FILE WRITE has no deliverable in
# its terminal output, so an error there is invisible BY DESIGN, not by inattention.
# That is how `date -u +%H:%M UTC` printed "illegal time format" on every heartbeat in
# 7 agent files for weeks and nobody reported it. (california-tom, 2026-07-27)
# FORMAT-INDEPENDENT ON PURPOSE. A first version grepped for the literal heading
# "Heartbeat Update" and would have FATAL'd on klavon — which writes "## Heartbeat 00:26 UTC"
# and is demonstrably healthy (7 heavy passes tonight). A check tuned to the author's own
# file format is how you produce a confident wrong answer about other agents at once.
# So: verify the WRITE LANDED, not that it matches anyone's template.
if [ -s "$MEMORY_DIR/$TODAY.md" ] && [ -n "$(/usr/bin/find "$MEMORY_DIR/$TODAY.md" -mmin -2 2>/dev/null)" ]; then
  echo "step 5 OK: $TODAY.md written just now"
else
  echo "FATAL: step 5 did not write to $MEMORY_DIR/$TODAY.md — the heartbeat did not land"
fi
```

## Step 6: Check GOALS.md

Read GOALS.md. Goals are refreshed daily by the orchestrator each morning.

- If goals were updated today: you should already have tasks. If not, create them now — see `plugins/cortextos-agent-skills/skills/tasks/SKILL.md`
- If goals are stale (>24h without update): message the orchestrator to request fresh goals
- If you have no goals: message the orchestrator immediately. Don't idle.

## Step 7: Resume work

Full reference: `plugins/cortextos-agent-skills/skills/tasks/SKILL.md`

Pick your highest priority task and work on it. Tasks should trace back to your current goals.

When starting:
```bash
cortextos bus update-task "<task_id>" in_progress
```

When done:
```bash
cortextos bus complete-task "<task_id>" --result "<summary of what was produced>"
```

If you are blocked, see `plugins/cortextos-agent-skills/skills/human-tasks/SKILL.md` for the human task and approval workflow.
If you need an approval before acting, see `plugins/cortextos-agent-skills/skills/approvals/SKILL.md`.

## Step 8: Guardrail self-check

Full reference: `plugins/cortextos-agent-skills/skills/guardrails-reference/SKILL.md`

Ask yourself: did I skip any procedures this cycle? Did I rationalize not doing something I should have?

If yes, log it:
```bash
cortextos bus log-event action guardrail_triggered info --meta '{"guardrail":"<which one>","context":"<what happened>"}'
```

If you discovered a new pattern that should be a guardrail, add it to GUARDRAILS.md now.

## Step 9: Update long-term memory (if applicable)

Full reference: `plugins/cortextos-agent-skills/skills/memory/SKILL.md`

If you learned something this cycle that should persist across sessions:
- Patterns that work/don't work
- User preferences discovered
- System behaviors noted
- Append to MEMORY.md

## Step 10: Re-ingest memory to knowledge base

Full reference: `plugins/cortextos-agent-skills/skills/knowledge-base/SKILL.md`

Keep your memory collection searchable and current:

```bash
cortextos bus kb-ingest ./MEMORY.md ./memory/$(date -u +%Y-%m-%d).md \
  --org $CTX_ORG --agent $CTX_AGENT_NAME --scope private --collection memory-$CTX_AGENT_NAME --force
```

This runs automatically on every heartbeat cycle. It ensures past experiences, user preferences, and learned patterns are semantically searchable for future tasks. Skip if GEMINI_API_KEY is not configured.

---

REMINDER: A heartbeat with 0 events logged and 0 memory updates means you did nothing visible.
Target: >= 2 events and >= 1 memory update per heartbeat cycle.
Invisible work is wasted work.
