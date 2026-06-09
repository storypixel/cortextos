---
name: nl-verify
description: Web-search verify a market claim and return sourced numbers
trigger: /verify, "verify this", "is this accurate", "confirm the number"
input: text claim to verify
output: verified figure with source, or "unverifiable"
---

# nl-verify

Fact-check a specific market claim before it goes into the newsletter.

## What it does

1. Parse the claim (e.g., "Nasdaq is up 30% from March lows")
2. Web-search for authoritative sources (CNBC, WSJ, Yahoo Finance, TradingEconomics, FRED, StockAnalysis)
3. Find the specific numbers (close prices, dates, percentages)
4. Calculate the math independently
5. Return: verified figure + source URL + confidence level (high/medium/low)
6. If sources conflict, report all figures with the range

## Rules

- Never return a number without a source.
- If the claim is unverifiable from available sources, say so explicitly.
- When sources disagree, report the range (e.g., "between X and Y depending on source").
- Prefer end-of-day close data over intraday snapshots.
- Always show the math: "from A to B = +X%"

## Composable with

- `nl-gen` (called automatically during generation for close-number verification)
- Any ad-hoc Quint question about market data
