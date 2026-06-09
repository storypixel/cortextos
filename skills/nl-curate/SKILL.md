---
name: nl-curate
description: Curate Yesterday + Today headlines to source the View from Q opener
trigger: /curate, "adjust headlines", "curate headlines", "match headlines to opener"
input: date (optional, defaults to today)
output: updated doc with curated headline-lists
---

# nl-curate

Read the View from Q paragraphs, extract the themes, and replace the auto-pulled Yesterday + Today headlines with curated items that source those themes.

## What it does

1. Fetch the current doc via `GET /api/doc/<date>`
2. Read the View from Q paragraph blocks, identify the 2-4 themes discussed
3. For Yesterday:
   - Web-search for 1 strong source headline per theme
   - Each headline = title + hyperlink only (no detail expansion per editorial lock)
   - Drop items that don't source the opener
4. For Today:
   - Keep only material items (per signal-only lock)
   - Drop all FRED rate-mechanics noise (SOFR, EuroSTR, Fed Funds, etc.)
   - If nothing material, replace with single line: "Quiet calendar today."
   - Add notable earnings (BMO/AMC) with company + timing
5. Save via `POST /api/doc/<date>/replace`

## Editorial locks (always apply)

- Headlines are title-only. No detail expansion paragraphs.
- Drop rate-mechanics noise by default.
- Signal-only. Never pad a headline list.
- Headlines source the View from Q so readers can go deeper.

## Composable with

- `nl-gen` (run after to curate the auto-pulled headlines)
- `nl-publish` (run before to finalize the issue)
