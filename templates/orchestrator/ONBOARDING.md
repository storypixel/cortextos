# Orchestrator First-Boot Onboarding

Run only when the onboarding marker is absent or the user explicitly requests onboarding. Read org context before asking questions; do not re-ask configured identity, timezone, working hours, north star, or agent roster.

## 1. Confirm the Operating Contract

One focused question per turn. Confirm:

- the current north star and immediate bottleneck;
- what the orchestrator coordinates versus what specialists own;
- goal-cascade and delegation authority;
- briefing cadence, communication style, timezone, and real recipients;
- approval, human-task, deployment, financial, deletion, and external-message boundaries;
- offline-hours guardrails and alert thresholds.

Write answers to the narrowest bootstrap file. Keep each file at or below 25,000 bytes.

## 2. Discover Existing Fleet State

```bash
cortextos bus list-agents
cortextos bus list-skills --format text
cortextos bus read-all-heartbeats --format json
cortextos bus check-stale-tasks
cortextos bus list-approvals --format json
cortextos bus list-crons "$CTX_AGENT_NAME"
cortextos bus kb-collections --org "$CTX_ORG"
```

Use the enabled-agent registry and current commands. A cron dispatch is not proof of agent consumption or task completion. Do not read raw process-manager environment blocks.

## 3. Establish Workflows

Configure only agreed workflows:

- daily focus/goal cascade with clear specialist ownership;
- morning and evening briefings;
- approval and `[HUMAN]` task reminders;
- fleet-health checks that distinguish dispatch, acknowledgement, execution, and verified result;
- weekly review metrics.

Send no boot, restart, handoff, or routine-success messages. Alerts must identify the condition, evidence, owner, and required action.

## 4. Persistent Schedules

Crons are daemon-managed at `${CTX_ROOT}/.cortextOS/state/agents/${CTX_AGENT_NAME}/crons.json`. Check existing schedules before any add/update. Use the cron-management skill and bus cron commands; do not use session loops and do not recreate schedules at boot.

## 5. Roster and Goals

Read each enabled agent's identity/goals before assigning work. Respect product ownership and do not create duplicate agents. Write goals that name the outcome, evidence, owner, constraint, and current timestamp. The user can always override.

Creating or enabling a new agent is a separate explicit action. Do not create an analyst or specialist merely because onboarding offers the capability.

## 6. Knowledge and Migration

- Ingest only approved, non-secret shared sources.
- Keep private material in the correct scope.
- Never ingest secrets, raw environment values, credentials, private keys, or irrelevant personal data.
- During migration, retain current ownership, invariants, unresolved work, and recovery facts. Archive transcripts and resolved incidents.
- Source-of-truth files and current commands outrank indexed copies.

## 7. Verify and Complete

Verify bootstrap files, current goals, roster, recipient rules, schedules, approvals, secret hygiene, and context sizes. Do not restart the daemon merely to validate onboarding.

```bash
mkdir -p "${CTX_ROOT}/state/${CTX_AGENT_NAME}"
touch "${CTX_ROOT}/state/${CTX_AGENT_NAME}/.onboarded"
cortextos bus log-event milestone onboarding_complete info --meta '{"agent":"'"$CTX_AGENT_NAME"'"}'
```

Summarize the operating contract, installed schedules, owners, alert policy, and unresolved decisions. Offer optional analyst setup separately; wait for explicit authorization before creating it.
