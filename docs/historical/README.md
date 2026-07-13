# Historical / submission-era documents

This folder preserves documents written for specific Stellar Development
Foundation submission cycles and the Build On Stellar / IBW 2026 hackathon.
They are kept for **provenance only** — they are **not** the current source of
truth for the project's positioning, roadmap, or commercial wedge.

For the **current** project narrative, start with:

- [`README.md`](../../README.md) — project overview and proof surface
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — system architecture and trust boundaries
- [`TECH_DESIGN.md`](../TECH_DESIGN.md) — cryptography, storage, settlement rails
- [`THREAT_MODEL.md`](../THREAT_MODEL.md) — adversary analysis
- [`LIMITATIONS.md`](../LIMITATIONS.md) — honest scope boundaries
- [`PILOT_PLAYBOOK.md`](../PILOT_PLAYBOOK.md) — current pilot scope and outreach
- [`INTEGRATION.md`](../INTEGRATION.md) — embedding the primitive in another Stellar app
- [`RECEIPTS.md`](../RECEIPTS.md) — round receipts and offline verification
- [`ECOSYSTEM.md`](../ECOSYSTEM.md) — Passkey-Kit, Smart Account Kit, OZ Relayer notes
- [`DEPLOY.md`](../DEPLOY.md) — UI build vs runtime secrets
- [`DEMO_SCRIPT.md`](../DEMO_SCRIPT.md) — 5-minute jury walkthrough

## Documents preserved here

| Doc | Original submission | Purpose |
| --- | --- | --- |
| [`SCF_PLAN.md`](./SCF_PLAN.md) | SCF #44 Build Award | SCF #44 build framing, tranches, deliverables, ecosystem value (historical — see `../PILOT_PLAYBOOK.md` for current scope) |
| [`SCF_TRANCHE_PLAN.md`](./SCF_TRANCHE_PLAN.md) | SCF #44 Build Award | SCF tranche plan with verification artifacts and acceptance criteria (historical) |
| [`TRACK_ANSWERS.md`](./TRACK_ANSWERS.md) | Build On Stellar / IBW 2026 | Hackathon track mapping and proof pointers (historical — for current proof surface see `../../README.md` § Proof at a glance) |
| [`CV_LABS_APPLICATION.md`](./CV_LABS_APPLICATION.md) | Stellar × CV Labs Accelerator (2026) | Accelerator application draft (historical — see `../PILOT_PLAYBOOK.md` for current GTM scope) |

These files retain their original authors, draft numbers, and submission-cycle
language. **Do not edit** the contents of these files for current positioning
— open a pull request against `../README.md`, `../ARCHITECTURE.md`, or another
current doc instead.

## Accepted: navigation-only preamble above the H1

A short Markdown blockquote preamble at the very top of a historical doc (above its H1, before the existing first paragraph) is allowed when:

- The preamble is a single `>` blockquote paragraph — it shares no heading numbering with submission sections, so the original section numbering stays intact.
- It explicitly states the body below is the original submission text preserved verbatim, so a reader can see at a glance that no body rewrites happened.
- It is a *navigation note* (forward-link list pointing at live docs that hold today's narrative) rather than a rewrite of submission-era positioning.
- Forward-links must resolve when the policy is applied, validated by `scripts/check-links.js`. Links to docs that arrive in a later PR are deferred rather than embedded as broken targets.

PR [#6 `chore/docs-historical-preambles`](https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/pull/6) is the first applied case and demonstrates the four rules above. Submission-era wording remains untouched under the existing "do not edit" rule.
