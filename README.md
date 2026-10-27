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
pnpm web:dev                  # Launches the Education Passport & Verifier UI
pnpm test                     # Runs full test suite (contracts, SDK, web)
pnpm lifecycle:passport       # Runs all 10 End-to-End Credential Lifecycle scenarios
pnpm passport:lifecycle:testnet # Runs live on-chain lifecycle against Stellar Testnet
pnpm passport:verify:testnet  # Direct Soroban RPC contract verifier (WASM hash, admin, issuer)
pnpm passport:verify          # CLI Credential Verifier tool
pnpm passport:test            # Soroban skills-passport-core contract tests (19 scenarios)
pnpm contract:test            # All Soroban contract tests (77 tests total)
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
2. **Deterministic Cryptographic Commitments**: Credentials follow the W3C Verifiable Credentials standard. The canonical JSON payload is hashed using SHA-256 (RFC 8785 JSON Canonicalization Scheme), and only the resulting 32-byte digest is anchored on Soroban.
3. **Zero-PII Sharing Links (Anchor Mode)**:
   - Verification links default to **On-Chain Anchor Mode** (`#/verify?cid=...&id=...&h=...`), encoding only the contract ID, credential ID, and hash commitment.
   - **Zero Student PII** (names, grades, courses) is present in the URL, preventing leakage into browser histories, copied links, or server access logs.
   - Parameters are confined strictly to the client-side URL hash fragment (`#`), ensuring they are never transmitted over the wire in HTTP request lines.
4. **Auditable Revocation Lifecycle**: Institutions retain the ability to revoke or suspend compromised or erroneous credentials on-chain, immediately visible to verifiers worldwide with auditable reason logs.
5. **Strict Soroban Authorization**: Only approved institution identities (`issuer.require_auth()`) or administrators can register templates, issue, revoke, or suspend credentials.
6. **Selective Disclosure & Trust Boundaries**:
   - **v1 Document-Level Presentation Filter & Anchor (Implemented)**: Learners can share Zero-PII anchor links or present isolated skill subsets for job applications. The presentation filters attributes in software while preserving the parent credential root identifier for ledger verification.
   - **v2 Cryptographic Attribute Proofs (Planned)**: Full zero-knowledge selective disclosure using BBS+ signatures or ZK-SNARKs to prove individual claims without disclosing the parent credential preimage or root hash.
   - For an exhaustive analysis of what the verifier proves, trusts, and does not prove, consult **[`docs/VERIFIER_TRUST_MODEL.md`](./docs/VERIFIER_TRUST_MODEL.md)**.

---

## Complete Credential Lifecycle & Contract Interface

The Soroban Education Passport contract (`contracts/passport`) provides a complete suite of lifecycle primitives:

| Contract Function | Authorization | Description |
| --- | --- | --- |
| `initialize(admin)` | Admin | Deploys registry and sets contract administrator |
| `register_issuer(issuer, name, metadata_uri)` | Admin | Authorizes an educational institution or certifying body |
| `update_issuer_metadata(issuer, name, metadata_uri)` | Issuer / Admin | Updates institution name or accreditation profile |
| `deauthorize_issuer(issuer)` | Admin | Removes issuing authority; immediately marks existing credentials as untrusted |
| `register_template(issuer, template_id, name, schema_uri)` | Issuer | Registers reusable credential schema (degree, diploma, badge) |
| `get_template(template_id)` | Read-only | Queries registered credential template metadata |
| `issue_credential(issuer, recipient, credential_id, credential_hash, template_id, expires_at)` | Issuer | Issues tamper-evident credential hash commitment |
| `batch_issue_credentials(issuer, credentials)` | Issuer | Atomically issues up to 50 credentials in a single transaction |
| `revoke_credential(caller, credential_id, reason)` | Issuer / Admin | Permanently revokes a credential with auditable reason |
| `suspend_credential(caller, credential_id, reason)` | Issuer / Admin | Temporarily suspends credential pending review |
| `reactivate_credential(caller, credential_id)` | Issuer / Admin | Reactivates a suspended credential (revoked cannot be reactivated) |
| `get_credential_status(credential_id)` | Read-only | High-speed tuple query: `(status, expires_at, revocation_reason)` |
| `verify_credential(credential_id, claimed_hash)` | Read-only | Full cryptographic verification returning structured boolean flags |

### Automated 10-Scenario Verification Suite

The repository includes a comprehensive regression test suite (`pnpm lifecycle:passport`) validating all 10 core scenarios:

1. **Authorized Issuance**: Authorized institution registers templates and issues W3C credentials.
2. **Learner Passport Ingestion**: Learner receives credential, views competencies, and generates QR code/sharing link.
3. **Independent Verification**: Employer independently verifies credential authenticity against ledger state.
4. **Cryptographic Tampering Detection**: Altered grades, conferred titles, or substituted student DIDs immediately fail verification.
5. **Unauthorized Issuer Rejection**: Issuances from deauthorized or unaccredited entities are flagged as untrusted.
6. **Revocation Enforcement**: Revoked credentials are rejected with verifiable revocation reason audit trail.
7. **Expiration Detection**: Expired credentials are unambiguously identified based on timestamp.
8. **Selective Disclosure**: Learner shares subset of skills without leaking unshared courses or personal records.
9. **Resilient Error Recovery**: Malformed payloads, network drops, and simulation failures produce clean, typed errors.
10. **Reproducibility Check**: All checks execute deterministically across Soroban VM, TypeScript SDK, and browser UI.

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

---

## Proof at a glance

| Layer | Command | Network | What it proves |
| --- | --- | --- | --- |
| **Education Passport E2E** | `pnpm lifecycle:passport` | Local / SDK | **All 10 core scenarios**: issuance, learner view, independent verifier, tampering detection, unauthorized rejection, revocation audit, expiration, selective disclosure, recovery |
| **CLI Verifier** | `pnpm passport:verify --demo` | Local / CLI | Off-chain W3C VC parsing, RFC-8785 canonical hash computation, and status diagnostics |
| **Passport Contract** | `pnpm passport:test` | Soroban VM | **19 unit tests**: registration, templates, batch issuance, revocation, suspension, fast status queries, replay/substitution protection |
| **Full product** | `pnpm lifecycle:e2e` | Testnet | 2 bidders, USDC SAC, keeper settle → contract **0** |
| **Multi-agent** | `pnpm agents:e2e` | Testnet | Mandate + x402 + keeper reveal + settle → **single UI trace** |
| **x402 appraisal** | `pnpm appraisal:e2e` | Testnet | HTTP 402 → on-chain USDC settle |
| **Mainnet smoke** | `pnpm mainnet:deploy` + `pnpm mainnet:settle` | Mainnet | Deploy, BLS, settle on **real XLM** |
| **Mainnet verify** | `pnpm mainnet:verify` | Mainnet | Read-only check of settled round 1 |

See [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) for honest scope boundaries.

## Deployed artifacts

### Education Passport Contract (`contracts/passport`)

| Field | Value |
| --- | --- |
| Contract Type | Decentralized Education & Skills Passport Core |
| Testnet Contract | [`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5`](https://stellar.expert/explorer/testnet/contract/CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5) |
| Testnet WASM Hash | `f7f29f6c3ab6f0e3524605b7d3bb1ff41c1de7fb015973719f50aed5ce480610` |
| Admin Identity | `GCSKC6MWND2LHUE2PXITRPIUES52CODYWH5D6MBD7K5FD2GVIKLOCUUA` |
| Authorized Issuer | `GCW3HMYU6W52RSTSTDBRYWON7SZIFXKJWVODJYYFWMK7WEVUTXAAVY3F` |
| Test Coverage | **19/19 passing** (Soroban VM test harness) |
| Lifecycle Scenarios | **10/10 passing** (`pnpm lifecycle:passport` local & `pnpm passport:lifecycle:testnet` on-chain) |
| Status | **Deployed & Verified on Stellar Testnet** |

#### Independent On-Chain Verification (Direct Soroban RPC)

If block explorers experience network latency or UI indexing delays, the contract instance, bytecode hash, and on-chain state can be **independently verified directly against the Soroban Testnet JSON-RPC endpoint**:

```bash
# Automated independent verification of WASM hash, admin, issuer, and credentials:
pnpm passport:verify:testnet
```

Or query the contract instance ledger entry directly via raw `curl`:

```bash
curl -s -X POST https://soroban-testnet.stellar.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getContractData","params":{"contract":"CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5","key":"AAAABAAAAAE=","durability":"persistent"}}'
```

#### Testnet Verified Transaction Proofs

| Stage | Transaction Hash | Result |
| --- | --- | --- |
| **WASM Upload** | [`d69d074b...`](https://stellar.expert/explorer/testnet/tx/d69d074b2f80637f2b33bae75c57bb9264a1cfcefc9bbc6b23a960a7db711916) | Bytecode installed (35,216 bytes) |
| **Contract Deployment** | [`5b6424a3...`](https://stellar.expert/explorer/testnet/tx/5b6424a33e13fc1eeb87dd18a7972324e3ad09e319d3ac8ade8ce908f0677c5d) | Instance `CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5` |
| **Admin Initialization** | [`59bad590...`](https://stellar.expert/explorer/testnet/tx/59bad59001b1f7c9e59b910afd299e9d773fce46eae91a8863917c8370964394) | Admin set to `GCSKC6...` |
| **Issuer Authorization** | [`4f107688...`](https://stellar.expert/explorer/testnet/tx/4f107688e3be794f69ca4377dbbae440bddbb5adaf480270655891002222904f) | MIT Digital Credentials Institute authorized |
| **Template Registration** | [`f39c6809...`](https://stellar.expert/explorer/testnet/tx/f39c6809d32499392684cfcb3196f3ddba9744ab36d8f2ed3a80598775adb27e) | `Degree` template registered |
| **Credential Issuance** | [`0fac86a4...`](https://stellar.expert/explorer/testnet/tx/0fac86a487f55ecf79a1a675638faa972fa89d2fd8990f3d14535dbf69ee9827) | Issued with SHA-256 hash commitment |
| **Credential Suspension** | [`84c8f791...`](https://stellar.expert/explorer/testnet/tx/84c8f791a1b30a9cfc326e9bfefc2c215f4a143d2c7d2973e59e41091711b2b6) | State set to Suspended (status = 3) |
| **Credential Reactivation** | [`a20cadbf...`](https://stellar.expert/explorer/testnet/tx/a20cadbf98d950f3a74e42c5452a8b698a079b7fa47acd85e01ce07f21c0227b) | State restored to Active (status = 1) |
| **Credential Revocation** | [`fbf1f4b6...`](https://stellar.expert/explorer/testnet/tx/fbf1f4b6e2c36a1daef4a421cba3db98dfadb707182b2626f36832f1c4dcef5d) | State permanently Revoked (status = 2) |

> [!WARNING]
> **Independent Security Audit Requirement:** Passing automated unit tests and demonstrating Testnet deployment does **not** constitute an independent security audit. An external audit by qualified smart-contract security specialists is strictly mandatory before issuing real student records or processing production credentials. See [docs/SECURITY_REVIEW_REQUIREMENTS.md](./docs/SECURITY_REVIEW_REQUIREMENTS.md) for the audit checklist and threat matrix.

### Sealed Allocation Round Contract (`contracts/round`)

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
dependencies and installs them automatically.

### Education Passport Credential Lifecycle & Verification

```ts
import { EducationPassportClient, verifyEducationCredential } from "skills-passport-sdk";

// Initialize client for Soroban RPC
const client = new EducationPassportClient({
  contractId: "CA...",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
});

// Verify a W3C Verifiable Credential independently against ledger state
const result = await verifyEducationCredential(credential, onChainRecord);
console.log(`Valid: ${result.isValid}, Status: ${result.status}`);
```

### Sealed Allocation Commit-Reveal

Install `tlock` separately only if you need direct access to the seal/unseal APIs without the client.

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

### Decentralized Education & Skills Passport
- [x] Soroban Passport Contract + 19 unit tests (`contracts/passport`)
- [x] 10/10 End-to-end credential lifecycle test suite (`pnpm lifecycle:passport`)
- [x] CLI Credential Verifier tool (`pnpm passport:verify --demo`)
- [x] TypeScript SDK with W3C VC builder, JCS canonical hashing, selective disclosure
- [x] Interactive Web Portal (`apps/web`): Learner Vault, Issuer Console, Employer Verifier
- [x] QR code generation and access-controlled credential sharing
- [x] Auditable on-chain revocation, suspension, and reactivation lifecycles
- [x] Zero-PII sharing architecture (Anchor Mode with 0 personal data in links, URL fragment protection)
- [x] Direct Stellar Testnet contract verification (`pnpm passport:verify:testnet`) with 7/7 checks including tampered hash rejection
- [x] Live Testnet lifecycle test with negative transaction rejection (`pnpm passport:lifecycle:testnet`)
- [ ] **Independent Security Audit**: Outstanding prerequisite before processing real student educational data in production.

### Sealed Allocation Round Primitive
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
| **[`docs/VERIFIER_TRUST_MODEL.md`](./docs/VERIFIER_TRUST_MODEL.md)** | Cryptographic verification boundaries: what verifier proves, trusts, and does NOT prove |
| **[`docs/SECURITY_REVIEW_REQUIREMENTS.md`](./docs/SECURITY_REVIEW_REQUIREMENTS.md)** | Audit readiness checklist, threat vectors, and pre-production security requirements |
| **[`docs/LIMITATIONS.md`](./docs/LIMITATIONS.md)** | Known scope boundaries and 5-tier verification hierarchy |
| **[`docs/VERTICALS.md`](./docs/VERTICALS.md)** | Authoritative verticals reference — sealed grants / RFPs / auctions / credentials / DAO voting |
| [docs/INTEGRATION.md](./docs/INTEGRATION.md) | How another Stellar app embeds the sealed round primitive |
| [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md) | Cryptography, storage, settlement rails |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversaries, mitigations, honest limits |
| [docs/RECEIPTS.md](./docs/RECEIPTS.md) | Portable round receipts, offline verify, redaction |
| [docs/ECOSYSTEM.md](./docs/ECOSYSTEM.md) | Passkey-Kit, Smart Account Kit, OZ Relayer |
| [docs/PILOT_PLAYBOOK.md](./docs/PILOT_PLAYBOOK.md) | Pilot scope, demo narrative, partner outreach |
| [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) | 5-minute walkthrough |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | UI build vs runtime secrets |

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
