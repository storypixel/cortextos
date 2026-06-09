---
name: nl-publish
description: Final prep for newsletter export — refresh futures, lint, render, backup
trigger: /publish, "ready to export", "prepare for mailchimp", "let's send"
input: date (optional, defaults to today)
output: ready-to-paste HTML URL + Obsidian backup confirmed
---

# nl-publish

Final-mile prep before Quint exports the HTML and pastes into Mailchimp.

## What it does

1. Refresh futures tape via `POST /api/doc/<date>/refresh-futures` (live CNBC quotes)
2. Grammar lint pass on View from Q paragraphs:
   - Check for missing intro-phrase commas
   - NVIDIA → all caps
   - No em-dashes
   - No "we" in View from Q (first-person singular only)
   - Flag anything that crosses editorial locks
3. Render the final HTML via `GET /api/doc/<date>/html`
4. Confirm Obsidian vault backup synced (check file exists at ~/Tickerverse/Projects/DIY Daily/Renders/<date>.html)
5. Return the export URL + preview URL + confirmation

## What it does NOT do

- Does NOT send to Mailchimp (Quint does the paste manually for v1)
- Does NOT make content changes without Quint's approval
- Does NOT auto-send or auto-schedule

## Composable with

- `nl-gen` + `nl-curate` (run before this as the full /morning chain)
- Standalone when Quint has already polished and just wants to export
