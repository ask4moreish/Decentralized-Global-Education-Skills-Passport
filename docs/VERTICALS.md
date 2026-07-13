# Verticals

> Authoritative reference for which applications the same Soroban
> sealed commit–reveal primitive supports — today, in progress, or referenced
> in submission-era docs. For the **project narrative**, start with
> [`README.md`](../../README.md) and
> [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## How to read this doc

Every section names three things:

- **Layer** — Application (code above the contract, in `examples/` or
  `services/`) vs. Protocol (the on-chain contract itself, which is generic).
- **Proof today** — the strongest automated proof that ships in this repo, or
  a historical submission doc when no on-tree proof exists yet.
- **Components used** — which `packages/*` and `services/*` power it.

Every row uses the **same** primitives: `packages/tlock` (Drand seal helpers),
`packages/sdk` (Stellar client + receipt codec), `services/keeper`
(permissionless lifecycle driver). **No vertical requires a contract change** —
the WASM at `contracts/round` is a generic sealed-commit–reveal state machine.

---

## Sealed grants / scoring

- **Layer:** Application (`examples/grant-scoring`)
- **Proof today:** Two layered pieces of evidence — (a) the
  `examples/grant-scoring` package runs **offline as a fixture**
  (`pnpm grant-scoring:test`, no live RPC credentials required) and exercises
  the sealed-scoring lifecycle deterministically against pre-canned judge
  scores; (b) the underlying primitive lifecycle is proven by
  `pnpm lifecycle:e2e` (2 sealed bidders, USDC SAC, settle → 0 on Stellar
  testnet) — the same state machine the grants example runs on top of.
- **Components used:** `packages/tlock` · `packages/sdk` · `services/keeper`
  · `examples/grant-scoring`.
- **Note:** Structurally identical to a sealed-bid auction; only the clearing
  rule (`HighestBid` → weighted-preference sum over scored proposals) and the
  off-modal value type differ.

## Sealed RFPs / procurement

- **Layer:** Application
- **Proof today:** Two layered proofs — (a) **`pnpm appraisal:e2e`**
  proves the **x402 appraisal micro-payment rail**:
  HTTP 402 → facilitator → on-chain USDC settle of the appraisal fee on
  Stellar testnet (`services/appraisal-api/scripts/x402-e2e.ts`); (b) the
  **sealed-bid + appraisal + settle** end-to-end is proven by
  `pnpm agents:e2e` (multi-agent flow: appraisal server → x402 pay →
  sealed commit → keeper reveal → settle → 0 on a single testnet
  contract, with the canonical UI trace produced). The underlying
  primitive lifecycle alone is proven by `pnpm lifecycle:e2e`.
- **Components used:** `packages/tlock` · `packages/sdk` · `services/keeper`
  · `services/appraisal-api` (x402-gated fair-value feed consumed by
  agents before the sealed commit) · `services/agent`.
- **Note:** Two payment rails: **x402** powers the appraisal micro-payment;
  the **contract `settle()`** moves the winner prize via SAC (`settle()` is
  *not* an x402 flow). See
  [§ Two payment rails](../../ARCHITECTURE.md#two-payment-rails-same-sep-41-asset-different-jobs).

## Sealed auctions

- **Layer:** Application (`services/auction-template`)
- **Proof today:** End-to-end SDK + keeper + tlock wiring that ships
  type-checked and unit-tested locally; e2e via
  `bash services/auction-template/testnet.sh`.
- **Components used:** `packages/tlock` · `packages/sdk` · `services/keeper`
  · `services/auction-template` · `services/agent`.
- **Note:** Identified as the primary commercial wedge in the historical CV
  Labs accelerator application — see
  [`./historical/CV_LABS_APPLICATION.md`](./historical/CV_LABS_APPLICATION.md).

## Sealed credential portfolios *(planned — partner-led pilot)*

- **Layer:** Application (the on-chain contract stays generic — no change)
- **Proof today:** **None in-tree.** No `examples/credentials-portfolio`
  package ships in this repo yet. The closest working analog is the offline
  **receipt verifier** UI in `apps/web` (covered by the verifier-UI test
  suite in `apps/web/src/verify/{buildExportBundle,permalink}.test.ts`),
  which already exercises the same `packages/sdk` receipt codec on round
  receipts exported by the core primitive.
- **Planned components used:** `packages/tlock` · `packages/sdk` ·
  `services/keeper` (unchanged from any other vertical).
- **Pilot:** [`PILOT_PLAYBOOK.md` § Pilot 2 — Sealed credential portfolio
  (partner-led candidate)](./PILOT_PLAYBOOK.md) outlines the workflow
  sketch (issuer → holder → verifier), the partner-sketch categories
  (skills/credentials platforms, LMS / course providers, education
  consortia), and what's in scope vs. what's reserved for a follow-on
  tranche (W3C Verifiable Credentials **data-model alignment**, native
  issuer onboarding, revocation registries). **No partner confirmed
  yet** — section is scope-only.

## Sealed DAO voting *(submission-era reference)*

- **Layer:** Application — DAO governance adapter
- **Proof today:** Referenced in the historical hackathon track mapping at
  [`./historical/TRACK_ANSWERS.md`](./historical/TRACK_ANSWERS.md). No in-tree
  proof ships; this is preserved as a stretch vertical for when the same
  primitive is reused for governance.
- **Components used:** the same primitives — `packages/tlock` ·
  `packages/sdk` · `services/keeper`.
- **Note:** Vote values are sealed to a future Drand round; the clearing rule
  maps to a tallying function (e.g. one-address-one-vote, weighted vote, or
  quadratic). The same on-chain WASM acts as a generic vote-state machine.

---

## On namespaces

The npm scope (`@decentralized-global-education-skills-passport/*`), the Rust
crate (`skills-passport-round`), and the TS class names
(`SkillsPassportClient`, `SkillsPassport*Error`) deliberately retain the
legacy "Decentralized Global Education & Skills Passport" branding. Two
reasons:

1. **On-chain hash stability.** Renaming the Rust crate changes the compiled
   WASM SHA256. The contract already deployed to Stellar mainnet
   ([`CA7KS…ODEX`](https://stellar.expert/explorer/public/contract/CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX))
   and the testnet lifecycle provenance trace reference those names.
2. **External references.** The Build On Stellar / IBW 2026 1st-place win
   and the SCF #44 / CV Labs submission cycle reference the same
   identifiers in public materials.

The README explicitly surfaces both constraints so a first-time reviewer who
asks "why does the code name not match the docs?" finds the answer pre-stated
in `README.md` (above), here, and in
[`PILOT_PLAYBOOK.md`](./PILOT_PLAYBOOK.md).

---

## Where to go next

- System map, lifecycle, and trust boundaries —
  [`ARCHITECTURE.md`](../../ARCHITECTURE.md).
- Adversary analysis per layer (operator, keeper, agent, auditor) —
  [`THREAT_MODEL.md`](./THREAT_MODEL.md).
- Honest scope boundaries (mainnet ≠ full USDC, mandate caps off-chain) —
  [`LIMITATIONS.md`](./LIMITATIONS.md).
- Adding a new vertical — see the workspace recipe in
  [`PILOT_PLAYBOOK.md`](./PILOT_PLAYBOOK.md).
