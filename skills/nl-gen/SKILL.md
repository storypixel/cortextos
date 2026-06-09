---
name: nl-gen
description: Generate today's DIY Daily newsletter draft with verified market data
trigger: /gen, "what do we have today", "generate today's issue", "morning prep"
input: date (optional, defaults to today)
output: seeded doc at diy-daily.klerb.io/?date=<date>
---

# nl-gen

Generate a fresh DIY Daily issue for the given date.

## What it does

1. Call `POST /api/doc/<date>/generate` on the DIY Daily API (localhost:8787)
2. Web-search verify yesterday's actual close: S&P, Nasdaq, Dow, Russell 2000, Oil, 10Y, BTC, USD
3. Seed the View from Q with a 3-paragraph opener:
   - P1: yesterday's verified action (what happened, not hallucinated)
   - P2: context or thematic thread (per Quint's editorial direction if given)
   - P3: today's calendar + earnings setup
4. Generate YTD chart via `scripts/ytd-chart.py`
5. Refresh futures tape via `POST /api/doc/<date>/refresh-futures`
6. Report summary to the caller (telegram group, CLI, etc.)

## Editorial locks (always apply)

- No em-dashes. Use ellipsis, period, comma.
- First-person singular ("I") in View from Q.
- Never too predictive. Describe forces, don't call outcomes.
- Lean positive. Audience is long-term investors.
- Verify every quantitative claim before writing it.
- Short sentences. No analytical scaffolding.
- Signal-only. Never pad.

## Composable with

- `nl-curate` (run after to match headlines to opener)
- `nl-verify` (run on any specific claim)
- `nl-publish` (run when ready to export)
