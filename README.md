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

The platform allows educational institutions, universities, training providers, learners, and employers to issue, manage, share, and independently verify educational credentials, certifications, and verified skills on the Stellar blockchain without depending on any single institution's private database.

### Why Stellar & Soroban?
- **Account-Native Sovereign Identity (`did:stellar:G...`)**: Learners hold portable credentials tied to standard Stellar Ed25519 keys, Freighter wallets, or Soroban smart accounts without vendor lock-in.
- **Minimal Ledger Footprint & Deterministic Costs**: Each credential anchors only a 32-byte RFC 8785 JCS SHA-256 digest and metadata IDs in Persistent Soroban storage, keeping tuition/diploma issuance fast and predictable across Borders.
- **Instant Global Revocation & Institutional Recovery**: Authorized issuers and admins control role-gated revocation, suspension, two-step admin transfer (`propose_admin` / `accept_admin`), emergency circuit-breaker `pause`, and `rotate_issuer_key` recovery.
- **Standards-Based Interoperability**: Combines W3C Verifiable Credentials Data Model v1.1 and optional W3C Data Integrity (`eddsa-jcs-2022`) signatures with live Soroban RPC verification.

```bash
pnpm install
pnpm web:dev                    # Launches the Education Passport & Verifier UI
pnpm test                       # Runs contracts (90), SDK (123), and web (88) test suites
pnpm passport:check             # Verifies contracts/passport WASM, 29 ABI exports & 20 error codes
pnpm lifecycle:passport         # Runs all 10 End-to-End Credential Lifecycle scenarios
pnpm passport:verify:testnet    # Direct Soroban RPC + Horizon verifier (WASM, 8 txs, admin, negative sims)
pnpm passport:verify --demo     # CLI Credential Verifier tool
pnpm passport:test              # Soroban skills-passport-core contract tests (32 tests)
pnpm contract:test              # All Soroban contract tests (90 tests total: 32 passport + 58 round)
```

---

## What's in the box

| Layer | Path | Purpose |
| --- | --- | --- |
| **Passport Contract** | [`contracts/passport`](contracts/passport) | **Core Soroban Primitive**: Authorized issuer registry, two-step admin & pause controls, key rotation, W3C hash commitments, revocation & suspension |
| **Allocation Contract** | [`contracts/round`](contracts/round) | **Sealed Allocation Primitive**: Separate commit-reveal coordination round contract with Drand timelock & SAC settlement |
| **TypeScript SDK** | [`packages/sdk`](packages/sdk) | W3C VC v1.1 schema validator, RFC 8785 UTF-16 JCS hashing, salted claim disclosure, W3C `eddsa-jcs-2022` signing/verifying, ISO QR/URL sharing, and `EducationPassportClient` |
| **Web Application** | [`apps/web`](apps/web) | Interactive React 19 app featuring **Learner Passport Vault** (optional `PBKDF2-SHA256` + `AES-256-GCM` browser encryption), **Institution Console**, and **Live Testnet Employer Verifier** |
| **Crypto Package** | [`packages/tlock`](packages/tlock) | Drand timelock encryption and BLS12-381 verification utilities |
| **Keeper Service** | [`services/keeper`](services/keeper) | Permissionless automated execution daemon for sealed coordination rounds |

---

## User Journeys

### 1. Learner Passport
- Connect Freighter wallet or inspect read-only demo profiles (`Elena Rostova`, `Alexandre Moreau`).
- Protect local browser vault state at rest using optional **`PBKDF2-SHA256` (150,000 iterations) + `AES-256-GCM`** encryption and export/import encrypted `.skp-vault.json` recovery backups (replacing plaintext `localStorage` keys when enabled; see [`docs/LIMITATIONS.md`](./docs/LIMITATIONS.md) for demo vs. enclave boundaries).
- Choose **Anchor Sharing Mode** (zero PII in link) or **Salted Selective Disclosure Mode** (`StellarSorobanSaltedClaims2026`, redacting omitted fields and salts while remaining cryptographically verifiable).
- Generate scannable ISO/IEC 18004 SVG QR codes and export W3C Verifiable Credential JSON files.

### 2. Educational Institution & Issuer
- Issue W3C credentials anchored to the live Testnet contract ID with salted claim commitments enabled and recipient Stellar StrKey validation.
- Query live Soroban Testnet `is_issuer_authorized` state directly or sign transactions via Freighter (raw `S...` keys are never stored in the browser; demo local toggles are clearly labeled as local overrides).

### 3. Employer & Verifier
- Toggle between **Live Stellar Testnet Soroban RPC** (`CDDP5O...` hardened build; legacy `CAP3J5...` preserved) and **Demo Local Cache** to verify zero-PII anchor URLs, selectively disclosed presentations, W3C `eddsa-jcs-2022` proofs, or uploaded `.json` credentials.
- Clearly distinguishes `Valid`, `Revoked`, `Suspended`, `Expired`, `Tampered`, `Untrusted Issuer`, and `Unverifiable`.

---

## Privacy & Blockchain Architecture

1. **Off-Chain PII, Public Ledger Commitments**: Student names, grades, and descriptions are **never stored in Soroban storage or events**. Note that Stellar public keys (`issuer`, `recipient`), 32-byte `credential_id`, 32-byte `credential_hash`, `template_id`, timestamps, and revocation status/reasons **are publicly readable on ledger**.
2. **Deterministic Canonicalization & W3C Data Integrity**: Payloads use RFC 8785 UTF-16 JCS canonicalization + SHA-256 (`StellarSorobanHashCommitment2026` / `StellarSorobanSaltedClaims2026`), and optionally W3C **`DataIntegrityProof` (`cryptosuite: "eddsa-jcs-2022"`)** Ed25519 signatures over `did:key` or `did:stellar`.
3. **Privacy Bounds of Sharing Links & URL Fragments**:
   - **Anchor Mode** (`#/passport/verify?cid=...&id=...&h=...`) keeps learner PII out of the URL, placing parameters in `#` (preventing HTTP `GET` query-line and `Referer` header leakage) and scrubbing `window.location.hash` after verification.
   - **Honest Client Limits**: Hash fragments **do not** erase prior browser history entries, OS/cloud clipboards, messaging previews, forwarded links, screenshots, or same-origin script/extension visibility.
4. **Salted Selective Disclosure != Zero-Knowledge Proofs**:
   - `StellarSorobanSaltedClaims2026` commits each claim with a 128-bit CSPRNG salt so learners can strip unshared fields and salts from redacted views while keeping disclosed claims verifiable against the on-chain hash. However, presentations remain linkable via `credentialHash` / `credentialId`, and **ZK-SNARK / BBS+ unlinkable proofs are not implemented** (see **[`docs/VERIFIER_TRUST_MODEL.md`](./docs/VERIFIER_TRUST_MODEL.md)**).

---

## Complete Credential Lifecycle & Contract Interface

The Soroban Education Passport contract (`contracts/passport`) provides lifecycle, security, and recovery primitives ([`ERRORS.md`](./contracts/passport/ERRORS.md)):

| Contract Function | Authorization | Description |
| --- | --- | --- |
| `initialize(admin)` | One-time Admin | Sets initial contract administrator |
| `propose_admin(caller, new_admin)` / `accept_admin()` | Admin / Nominee | Two-step safe administrator key handover (`get_pending_admin` to inspect) |
| `pause(caller)` / `unpause(caller)` / `is_paused()` | Admin / Read-only | Emergency circuit breaker pausing state-changing registry mutations |
| `register_issuer(issuer, name, metadata_uri)` | Admin | Authorizes an educational institution or certifying body |
| `deauthorize_issuer(issuer)` / `reactivate_issuer(issuer)` | Admin | Revokes/restores institutional issuing privileges; deauthorized issuers lose issuance, template, and lifecycle control |
| `rotate_issuer_key(caller, old_issuer, new_issuer)` | Admin | Transfers active issuer authorization to a fresh key on key rotation/compromise |
| `update_issuer_metadata(caller, issuer, name, metadata_uri)` | Active Issuer / Admin | Updates institution display name or metadata URI |
| `register_template(issuer, template_id, name, schema_uri)` | Active Issuer | Registers reusable credential schema owned by that issuer |
| `get_template(template_id)` | Read-only | Queries registered credential template metadata |
| `issue_credential(issuer, recipient, credential_id, credential_hash, template_id, expires_at)` | Active Issuer | Issues non-zero, non-duplicate, non-self-issued credential hash commitment |
| `batch_issue_credentials(issuer, credentials)` | Active Issuer | Atomically issues up to `MAX_BATCH_SIZE = 50` validated credentials in one tx |
| `revoke_credential(caller, credential_id, reason)` | Active Issuer / Admin | Permanently revokes a credential with mandatory audit reason |
| `suspend_credential(caller, credential_id, reason)` / `reactivate_credential(...)` | Active Issuer / Admin | Temporarily suspends credential; reactivation rejects expired or revoked records |
| `get_credential_status(credential_id)` / `get_learner_credentials_page(...)` | Read-only | Fast status tuple query and paginated learner index lookup |
| `verify_credential(credential_id, claimed_hash)` | Read-only | Returns structured validity, hash match, issuer auth, expiry, and status flags |

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
| **Education Passport E2E** | `pnpm lifecycle:passport` | Local / SDK | **10 core scenarios**: issuance, learner view, independent verifier, tampering detection, unauthorized rejection, revocation audit, expiration, selective disclosure, recovery |
| **CLI Verifier** | `pnpm passport:verify --demo` | Local / CLI | Off-chain W3C VC v1.1 schema validation, RFC-8785 JCS hashing, and status diagnostics (`--testnet` adds live RPC lookup) |
| **Passport Contract** | `pnpm passport:test` | Soroban VM | **32 unit & security tests**: two-step admin transfer, circuit breaker `pause`, key rotation, batch atomicity, revocation/suspension, pagination, replay/substitution protection |
| **Passport ABI Check** | `pnpm passport:check` | Local / CI | Verifies `contracts/passport` release WASM (`f7975920...`), 29 WASM ABI exports, and 20 `PassportError` mappings |
| **Live Testnet Audit** | `pnpm passport:verify:testnet` | Testnet | Read-only verification of `CAP3J5...` WASM, all 8 historical lifecycle txs on Horizon/RPC, `get_admin`, `get_credential`, and 6 live negative simulations |
| **Full product (Round)** | `pnpm lifecycle:e2e` | Testnet | 2 bidders, USDC SAC, keeper settle → contract **0** |
| **Multi-agent (Round)** | `pnpm agents:e2e` | Testnet | Mandate + x402 + keeper reveal + settle → **single UI trace** |
| **x402 appraisal** | `pnpm appraisal:e2e` | Testnet | HTTP 402 → on-chain USDC settle |
| **Mainnet smoke (Round)** | `pnpm mainnet:deploy` + `pnpm mainnet:settle` | Mainnet | Deploy, BLS, settle `contracts/round` on **real XLM** |
| **Mainnet verify (Round)** | `pnpm mainnet:verify` | Mainnet | Read-only check of settled round 1 |

See [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) for honest scope boundaries.

## Deployed artifacts

### Education Passport Contract (`contracts/passport`)

| Field | Value |
| --- | --- |
| Contract Type | Decentralized Education & Skills Passport Core (distinct from `contracts/round`) |
| **Hardened Testnet Contract (`2026-11-11`, Active Default)** | [`CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2`](https://stellar.expert/explorer/testnet/contract/CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2) ([`deployed-testnet-hardened.json`](./contracts/passport/deployed-testnet-hardened.json)) |
| **Hardened WASM SHA-256 (Live & Local Match)** | `f7975920f377927af8d803f87df3a3ade4e84cc012835868f004eca4105888bf` (`42,382` bytes) |
| Active Handover Admin / Rotated Issuer | Admin `GDPPXM3S7VWZ6DKOBHRTDKW35MPDAFLB5ONKVV2IQ2N43E3K3WO7M4MJ` · Issuer `GAGLNXX4EV5DTA4CHD3XV2K4BCFKHQNKCD57XZ2Z4LEXG6MTCQKZSTQT` |
| **Legacy Testnet Contract (`2026-10-27`, Preserved)** | [`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5`](https://stellar.expert/explorer/testnet/contract/CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5) ([`deployed-testnet.json`](./contracts/passport/deployed-testnet.json)) |
| Legacy Deployed WASM Hash | `f7f29f6c3ab6f0e3524605b7d3bb1ff41c1de7fb015973719f50aed5ce480610` |
| Local Test Coverage | **32/32 passing** (Soroban VM) · **123/123** SDK · **88/88** Web · **10/10** E2E |
| Testnet Status | **Hardened build deployed & verified on Testnet** (`17` confirmed txs on `CDDP5O...`); legacy `CAP3J5...` preserved read-only |

#### Independent On-Chain Verification (Direct Soroban RPC)

Both the new hardened deployment and the preserved legacy deployment can be **verified directly against Soroban Testnet JSON-RPC & Horizon**:

```bash
# Verify hardened Testnet contract CDDP5O... (byte-for-byte WASM match, 17 confirmed txs, queries, and enforcing simulations):
pnpm passport:verify:testnet:hardened

# Verify preserved legacy Testnet contract CAP3J5... (2026-10-27 WASM & 8 historical Horizon txs):
pnpm passport:verify:testnet
```

Or query the hardened contract instance ledger entry directly via raw `curl`:

```bash
curl -s -X POST https://soroban-testnet.stellar.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getContractData","params":{"contract":"CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2","key":"AAAABAAAAAE=","durability":"persistent"}}'
```

#### Hardened Testnet Verified Transaction Proofs (`CDDP5O...`, Ledgers `5672045`–`5672062`)

| Stage | Transaction Hash | Ledger / Result |
| --- | --- | --- |
| **WASM Upload (`f7975920...`)** | [`c0bfed72...`](https://stellar.expert/explorer/testnet/tx/c0bfed72346830857bb12296921ac04811c66c07597055e5508ae0a4bb1e90a7) | Ledger `5672045` · `42,382`-byte hardened bytecode installed |
| **Contract Deployment** | [`40eb0773...`](https://stellar.expert/explorer/testnet/tx/40eb077321244a96b468acb4d2e4ff63c898c9332aa95b530f523ee0389b443c) | Ledger `5672046` · Instance `CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2` |
| **Admin Initialization** | [`7314995d...`](https://stellar.expert/explorer/testnet/tx/7314995d4abbb347574630cfb4fbfefdce308ca325e952c961205b4846401c7b) | Ledger `5672047` · Initial admin `GBCL7YY...` |
| **Two-Step Admin Propose / Accept** | [`5e49a894...`](https://stellar.expert/explorer/testnet/tx/5e49a894ab330db4dcb450e5d24ba5fc7ebedecf57806af9140dba4ae098c40b) / [`eaa8d5af...`](https://stellar.expert/explorer/testnet/tx/eaa8d5afc62d2f97d0a435b56e70bd398d324b31d2e2d24e66427d9c475e4547) | Ledgers `5672048`–`5672049` · Admin handed over to `GDPPXM3...` |
| **Emergency Pause / Unpause** | [`5c0edf14...`](https://stellar.expert/explorer/testnet/tx/5c0edf14d3a31c9f0326024fdc3047b3c7064513f75e556683362893013b6499) / [`a7d7778b...`](https://stellar.expert/explorer/testnet/tx/a7d7778bbbf066a87ed5a956c8181adf16e9ce603b9079130659c4df7a6f0e01) | Ledgers `5672050`–`5672051` · Circuit breaker toggled & verified |
| **Issuer & Template (`Degree`)** | [`84536350...`](https://stellar.expert/explorer/testnet/tx/84536350fae5925c10f7029011a3ed1f26aadb7e45eba0b63b0c783929c88332) / [`8d763b70...`](https://stellar.expert/explorer/testnet/tx/8d763b70af6a9b4494af489a6fc264832f404f83bbdb241477b023941ff6061f) | Ledgers `5672052`–`5672053` · Authorized `GBUWRYZ...` post-unpause |
| **Single & 4-Item Batch Issuance** | [`83e91a30...`](https://stellar.expert/explorer/testnet/tx/83e91a30a2c4cc9620ce8499d028b0e3f6883d43b9efcec935988cdb0686f2ef) / [`c57b2e30...`](https://stellar.expert/explorer/testnet/tx/c57b2e303dcfffa079d2c1cfd3b5eeacbf172b3e01a923478319dd701e524a7a) | Ledgers `5672054`–`5672055` · `5` credentials verified across 3 pages |
| **Suspend / Reactivate / Revoke** | [`d109a0c3...`](https://stellar.expert/explorer/testnet/tx/d109a0c3f3aa6d47e2a346788e59146ea34f33bad8bbf34f5b5b3924f7ed7f54) / [`c3ce0115...`](https://stellar.expert/explorer/testnet/tx/c3ce01158f940ce8005d89b8e26d4b05187a25002571d86e5746718988e82f43) / [`083432ae...`](https://stellar.expert/explorer/testnet/tx/083432ae418c732893ccac7abdf4b3e8129321a58e6c4b174ea190eec5e406b9) | Ledgers `5672057`–`5672059` · Status `3` → `1` → `2` (Revoked) |
| **Dual-Signed Key Rotation (`rotate_issuer_key`)** | [`007c75c6...`](https://stellar.expert/explorer/testnet/tx/007c75c60b2a64611a4ff9b13ca6d85d5b413405455e5f0a92f5152240aee81a) | Ledger `5672060` · `GBUWRYZ...` rotated to `GAGLNXX...` |
| **Post-Rotation `Cert` & Issuance** | [`54ffd1ba...`](https://stellar.expert/explorer/testnet/tx/54ffd1ba1f661078344ddeac20f035f9a9be884569e2da5775be5b9b884c4cfc) / [`64c06850...`](https://stellar.expert/explorer/testnet/tx/64c06850afd89966d0dc1640a579ad7027a5c87fdb01bfe2fe4cc9084e9b6799) | Ledgers `5672061`–`5672062` · Active post-rotation credential (`count = 6`) |

Full transaction logs, read-only queries, enforcing negative simulations (`#3`, `#4`, `#5`, `#8`, `#14`, `#15`, `#17`, `#18`, `Auth InvalidAction`), and legacy `CAP3J5...` archive records are preserved in [`HARDENED_TESTNET_DEPLOYMENT_REPORT.md`](./HARDENED_TESTNET_DEPLOYMENT_REPORT.md).

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
- [x] Soroban Passport Contract (`contracts/passport`) + 32 security/unit tests + `pnpm passport:check` (29 ABI exports, 20 error codes)
- [x] TypeScript SDK (`packages/sdk`, 123 tests): W3C VC v1.1 schema validator, RFC 8785 UTF-16 JCS, salted claim commitments, and W3C `eddsa-jcs-2022` Data Integrity (`did:key` / `did:stellar`)
- [x] 10/10 End-to-End credential lifecycle scenarios (`pnpm lifecycle:passport`) & CLI verifier (`pnpm passport:verify --demo`)
- [x] Interactive Web Portal (`apps/web`, 88 tests + CSP `script-src 'self'`): Learner Vault (`PBKDF2-SHA256` + `AES-256-GCM` optional encryption & ISO/IEC 18004 QR), Issuer Console, Live Testnet RPC Verifier
- [x] Preserved Legacy Testnet Verification (`pnpm passport:verify:testnet`) of `CAP3J5...`: `2026-10-27` WASM hash `f7f29f6c...`, all 8 historical lifecycle txs, `get_admin`, `get_credential`, and 6 negative simulations
- [x] **Hardened WASM (`f7975920...`) Deployed & Verified on Testnet (`CDDP5O...`)**: `17` confirmed Testnet transactions across ledgers `5672045`–`5672062` verifying two-step admin handover, emergency pause/unpause, dual-signed issuer key rotation, `4`-item batch issuance, multi-page pagination, and credential lifecycle controls (`pnpm passport:verify:testnet:hardened`)
- [ ] **ZK Unlinkable Selective Disclosure (BBS+ / ZK-SNARKs)** & **Mainnet Launch / Independent Security Audit**: Required before processing real student educational records in production

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
