# Legacy dashboard (pre-installer) — reference only

This folder preserves the **original 6-tab ImplementationOS dashboard** that
existed before the project pivoted to the installer-style guided configurator.
It is kept here as reference so the scaffolding is not lost. **It is not wired
into the live app.**

## What it was

A dense, everything-visible dashboard with six screens:

| Screen | What it held |
| --- | --- |
| Journey | Guided wizard + the live semantic-graph preview + step map |
| Archetypes | The 16 planning archetypes (full constraint/model/example data) |
| Data Model | `dataObjectGroups` (APS) + `mesObjectGroups` (MES execution/EBR/quality) |
| Routings | Archetype routing packs, phase chips, cleaning routings, rules |
| **Intelligence** | Impact graph, semantic object count, **data-readiness metrics**, training signal, latest-impact list, meeting intelligence, branch/decision panel |
| **Delivery** | The **documentation cockpit**: `deliverableJourney` (Discover → Blueprint → Build → Govern → Validate → Launch) with every artifact (kick-off deck, blueprint, RACI, user stories, CR/decision/RAID logs, UAT/E2E, GPT, cutover, training pack, hypercare runbook…), plus the readiness pipeline board |

The pieces specifically asked about — the **intelligence metrics** and the
**documentation/Delivery page** — live in `renderIntelligence`,
`renderDeliveryScreen`, `renderReadinessStage`, and the `deliverableJourney`
data structure inside `app.js`.

## Dependencies

This snapshot relies on files that still live in the worktree root and were
**not** changed by the pivot:

- `../../model.js` — the event-sourced semantic graph (unchanged)
- `../../packs.js` — archetype content packs (unchanged)
- `../../styles.css` — the dashboard CSS classes are the **baseline portion**
  of the current stylesheet (`.screen`, `.journey-*`, `.intelligence-*`,
  `.data-object-*`, `.routing-*`, `.deliverable-*`, etc.); the installer CSS
  was appended after them, so both coexist in one file.

## How to run it (if ever revived)

From the `claude/` worktree, temporarily point an HTML entry at these files —
e.g. copy `index.html` + `app.js` here over the worktree root copies (which
currently hold the installer) and serve, or open this `index.html` with the
script `src` paths adjusted to `../../model.js` / `../../packs.js`.

## Provenance

Reconstructed verbatim from the dashboard state captured at the start of the
session in which the installer pivot happened. It reflects the dashboard
**before** that session's in-flight genesis/branch-panel experiments (those
were transitional and were superseded by the installer). The dashboard was
never committed to git on its own, which is why this reference copy exists.
