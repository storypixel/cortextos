# Analyst First-Boot Onboarding

Use this flow only when the onboarding marker is absent or the user explicitly asks to re-run it. Keep every generated context file at or below 25,000 bytes.

## 1. Identity and Monitoring Goal

Read existing org/user context before asking questions. Ask one focused question per turn and do not re-ask known facts. Establish:

- name, role, tone, and working style;
- what the analyst monitors and why;
- sources, baseline metrics, alert thresholds, and reporting cadence;
- timezone, audience, autonomy, and approval boundaries.

Write identity to `IDENTITY.md`/`SOUL.md`, constraints to `GUARDRAILS.md`, current monitoring priorities to `GOALS.md`, user preferences to `USER.md`, recipient/channel facts to `SYSTEM.md`, and durable baselines to `MEMORY.md`.

## 2. Discover Current State

```bash
cortextos bus list-agents
cortextos bus list-skills --format text
cortextos bus list-tasks --agent "$CTX_AGENT_NAME"
cortextos bus list-crons "$CTX_AGENT_NAME"
cortextos bus kb-collections --org "$CTX_ORG"
```

Inspect existing sources and schedules before adding anything. During migration, carry forward only current baselines, ownership, unresolved alerts, and recovery facts. Archive historical reports and resolved incidents.

## 3. Monitoring Design

For each monitor, record:

1. Source and freshness requirement.
2. Normal baseline and threshold.
3. How a failure is distinguished from a clean result.
4. Evidence required before alerting.
5. Recipient, severity, and expected action.

A scheduler fire is not proof that data was consumed or an analysis completed. Avoid routine success pings and all lifecycle messages.

## 4. Crons and Knowledge

Persistent schedules are daemon-managed at `${CTX_ROOT}/.cortextOS/state/agents/${CTX_AGENT_NAME}/crons.json`. Use the cron-management skill after `list-crons`; do not duplicate schedules or use session loops.

Ingest only approved, non-secret sources. Never ingest `.env` files, credentials, tokens, private keys, raw personal messages, or irrelevant personal data. Source-of-truth files and current commands outrank the KB.

## 5. Optional Ecosystem Features

Explain optional self-improvement, experiment, dashboard, or specialist features briefly. Enable only what the user chooses. Each experiment needs a measurable hypothesis, bounded surface, rollback plan, and stored evidence. Do not create other agents without explicit authorization.

## 6. Finish

Verify the bootstrap set, monitoring rules, recipient rules, enabled registration, schedules, secret hygiene, and file sizes. Then create the onboarding marker and log completion:

```bash
mkdir -p "${CTX_ROOT}/state/${CTX_AGENT_NAME}"
touch "${CTX_ROOT}/state/${CTX_AGENT_NAME}/.onboarded"
cortextos bus log-event milestone onboarding_complete info --meta '{"agent":"'"$CTX_AGENT_NAME"'"}'
```

Summarize what will be monitored, when alerts fire, where reports go, and any unresolved access or decision.
