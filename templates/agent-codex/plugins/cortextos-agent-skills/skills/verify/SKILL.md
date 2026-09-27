---
name: verify
description: Prove a change actually works by testing it on the surface a real user touches, not by reading code. Load BEFORE claiming anything is done, works, is fixed, is deployed, or is safe. Triggers: "is it working", "did it work", "confirm", "verify", "make sure", "it's done", "shipped", or any moment you are about to report success.
---

# Verify

> Reading the code is not verification. Running the thing the way its actual user runs it is.

Our recurring failure is confirming by inspection: the code *looks* right, the process *says* running, the config *contains* the value — so we report success. Then it turns out the agent was hung, the page never rendered, the endpoint 500s, the cron never fired. This skill exists to stop that.

**Hard rule: never report "done", "working", "fixed", or "healthy" from code-reading alone.**

---

## Step 1 — Ask the surface question FIRST

Before verifying anything, answer out loud:

> **What surface does the actual user touch this on?**

The answer dictates the method. Do not skip to a method you find convenient.

| Real user is… | Then verification MUST be… |
|---|---|
| A person in a browser (GUI) | Drive a real browser (chrome-devtools MCP), interact as they would, **screenshot the result** |
| A person on a phone | Same, with a mobile viewport (`resize_page`) — mobile-first per Sam's standing rule |
| An **agent** (MCP server, tool, API for LLMs) | Call it **as an agent would** — real tool call, real schema, check the response is actually usable |
| A developer on a CLI | Run the command in a clean shell, check exit code **and** stdout |
| An HTTP client / integration | Real request (`curl`), assert status **and** body content |
| A scheduled job (cron/launchd) | Confirm an **actual fire** — a log line with a timestamp, not the schedule's existence |
| Another agent (bus/messages) | Confirm the recipient **received and acted**, not that send returned OK |
| A reader (doc/report) | Read the rendered output end-to-end; check links resolve |

If the change spans surfaces (API + UI), verify **each** surface.

---

## Step 2 — Verify against the user's goal, not the ticket

Test what they wanted to accomplish, not the literal diff. A login fix isn't verified by "the request returns 200" — it's verified by *logging in and landing on the page you should land on*.

---

## Step 3 — Try to break it

A single happy path is not verification. Also check:
- the empty / zero / missing case
- a wrong or hostile input
- the second run (idempotency — did it duplicate?)
- what a *different* user sees (authz — never verify only as the owner/admin)

---

## Step 4 — Capture evidence

Report must contain something a skeptic could check: a screenshot, exact command + real output, a status code with body, a log line with a timestamp, a test name with pass count. "I confirmed it works" is not evidence.

---

## Known false-positive signals (bitten us before)

These look like health and are not. Never accept them as proof:

| Looks like proof | Why it lies | Check instead |
|---|---|---|
| `cortextos status` shows **running / uptime** | A **hung** agent shows identical uptime. Cost us 32h of a dead acid-burn. | `read-all-heartbeats` **freshness** + `[STALE]`; grep the parenthesized id `"(agent-name)"` — a bare name matches other agents' text |
| `cortextos bus check-inbox` returns `[]` | Under-reports. Real messages sat unread, hid a Sam task 4h. | `ls ~/.cortextos/default/inbox/<agent>/` directly |
| Log file is growing | Can be pure ANSI spinner churn with zero work | Is the growth **readable text**? Is `outbound-messages.jsonl` mtime moving? |
| A `git log A..B` came back empty | The base ref may not exist — and `2>/dev/null` hides `fatal:` | **Never** silence stderr on verification commands; `git show --stat <sha>` |
| `cmd 2>&1 \| tail -5; echo $?` printed `0` | **A pipe replaces the exit code.** `$?` is `tail`'s, not `cmd`'s. The command may never have run. | `cmd > /tmp/out 2>&1; RC=$?` — capture **first**, tail after. See note below. |
| `timeout 30 cmd` "passed" | **macOS has no `timeout`** (nor `gtimeout`). Shell prints *command not found* and the exit you read comes from the next stage. | Use the Bash tool's own timeout parameter |
| Your own checker/test passes | It may be green *because it's measuring the wrong thing* | **Inject the bug it exists to catch.** If it doesn't go red, it's decoration |
| Config file contains the value | The process may be running the **old** config | Confirm the live process reflects it (restart + observe behavior) |
| Cron/plist exists in the repo | Existing ≠ installed ≠ firing | Check it's installed **and** find a real fire in the logs |
| Deploy/build "succeeded" | Build success ≠ page works | Load the actual URL, assert real content (never share a URL un-curl'd) |
| An agent replied "DONE" | It may be wrong or optimistic | Re-run its tests yourself; verify its artifacts exist |

> **Precision on pipes — don't over-correct.** Pipes aren't bad. A pipe *replaces the signal you think you're reading*: **output text survives a pipe intact** (that's what `tail` is for), **exit codes do not**. So a claim resting on what the tool *printed* ("6 passed", "66 → 66") is sound evidence; a claim resting on `$?` after a pipe is plumbing. **Read the output, or capture `RC` before piping — just never read one and claim the other.**

> **Verifying a copy is not verifying the artifact.** A checksum proves the copy matches the source. It cannot prove the source is well-formed. This very table was once broken by a blockquote inserted mid-table — checksums across 17 locations all matched, and all 17 were equally broken. When you distribute something, check that the *thing itself* still works, not just that the bytes travelled.

---

## The root: two states, one observation

Every entry in that table is one defect wearing a mask:

> **Two different states producing the same observation.**

Hung and working both show uptime. Full and empty both show `[]`. A real pass and a no-op both show green. Idle and dead both show silence. **The fix is always the same shape: make the two states produce DIFFERENT observations.** That is *why* a detector prints a count, why a negative control must actually go red, why `quiet hours, idle` beats silence.

**Corollary — the observer test.** *A report nobody receives is not a report.* The check is whether the observer can see it, not whether you produced it. Work logged only to a transcript is invisible work.

## Negative results are the dangerous ones

**A negative result is a claim about your TOOL as much as about the world.** "Zero hits" asserts the search reached everywhere it says it did — and **nothing in the output distinguishes "nothing there" from "did not look."**

> **A search returning hits is self-evidencing — the hits prove the probe reached. A search returning nothing proves nothing about anything until you make it find something.** The positive control is not extra rigour reserved for important claims; **it is the only thing that turns a zero into data at all.**

**The base rate justifies that.** In one day on this machine: **four zeros investigated, four were broken probes** — shell quoting ate a pattern, a `find` flag was broken on this box, a gitignore-aware wrapper skipped the tree, a regex was simply wrong. **Two no-hit claims held under re-check.** At roughly 2-to-1 against, a zero here is *more likely* to be tool failure than genuine absence. **The four had four unrelated causes, so no list of known-bad commands covers it** — only the habit does.

| The claim | How it lied to us |
|---|---|
| `grep -c 'case "sam"'` returned **0** | Shell quoting ate the pattern. Nearly used it to "correct" a true claim. |
| `find -newermt "-30 days"` returned **0** | Broken on this box — returned 0 with a 2-day-old file in the tree. |
| wrapped `grep -r` returned **0** from the repo root | `grep` is a **shell function** wrapping a gitignore-aware searcher, and `orgs/` is gitignored. Raw binary found **61** where it found **35**. |
| `security find-generic-password … \| head -c 20 && echo found` | `head` succeeds on empty input, so `&&` fired on a **blank** value. |
| `system_profiler SPUSBDataType` returned nothing | It returned **0 bytes** — the command produced nothing, not a finding of nothing. |

**Rules that follow:**
- For any *"this exists nowhere"* claim, use **`/usr/bin/grep`** explicitly (or `find … -exec /usr/bin/grep`). The wrapped `grep` is fine for *"does this exist somewhere"* — never for *"this exists nowhere."* Naming a gitignored file **explicitly** is safe; **recursive traversal** is the hazard.
- **State the root you searched from, and make it the repo.** *"No remaining occurrences"* is meaningless without *"in what."* Two real misses came from sweeping a subdirectory and reporting it as repo-wide — a sibling Apple Watch target and a sibling UI-test target, each one level up from where the reasoning was happening.
- **Empty output is not a result until you have confirmed the tool ran.**
- **An empty result is evidence only if you know the search looked where you think it did.** The `grep` wrapper breaks the *where* **silently**; a wrong root breaks it **loudly if you check** — and checking is the step that gets skipped.

> **The pair, and neither substitutes for the other: STATE THE ROOT, and MAKE THE PROBE FIND SOMETHING.** One covers looking in the wrong place, the other covers not looking at all. The two worst misses of that day were **wrong-scope NON-zeros** — sibling directories one level up — which a positive control would never have caught, only stating the root would.

## When to spend a second derivation

Cross-checking everything is unaffordable, so triage:

> **A claim earns a second derivation when its failure is BOTH silent AND load-bearing.**

**Silent** = the wrong answer looks exactly like the right one. **Load-bearing** = something downstream commits on it — you delete files, report all-clear, tell someone it's done, **stop looking.** A build that either compiles or doesn't needs nothing. The expensive claims are always the same shape: *nothing remains*, *everything is healthy*, *the file does not exist*. **All of them are permission to stop looking**, which is what makes a wrong one so costly.

The second derivation need not be clever, only **independent** — it must fail for a *different reason* than the first. Everything caught in one day of this came from arithmetic that wouldn't reconcile, reading the file a claim was about, or two probes disagreeing. **None came from a system reporting a problem, because none of these report problems.**

**When two probes disagree, stop.** Do not resolve it toward the tidier narrative — the convenient reading is the one to distrust.

## Relay and reversal

- **The originating record beats the summary. The channel-holder beats both. Anything relayed carries a marker saying which it is** — fact vs inference, verified vs assumed. A summary is always cheaper than the source, so the pull toward relaying is *structural*, not a lapse; a one-clause provenance marker fixes what "be more careful" cannot.
- **The thing no code contains is what a person was TOLD.** For that, the source of truth is the agent standing in the channel — ask it, don't diagnose it.
- **On a reversal, notify by who ACTS on it, ordered by who touches a human.** The agent furthest out on a channel is the likeliest to be missed and the costliest to miss: **highest blast radius, lowest visibility.** Then ask each what they last told their human.
- **A receipt is not a delivery.** A send returning an id proves the message was *written*, not *routed*.
- **"Absent" is not "empty."** A path that cannot be read and a container with nothing in it are different states; collapsing them into a pass is how an unread inbox reports clean.
- **"Handled" and "understood" are not the same state.** Diagnosing a problem thoroughly is not fixing it — and a thorough writeup is the most compliance-looking artifact there is.

## Do not report an intention as an outcome

**Write first, then claim, and verify by reading back.**

Every other failure here is a tool or a path lying quietly. This one is different and **no instrument can catch it**: an agent wrote *"adopted and written into MEMORY.md"* while composing the message that promised it. The file did not contain the rule. **The write did not error, because it was never attempted.** Nothing failed, so nothing reported a failure.

It happened in the same message that correctly diagnosed *"a negative result is a claim about your tool"* — **the same defect, opposite sign, one paragraph apart.** Asserting a positive result about a file nobody had looked at.

Watch for the tense slipping while you type: *"fixed"*, *"written"*, *"added"*, *"deployed"* — said about the thing you are, at that moment, still intending to do. **The gap between intending and doing closes silently.**

## Scope honesty

**Never narrow scope with an exclusion flag and then report the wide scope.** One agent ran `grep -v "^./memory/"` and reported *"clean across every file I own."* It happened to be true; it was not checked. **Three separate agents' blind spot that day was their own `memory/` directory** — one excluded it by hand, two had it silently skipped by the tool.

**And a count taken while others are editing is not a total.** Two agents got 61 and 59 on the same fleet sweep minutes apart. Not a contradiction — files were changing under both. A live count is evidence that *something exists*, never evidence of *how many*.

---

## Step 5 — Correct a claim whose method was luckier than its wording

If you already reported something and then realise **your method couldn't have proven it** — even if the claim turned out true, and even if nobody would ever have checked — say so and re-verify properly.

This is not scrupulousness, it's the process. A report is only worth the method behind it, so a claim that was right by luck has the same value as one that was wrong: zero, until re-verified. The moment to do this is exactly when it feels unnecessary, because that's the condition where it's cheap for you and valuable for whoever is relying on it. If it only happens when someone feels virtuous, every report is worth less than it looks.

Say which part was luck, re-run it correctly, and report the new result — not the reassurance.

## Step 6 — State the residual honestly

Close with what you did **not** verify. "Tested on desktop Chrome only, not mobile Safari" or "verified locally, not against prod data." Silence implies total coverage and that's how false confidence spreads.

---

## Anti-patterns

- "The code looks correct" → not verification
- "Tests pass" *when the tests don't cover the change* → check the test actually exercises it
- Verifying only as the owner/admin
- Reporting success while a background job is still running
- Accepting a subagent's claim without re-running it

## Pattern-level edits need a semantic check

**A find-and-replace applied where only MEANING decides correctness will be wrong somewhere, and you will not see it.**

Two instances in one hour, and they are **one failure, not two**:
- Stripping a dead flag from `kb-ingest` calls **also stripped it from `kb-query` calls** — a different command that happened to share the flag name. (It was dead there too. **Right answer, reached by assumption, verified after acting.**)
- The same sweep **stripped the flag out of the WARNING that existed to name it**, leaving `previously carried \`\`.` — a warning about a flag it no longer identifies. **A regex cannot tell an instruction from a warning about that instruction, and the warning is the one nobody re-reads to notice.**

**Before a pattern-level edit, ask what distinction actually decides correctness** — instruction vs. warning, this command vs. that one, live vs. dead code — **and confirm the pattern ENCODES it, not merely CORRELATES with it.** If it cannot, enumerate and edit by hand.

> **The distinction, stated so it survives paraphrase (wyckoff, 2026-07-26):** a regex for `--collection` **correlates perfectly** with *"mentions the dead flag"* and **not at all** with *"is telling you to use it."* **Perfect correlation with the wrong property is exactly what makes the edit feel safe.**

**Two habits that follow:**
- **Check whether a "bad flag" is a missing FEATURE before deleting the callers.** Deleting a caller makes the symptom vanish and takes the capability with it.
- **When repairing text that quotes a broken thing, reword rather than re-inserting the literal string** — otherwise the next blanket sweep blanks it again.
