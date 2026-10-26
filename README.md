<p align="center">
  <img src="./assets/decentralized-global-education-skills-passport-readme.png" width="250" alt="Decentralized Global Education & Skills Passport logo" />
</p>

<p align="center">
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions?query=branch%3Amain"><img src="https://img.shields.io/github/checks-status/ask4moreish/Decentralized-Global-Education-Skills-Passport/main?label=CI" alt="CI status" /></a>
</p>

<p align="center">
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/bindings-check.yml"><img src="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/bindings-check.yml/badge.svg" alt="Bindings check" /></a>
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/examples-typecheck.yml"><img src="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/examples-typecheck.yml/badge.svg" alt="Examples typecheck" /></a>
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/fixture-drift.yml"><img src="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/fixture-drift.yml/badge.svg" alt="Fixture drift guard" /></a>
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/fixture-sizes-check.yml"><img src="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/fixture-sizes-check.yml/badge.svg" alt="Fixture sizes" /></a>
  <br>
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/css-tokens-check.yml"><img src="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/css-tokens-check.yml/badge.svg" alt="CSS tokens &amp; classes" /></a>
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/threat-model-check.yml"><img src="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/threat-model-check.yml/badge.svg" alt="Threat model anchors" /></a>
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/deploy-docs-check.yml"><img src="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/deploy-docs-check.yml/badge.svg" alt="Deploy docs consistency" /></a>
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/docs-links.yml"><img src="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/docs-links.yml/badge.svg" alt="Docs link check" /></a>
</p>

# Decentralized Global Education & Skills Passport

**A decentralized, verifiable educational credential and skills passport platform built on Stellar Soroban.**

The platform allows educational institutions, universities, training providers, learners, and employers to issue, manage, share, and independently verify educational credentials, certifications, and verified skills on the Stellar blockchain without depending entirely on any single institution's private database.

> **Core Philosophy:** People should be able to prove what they have learned and what they can do anywhere in the world, with zero personally identifiable information (PII) leaked on public ledgers, full cryptographic hash commitments, auditable on-chain revocation lifecycles, and W3C Verifiable Credentials interoperability.

```bash
pnpm install
pnpm web:dev              # Launches the Education Passport & Verifier UI
pnpm test                 # Runs all 242 contract, SDK, and web tests
pnpm passport:test        # Soroban skills-passport-core contract tests (13 scenarios)
pnpm contract:test        # Soroban sealed-allocation contract tests (58 tests)
```

---

## What's in the box

| Layer | Path | Purpose |
| --- | --- | --- |
| **Passport Contract** | [`contracts/passport`](contracts/passport) | **Core Soroban Primitive**: Authorized issuer registry, W3C credential hash commitments, revocation & suspension lifecycle, and independent on-chain verification |
| **Allocation Contract** | [`contracts/round`](contracts/round) | **Sealed Allocation Primitive**: Confidential commit-reveal coordination round with Drand timelock & SAC settlement |
| **TypeScript SDK** | [`packages/sdk`](packages/sdk) | Full W3C Verifiable Credential builder, JCS canonical hashing (SHA-256), selective disclosure, QR sharing, and `EducationPassportClient` |
| **Web Application** | [`apps/web`](apps/web) | Interactive React 19 app featuring: **Learner Passport Vault**, **Institution Issuance & Revocation Console**, and **Employer Verifier Portal** |
| **Crypto Package** | [`packages/tlock`](packages/tlock) | Drand timelock encryption and BLS12-381 verification utilities |
| **Keeper Service** | [`services/keeper`](services/keeper) | Permissionless automated execution daemon for blockchain coordination rounds |

---

## User Journeys

### 1. Learner Passport
- Connect supported Stellar wallets (Freighter or simulated testnet keypairs).
- View verified credentials, university degrees, certificates, and skills badges with cryptographic proof anchors.
- Selectively disclose specific competencies without revealing unrelated transcript details.
- Generate live SVG QR codes and shareable verification links for job applications.
- Export interoperable W3C Verifiable Credential JSON files.

### 2. Educational Institution & Issuer
- Establish an authorized institutional identity in the Soroban issuer registry.
- Issue tamper-evident credentials mapped to learner Stellar addresses (`did:stellar:...`).
- Commit 32-byte SHA-256 cryptographic digests to Soroban storage while keeping student PII private.
- Auditable revocation and temporary suspension controls with mandatory audit trail notes.

### 3. Employer & Verifier
- Scan QR code or paste verification link / W3C VC JSON.
- Verify credential authenticity against Soroban ledger state in milliseconds.
- Clearly distinguishes:
  - 🟢 **Valid & Authentic**: Cryptographically sound, issuer verified, active on ledger.
  - 🔴 **Revoked**: Formally rescinded by the institution with recorded reason.
  - 🟠 **Expired**: Past validity window.
  - ⚠️ **Tampered / Forged**: Cryptographic hash mismatch detected!
  - ⛔ **Untrusted Issuer**: Issuing entity is not authorized on-chain.

---

## Privacy & Blockchain Architecture

1. **Zero On-Chain PII**: Student names, national IDs, grades, and detailed descriptions are **never stored on public ledger storage**.
2. **Deterministic Cryptographic Commitments**: Credentials follow the W3C Verifiable Credentials standard. The canonical JSON payload is hashed using SHA-256 (RFC 8785 canonicalization), and only the resulting 32-byte digest is anchored on Soroban.
3. **Auditable Revocation Lifecycle**: Institutions retain the ability to revoke or suspend compromised or erroneous credentials on-chain, immediately visible to verifiers worldwide.
4. **Strict Soroban Authorization**: Only approved institution identities (`issuer.require_auth()`) or administrators can issue or revoke credentials.

---

## Quickstart

```bash
# 1. Install dependencies
pnpm install

# 2. Run all tests
pnpm test

# 3. Launch the web UI
pnpm web:dev
```
Open `http://localhost:5173` to interact with the **Skills Passport**, **Institution Portal**, and **Employer Verifier**.
| **Bindings** *(generated)* | [`packages/round-bindings`](packages/round-bindings) | [![npm](https://img.shields.io/npm/v/round-bindings)](https://www.npmjs.com/package/round-bindings) | TypeScript bindings generated from the contract WASM |
| **SDK** | [`packages/sdk`](packages/sdk) | [![npm](https://img.shields.io/npm/v/skills-passport-sdk)](https://www.npmjs.com/package/skills-passport-sdk) | `SkillsPassportClient`, encoding, optional OpenZeppelin Channels submitter |
| **Receipts** | `services/receipt-cli` | — | Export and offline-verify round receipts (no RPC, no secrets) |
| **Keeper** | `services/keeper` | — | Permissionless reveal/clear/settle + watch mode + status HTTP API |
| **Appraisal** | `services/appraisal-api` | — | x402-gated deterministic valuation (USDC SAC) |
| **Agent** | `services/agent` | — | Mandate + cap-checked sealed-bid agents |
| **Template** | `services/auction-template` | — | Sealed-auction integration template (SDK + keeper + tlock e2e) |
| **Drand harness** | `services/drand-tools` | — | Risk-2 harness: validate tlock ↔ Drand ↔ on-chain BLS |
| **UI** | `apps/web` | — | Jury demo — embedded trace, observer, attack labs, Drand beacon monitor |
| **Example** | `examples/grant-scoring` | — | Sealed grant scoring pilot template |

---

## Proof at a glance

| Layer | Command | Network | What it proves |
| --- | --- | --- | --- |
| **Full product** | `pnpm lifecycle:e2e` | Testnet | 2 bidders, USDC SAC, keeper settle → contract **0** |
| **Multi-agent** | `pnpm agents:e2e` | Testnet | Mandate + x402 + keeper reveal + settle → **single UI trace** |
| **x402 appraisal** | `pnpm appraisal:e2e` | Testnet | HTTP 402 → on-chain USDC settle |
| **Mainnet smoke** | `pnpm mainnet:deploy` + `pnpm mainnet:settle` | Mainnet | Deploy, BLS, settle on **real XLM** |
| **Mainnet verify** | `pnpm mainnet:verify` | Mainnet | Read-only check of settled round 1 |

See [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) for honest scope boundaries.

## Deployed artifacts

### Mainnet (settlement smoke)

| Field | Value |
| --- | --- |
| Contract | [`CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX`](https://stellar.expert/explorer/public/contract/CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX) |
| WASM hash | `353915ad440965ea5f8d92fdb8d93cb2e309fb365e68e6762bca7fd6762b30c7` |
| Round | 1 · **Settled** |
| Drand R | 29,174,905 |
| Token | Native XLM SAC |
| Bid / escrow | **1 XLM / 5 XLM** |

```bash
pnpm mainnet:ready -- --strict   # consolidated read-only readiness
pnpm mainnet:verify              # read-only — no secrets
pnpm mainnet:micro               # dry-run checklist
```

### Testnet (full product + UI trace)

| Field | Value |
| --- | --- |
| Contract (UI / agents:e2e) | [`CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y`](https://stellar.expert/explorer/testnet/contract/CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y) |
| Drand R | 29,176,840 |
| Canonical trace | `apps/web/src/demo/demo-trace.generated.ts` (from `pnpm agents:e2e`) |

---

## Install (as a dependency)

Three packages are published to npm:

| Package | Install | Pulls in |
| --- | --- | --- |
| [`skills-passport-sdk`](packages/sdk) | `npm install skills-passport-sdk` | ✅ tlock · ✅ round-bindings |
| [`skills-passport-tlock`](packages/tlock) | `npm install skills-passport-tlock` | — |
| [`round-bindings`](packages/round-bindings) | `npm install round-bindings` | — |

**In most cases, just install the SDK** — it declares `tlock` and `round-bindings` as
dependencies and installs them automatically. Install `tlock` separately only if
you need direct access to the seal/unseal APIs without the client.

```ts
import { SkillsPassportClient } from "skills-passport-sdk";
import { sealBid, quicknet } from "skills-passport-tlock";

const client = new SkillsPassportClient({
  rpcUrl,
  networkPassphrase,
  contractId,
  secretKey,
});

const sealed = await sealBid({
  value,
  nonce,
  round: revealRound,
  client: quicknet(),
  identity,
  auditorPublicKey,
});

await client.commit({ roundId, sealed, escrow });
```

## Verticals supported by the same primitive

The same Soroban primitive supplies sealed commit–reveal fairness for any
workflow where leaking inputs mid-decision creates an unfair advantage. Five
verticals ship, are scoped, or are documented:

- **Sealed grants / scoring** — `examples/grant-scoring` (offline fixture pilot) + `pnpm lifecycle:e2e` (generic 2-bidder USDC sealed-bidder primitive e2e, settle → 0)
- **Sealed RFPs / procurement** — `pnpm appraisal:e2e` (x402 appraisal micro-payment rail) + `pnpm agents:e2e` (multi-agent flow: appraisal → sealed commit → settle)
- **Sealed auctions** — `services/auction-template` (end-to-end SDK + keeper + tlock wiring)
- **Sealed credential portfolios** *— planned, application layer; no example ships in this repo yet*
- **Sealed DAO voting** *— submission-era reference only; same primitive, no in-tree proof, see `docs/VERTICALS.md`*

For the layer each vertical lives at, today's proof, and the components it
exercises, see **[`docs/VERTICALS.md`](./docs/VERTICALS.md)** — the authoritative reference.

## Status

- [x] Round contract + 14 tests + on-chain Drand BLS
- [x] tlock + auditor blob (13 tests)
- [x] SDK + optional OZ Relayer Channels submitter
- [x] Testnet **full lifecycle** — USDC, 2 bidders, settle → 0
- [x] Testnet **multi-agent** — x402, mandate, keeper reveal, settle → 0
- [x] Mainnet **deploy + settle smoke** — 1/5 XLM, round 1 settled
- [x] Mainnet **verify** + **micro runner** (dry-run default)
- [x] Jury UI — canonical testnet trace, live round mode, Drand beacon monitor
- [x] Watch-mode keeper (`pnpm keeper:watch`)
- [x] Round receipts — export, offline verify, redaction, fixtures

## Documentation

| Doc | Purpose |
| --- | --- |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System overview, lifecycle, trust boundaries, repo map |
| **[`docs/VERTICALS.md`](./docs/VERTICALS.md)** | Authoritative verticals reference — sealed grants / RFPs / auctions / credentials / DAO voting |
| [docs/INTEGRATION.md](./docs/INTEGRATION.md) | How another Stellar app embeds the sealed round primitive |
| [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md) | Cryptography, storage, settlement rails |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversaries, mitigations, honest limits |
| [docs/RECEIPTS.md](./docs/RECEIPTS.md) | Portable round receipts, offline verify, redaction |
| [docs/ECOSYSTEM.md](./docs/ECOSYSTEM.md) | Passkey-Kit, Smart Account Kit, OZ Relayer |
| [docs/PILOT_PLAYBOOK.md](./docs/PILOT_PLAYBOOK.md) | Pilot scope, demo narrative, partner outreach |
| [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) | 5-minute walkthrough |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | UI build vs runtime secrets |
| [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) | Known scope boundaries |

## Cryptographic design

- **Seal:** Drand tlock IBE, `bls-unchained-g1-rfc9380`
- **Binding:** `H = sha256(value‖nonce)`
- **Unlock:** round-R BLS verified on-chain before reveal
- **Selective disclosure:** values public post-R; identities auditor-encrypted

---

### Archived: submission-era docs

The following documents were written for the Build On Stellar / IBW 2026 hackathon
and the SCF #44 / CV Labs application cycle. They remain in the repo for historical
reference but are not the current source of truth for the project's positioning or
roadmap.

| Doc | Purpose |
| --- | --- |
| [docs/historical/SCF_PLAN.md](./docs/historical/SCF_PLAN.md) | SCF #44 Build framing, tranches, deliverables |
| [docs/historical/SCF_TRANCHE_PLAN.md](./docs/historical/SCF_TRANCHE_PLAN.md) | SCF tranche plan with verification artifacts |
| [docs/historical/TRACK_ANSWERS.md](./docs/historical/TRACK_ANSWERS.md) | Build On Stellar track mapping and proof pointers |
| [docs/historical/CV_LABS_APPLICATION.md](./docs/historical/CV_LABS_APPLICATION.md) | Stellar x CV Labs Accelerator application draft |

---

Licensed under [MIT](./LICENSE).
