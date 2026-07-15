# Changelog

All notable changes to the Decentralized Global Education & Skills Passport monorepo
are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The three publishable packages
([`skills-passport-sdk`](packages/sdk),
[`skills-passport-tlock`](packages/tlock),
[`round-bindings`](packages/round-bindings))
are versioned together as a fixed group — see [`.changeset/config.json`](.changeset/config.json).

---

## [0.1.0] — 2026-06-23 (initial public version)

### Added

#### Core protocol

- **Soroban Round contract** (`contracts/round`) — sealed commit–reveal coordination
  primitive with Drand timelock encryption and on-chain BLS12-381 verification.
  14 Rust tests, 51 snapshot categories.
- **Timelock encryption** (`packages/tlock`) — `sealBid` / `openBid` using Drand
  quicknet (`bls-unchained-g1-rfc9380`), auditor identity blob (X25519 ECDH +
  XChaCha20-Poly1305). 32 tests.
- **TypeScript SDK** (`packages/sdk`) — `SkillsPassportClient` with encoding,
  preflight simulation, encrypted-blob validation, receipt export/verification,
  and optional OpenZeppelin Relayer Channels submitter. 87 tests.
- **Generated contract bindings** (`packages/round-bindings`) — auto-generated
  from the compiled Soroban WASM. 17 snapshot-drift tests.

#### Lifecycle

- **Permissionless keeper** (`services/keeper`) — open reveal, reveal all bids,
  clear, settle, and void rounds. Supports watch mode and dry-run. 63 tests.
- **x402-gated appraisal API** (`services/appraisal-api`) — deterministic
  valuation with USDC micro-payment (HTTP 402). 38 tests.
- **Mandate-capped bidding agents** (`services/agent`) — session-key agents with
  off-chain mandate enforcement. 10 tests.
- **Receipt CLI** (`services/receipt-cli`) — export receipts from RPC, verify
  offline, redact sensitive fields. 19 tests.

#### Proofs & deployment

- **Testnet full lifecycle** — `pnpm lifecycle:e2e` (USDC, 2 bidders, settle → 0)
- **Testnet multi-agent** — `pnpm agents:e2e` (x402, mandate, keeper reveal,
  single UI trace). Won **1st Place in Hack Privacy Track** at Build On Stellar.
- **Mainnet deploy + settle smoke** — 1 XLM / 5 XLM, round 1 settled
- **Mainnet verify + micro runner** — read-only readiness checks, optional
  micro commit with `MAINNET_CONFIRM`
- **Mainnet readiness** — consolidated `pnpm mainnet:ready -- --strict` with
  balance and code-hash checks

#### Web UI

- **Jury demo** (`apps/web`) — lifecycle timeline, observer table, agent + x402
  logs, seal-off vs seal-on attack demo, auditor identity decrypt, mandate cap
  safety lab, passkey-kit integration.
- **Receipt verification page** (`/verify`) — paste a receipt JSON, view
  structured verification results with field-level explainers, sample fixture
  gallery (golden + 6 tampered cases), shareable permalink.

#### Documentation

- **ARCHITECTURE.md** — system diagram, sequence diagram, trust boundaries,
  monorepo layout, planned Stellar Wallets Kit integration.
- **TECH_DESIGN.md** — cryptography (tlock, BLS, auditor blob), storage model
  (Instance / Persistent / Temporary), settlement rails, relayer strategy.
- **THREAT_MODEL.md** — asset inventory, 6 adversary profiles with mitigations
  and residual risks, receipt-verification threat surface.
- **ERRORS.md** — 27 defined error codes with trigger conditions, user-facing
  messages, suggested actions (test‑enforced against the Rust enum).
- **INTEGRATION.md** — embedding guide, preflight simulation, grant-scoring
  template, CLI identity recovery.
- **DEPLOY.md** — three-layer deployment guide (UI / keeper / scripts),
  environment variable reference, mainnet launch checklist.
- **LIMITATIONS.md** — honest scope boundaries: off‑chain mandate caps, mainnet
  XLM vs testnet USDC, receipt verification trust model.
- **ECOSYSTEM.md** — Passkey‑Kit, Smart Account Kit, OZ Relayer, Scaffold
  Stellar integration sketches.
- **PILOT_PLAYBOOK.md** — outreach strategy, SCF‑style demo narrative, OverBlock
  internal pilot plan.

#### CI & tooling- **10 GitHub Actions workflows** — bindings drift check, examples typecheck, fixture drift guard, doc link verification, CSS tokens & class names, threat model anchors, fixture size budgets, deploy docs consistency, deploy to GitHub Pages, npm publish via Changesets.
- **Snapshot integrity** — contract test snapshots, event‑snapshot golden
  fixture, receipt verification fixtures, appraisal fixtures.
- **Script‑based guards** — threat‑model anchor check, deploy‑doc consistency,
  fixture size limits.

### Changed

- **Receipt schema versioning** — `verifyReceipt` now rejects any `version !== 1`
  with an early return (no downstream checks), `computedWinner` is null on
  rejection (Issue #114). See `packages/sdk/src/verify.ts`.
- **Vite dev server hardening** — removed over‑permissive `fs.allow` rule that
  allowed file serving from arbitrary directories (security fix).

### Fixed

- **round-bindings build** — added explicit `rootDir: "./src"` to `tsconfig.json`
  to fix `TS5011` error during `tsc` compilation.

---

## [0.0.0] — Hackathon submission (Build On Stellar, Hack Privacy Track)

Initial submission that won 1st Place in the Build On Stellar Hack Privacy Track.

Notable achievements at this stage:

- Soroban round contract with real Drand BLS verification (no mocks)
- tlock seal/open against live quicknet
- SDK with direct Soroban RPC + optional OZ Channels submitter
- Testnet full lifecycle proof (USDC, 2 bidders, settle → 0)
- Mainnet deploy + settle smoke (native XLM)
- Jury demo UI with embedded canonical trace
- 280+ automated tests across all packages
- Comprehensive threat model and technical documentation

---

[0.1.0]: https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/compare/v0.0.0...v0.1.0
[0.0.0]: https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/releases/tag/v0.0.0
