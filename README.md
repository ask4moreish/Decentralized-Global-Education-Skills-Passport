<p align="center">
  <img src="./assets/decentralized-global-education-skills-passport-readme.png" width="250" alt="Decentralized Global Education & Skills Passport logo" />
</p>

# Decentralized Global Education & Skills Passport

Soroban sealed commit–reveal **coordination primitive** — verifiable,
deterministic, fair rounds for sealed scoring, sealed bidding, sealed RFPs, and
sealed credential portfolios on Stellar. A drop-in contract, TypeScript SDK,
tlock helpers, permissionless keeper, and demo UI let any app run the same
primitive without trusting an operator.

The SDK and contract ship under the legacy
`@decentralized-global-education-skills-passport/*` npm scope and
`skills-passport-round` Rust crate. The brand survives in code identifiers
because renaming the Rust crate would invalidate the Stellar mainnet
contract hash, and the Build On Stellar / IBW 2026 win plus the SCF #44 /
CV Labs submission cycle reference these names in public materials — see
[`docs/VERTICALS.md` § On namespaces](./docs/VERTICALS.md#on-namespaces) for
the full rationale.

Participants submit sealed scores, bids, or allocation decisions **now**. A
public, unbiased Drand round **R** unseals them later, verifiably and all at
once. The protocol owns fairness; the operator cannot read, censor, or reorder
inputs before **R**.

> Built on what's proven. Sealed by math, not by trust.

---

## What's in the box

| Layer | Path | Purpose |
| --- | --- | --- |
| **Contract** | `contracts/round` | Soroban primitive: sealed commit, BLS-verified reveal, SAC settle |
| **Crypto** | `packages/tlock` | Drand tlock seal + auditor blob, byte-compatible with the contract |
| **Bindings** *(generated, used by SDK)* | `packages/round-bindings` | TypeScript bindings generated from the contract WASM |
| **SDK** | `packages/sdk` | `SkillsPassportClient`, encoding, optional OpenZeppelin Channels submitter |
| **Receipts** | `services/receipt-cli` | Export and offline-verify round receipts (no RPC, no secrets) |
| **Keeper** | `services/keeper` | Permissionless reveal/clear/settle + watch mode + status HTTP API |
| **Appraisal** | `services/appraisal-api` | x402-gated deterministic valuation (USDC SAC) |
| **Agent** | `services/agent` | Mandate + cap-checked sealed-bid agents |
| **Template** | `services/auction-template` | Sealed-auction integration template (SDK + keeper + tlock end-to-end) |
| **Drand harness** | `services/drand-tools` | Risk-2 harness: validate tlock <-> Drand <-> on-chain BLS and generate Soroban constants |
| **UI** | `apps/web` | Jury demo — embedded trace, observer, attack labs |
| **Example** | `examples/grant-scoring` | Sealed grant scoring pilot template (projects, judges, ranked receipt) |
| **Docs** | `docs/`, `ARCHITECTURE.md` | Design, threat model, integration, deploy, limitations |

## Install

```bash
npm install \
  @decentralized-global-education-skills-passport/sdk \
  @decentralized-global-education-skills-passport/tlock
```

```ts
import { SkillsPassportClient } from "@decentralized-global-education-skills-passport/sdk";
import { sealBid, quicknet } from "@decentralized-global-education-skills-passport/tlock";

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

The app layer can be a DAO tool, grants platform, auction UI, RFP workflow, or
allocation dashboard. Decentralized Global Education & Skills Passport supplies the
sealed round state machine — see **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the
system map, lifecycle, trust boundaries, and monorepo layout.

## How it works

- **Seal** each bid with Drand timelock encryption (`tlock`) to a future round R.
- **Force-open** at R: BLS12-381 verified **on-chain** — simultaneous reveal.
- **Settle** deterministically. Identities disclosed only to the auditor.

The operator never holds a key that can read a bid early. After R, the Drand
signature is public and the Soroban contract verifies it before opening
reveal. See **[docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md)** for the full
adversary analysis.

---

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
exercises, see **[`docs/VERTICALS.md`](./docs/VERTICALS.md)** — the
authoritative reference.

---

## Proof at a glance

| Layer | Command | Network | What it proves |
| --- | --- | --- | --- |
| **Full product** | `pnpm lifecycle:e2e` | Testnet | 2 bidders, USDC SAC, keeper settle → contract **0** |
| **Multi-agent** | `pnpm agents:e2e` | Testnet | Mandate + x402 + keeper reveal + settle → **single UI trace** |
| **x402 appraisal** | `pnpm appraisal:e2e` | Testnet | HTTP 402 → on-chain USDC settle |
| **Mainnet smoke** | `pnpm mainnet:deploy` + `pnpm mainnet:settle` | Mainnet | Deploy, BLS, settle on **real XLM** |
| **Mainnet verify** | `pnpm mainnet:verify` | Mainnet | Read-only check of settled round 1 |

See [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) for honest scope (mainnet ≠ full
USDC product).

## Deployed artifacts

### Mainnet (settlement smoke)

| Field | Value |
| --- | --- |
| Contract | [`CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX`](https://stellar.expert/explorer/public/contract/CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX) |
| WASM hash | `353915ad440965ea5f8d92fdb8d93cb2e309fb365e68e6762bca7fd6762b30c7` |
| Round | 1 · **Settled** |
| Drand R | 29,174,905 |
| Token | Native XLM SAC |
| Bid / escrow | **1 XLM / 5 XLM** (not testnet 700 USDC demo) |

```bash
pnpm mainnet:ready -- --strict   # consolidated read-only readiness
pnpm mainnet:verify          # read-only — no secrets
pnpm mainnet:micro           # dry-run checklist; --execute needs MAINNET_CONFIRM
```

### Testnet (full product + UI trace)

| Field | Value |
| --- | --- |
| Contract (UI / agents:e2e) | [`CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y`](https://stellar.expert/explorer/testnet/contract/CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y) |
| Drand R | 29,176,840 |
| Canonical trace | `apps/web/src/demo/demo-trace.generated.ts` (from `pnpm agents:e2e`) |

---

## Quick start

```bash
pnpm install
pnpm contract:test          # 14 Rust tests
pnpm bindings:generate      # generate TS bindings from the contract
pnpm bindings:check         # verify committed bindings match the contract
pnpm web:dev                # jury UI — works without .env
pnpm agents:e2e             # testnet full agent proof (needs stellar keys)
pnpm mainnet:verify         # mainnet read-only proof
```

## Documentation

| Doc | Purpose |
| --- | --- |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System overview, lifecycle, trust boundaries, repo map |
| [`docs/VERTICALS.md`](./docs/VERTICALS.md) | Authoritative verticals reference — sealed grants / RFPS / auctions / credentials / DAO voting |
| [docs/INTEGRATION.md](./docs/INTEGRATION.md) | How another Stellar app embeds Decentralized Global Education & Skills Passport |
| [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md) | Cryptography, storage, settlement rails |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversaries, mitigations, honest limits |
| [docs/RECEIPTS.md](./docs/RECEIPTS.md) | Portable round receipts, offline verify, redaction |
| [docs/ECOSYSTEM.md](./docs/ECOSYSTEM.md) | Passkey-Kit, Smart Account Kit, OZ Relayer |
| [docs/PILOT_PLAYBOOK.md](./docs/PILOT_PLAYBOOK.md) | Pilot scope, demo narrative, partner outreach |
| [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) | 5-minute walkthrough |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | UI build vs runtime secrets |
| [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) | Known scope boundaries |

### Historical / submission-era

These documents were written for the Build On Stellar / IBW 2026 hackathon and
the SCF #44 / CV Labs application cycle. They remain in the repo for provenance
and historical reference, but are not the current source of truth for the
project's positioning, roadmap, or commercial wedge.

| Doc | Purpose |
| --- | --- |
| [`docs/historical/SCF_PLAN.md`](./docs/historical/SCF_PLAN.md) | SCF #44 Build framing, tranches, deliverables, ecosystem value (historical submission doc) |
| [`docs/historical/SCF_TRANCHE_PLAN.md`](./docs/historical/SCF_TRANCHE_PLAN.md) | SCF tranche plan with verification artifacts and acceptance criteria (historical submission doc) |
| [`docs/historical/TRACK_ANSWERS.md`](./docs/historical/TRACK_ANSWERS.md) | Build On Stellar track mapping and proof pointers (historical submission doc) |
| [`docs/historical/CV_LABS_APPLICATION.md`](./docs/historical/CV_LABS_APPLICATION.md) | Stellar × CV Labs Accelerator application draft (historical submission doc) |

See [`docs/historical/README.md`](./docs/historical/README.md) for the on-folder index and pointers to the current source-of-truth docs.

## Status

- [x] Round contract + 14 tests + on-chain Drand BLS
- [x] tlock + auditor blob (13 tests)
- [x] SDK + optional OZ Relayer Channels submitter
- [x] Testnet **full lifecycle** (`lifecycle:e2e`) — USDC, 2 bidders, settle → 0
- [x] Testnet **multi-agent** (`agents:e2e`) — x402, mandate, keeper reveal, settle → 0, **single UI trace**
- [x] Mainnet **deploy + settle smoke** — 1/5 XLM, round 1 settled
- [x] Mainnet **verify** + **micro runner** (dry-run default, tiny XLM cap)
- [x] Jury UI — one canonical testnet trace (status, bidders, R, auditor blobs, session keys)
- [x] Watch-mode keeper (`pnpm keeper:watch`)
- [x] Round receipts — export, offline verify, redaction, fixtures

## Cryptographic design

- **Seal:** Drand tlock IBE, `bls-unchained-g1-rfc9380`
- **Binding:** `H = sha256(value‖nonce)`
- **Unlock:** round-R BLS verified on-chain before reveal
- **Selective disclosure:** values public post-R; identities auditor-encrypted

---

Licensed under [MIT](./LICENSE).
