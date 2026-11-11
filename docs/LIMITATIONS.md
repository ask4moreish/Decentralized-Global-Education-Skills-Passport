# Known Limitations, Honest Scope Boundaries & Verification Hierarchy

This document provides transparent, verifiable boundaries and operational status across the Decentralized Global Education & Skills Passport. No hidden fallbacks, exaggerated claims, or simulated results are presented as production readiness.

---

## 1. Five-Tier Verification Hierarchy

To avoid conflating local simulation with production security, the project operates under a five-tier verification model:

| Tier | Environment | Scope & Proof | Status |
| :--- | :--- | :--- | :--- |
| **Tier 1: Local Unit & VM Tests** | Offline / Local Soroban VM | 32 passport contract tests (`cargo test -p skills-passport-core`), 123 SDK tests (`pnpm sdk:test`), 88 web tests (`pnpm web:test`), and 10 E2E lifecycle scenarios (`pnpm lifecycle:passport`). | **IMPLEMENTED & VERIFIED** |
| **Tier 2: Automated CI & Build** | GitHub Actions (`ubuntu-latest`) | Contract test suite, `pnpm passport:check` (release WASM + ABI + 20 error codes), `pnpm bindings:check` (Round contract), workspace typecheck, CSS token lint, link checks, and Vite production build (`pnpm web:build`). | **IMPLEMENTED & VERIFIED** |
| **Tier 3: Live Testnet Verification** | Stellar Soroban Testnet | **Hardened instance [`CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2`](https://stellar.expert/explorer/testnet/contract/CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2)** (`f7975920...`): 17 confirmed transactions across admin handover, pause/unpause, issuer key rotation, 4-item batch issuance, pagination, suspension, reactivation, and revocation (`pnpm passport:verify:testnet:hardened`), plus enforcing negative simulations. Preserved legacy [`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5`](https://stellar.expert/explorer/testnet/contract/CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5) (`2026-10-27` WASM `f7f29f6c...`) remains verified read-only (`pnpm passport:verify:testnet`). | **IMPLEMENTED AND VERIFIED ON TESTNET** |
| **Tier 4: Production Mainnet Deployment** | Stellar Mainnet | Live deployment of the **Passport** contract to Mainnet is **not started** (pending independent audit and governance readiness). Do not confuse the separate `contracts/round` micro-settlement test on Mainnet with Passport readiness. | **NOT IMPLEMENTED / PENDING AUDIT** |
| **Tier 5: Independent Security Review** | External Audit Specialist | Formal review of smart contract invariants, key management, PII containment, and revocation controls. **Automated tests and Testnet runs do NOT substitute for an independent third-party audit.** | **MANDATORY PRIOR TO REAL PII** |

---

## 2. Education & Skills Passport Implementation Status

| Capability | Status | Implementation Details & Honest Boundaries |
| :--- | :--- | :--- |
| **Soroban Core Contract** | **Implemented & Verified on Testnet** | [`contracts/passport`](../contracts/passport): 32 unit tests passing (`cargo test -p skills-passport-core`). Deployed at [`CDDP5O...`](https://stellar.expert/explorer/testnet/contract/CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2) (`f7975920...`) with confirmed on-chain transactions for two-step admin transfer (`propose_admin` / `accept_admin`), pause circuit breaker (`pause` / `unpause`), `rotate_issuer_key`, bounded batches (`MAX_BATCH_SIZE = 50`), pagination, suspension, and permanent revocation. |
| **W3C VC & Cryptography** | **Implemented & Verified** | [`packages/sdk`](../packages/sdk): RFC 8785 UTF-16 JCS canonicalization, `StellarSorobanHashCommitment2026` SHA-256 commitments, `StellarSorobanSaltedClaims2026` salted attribute disclosure, and W3C Data Integrity **`eddsa-jcs-2022`** Ed25519 signatures verified independently via Node `crypto` SPKI. |
| **Frontend Vault, Console & Verifier** | **Implemented & Verified** | [`apps/web`](../apps/web): Learner Vault (ISO/IEC 18004 QR encoder, salted share redaction, optional `PBKDF2-SHA256` + `AES-256-GCM` encrypted `localStorage` vault and `.skp-vault.json` backup), Institution Console (Freighter signing option, demo-only override warnings), and Employer Verifier (Live Testnet Soroban RPC mode pointing to `CDDP5O...` + Demo fallback). |
| **Live Testnet Deployments** | **Hardened (`2026-11-11`) & Legacy (`2026-10-27`) Verified** | **Hardened**: [`CDDP5O...`](https://stellar.expert/explorer/testnet/contract/CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2) ([`deployed-testnet-hardened.json`](../contracts/passport/deployed-testnet-hardened.json), WASM `f7975920...`, 17 confirmed txs, matches local build). **Legacy**: [`CAP3J5...`](https://stellar.expert/explorer/testnet/contract/CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5) ([`deployed-testnet.json`](../contracts/passport/deployed-testnet.json), WASM `f7f29f6c...`, preserved untouched). |

---

## 3. Privacy Claims, URL Sharing & Storage Boundaries

### A. On-Chain vs. Off-Chain Visibility
- **Off-Chain Attributes:** Learner names, grades, achievement descriptions, and skill lists are **never stored on-chain** or placed into contract events.
- **Public On-Chain Metadata:** Stellar public addresses (`issuer` and `recipient`), `credential_id` (32 bytes), `credential_hash` (32 bytes), `template_id`, timestamps, and revocation/suspension status + reasons are **publicly readable** on the Stellar ledger. Anyone who monitors the ledger can link issuer and recipient Stellar public keys.

### B. Sharing Links, URL Fragments & Browser History
- **Anchor Mode (`#/passport/verify?cid=...&id=...&h=...`):** Encodes only contract ID, credential ID, and hash commitment. No learner name, degree title, or grade is inside the URL.
- **Selective Payload Mode (`#/passport/verify?data=...`):** Strips unchecked claims and supports salted claim commitments (`StellarSorobanSaltedClaims2026`) so omitted claim preimages and salts are excluded from the shared JSON while remaining claims stay verifiable against the root digest.
- **Honest URL & Client Limitations:**
  - Placing parameters in `#` prevents HTTP `GET` request-line and `Referer` header leakage to web servers, and the web verifier scrubs `window.location.hash` via `window.history.replaceState` after load.
  - **URL fragments do NOT eliminate client-side persistence.** Visited URLs remain in browser history until cleared, copied links persist in OS/cloud clipboards and messaging apps, screenshots capture whatever is displayed, and same-origin scripts or browser extensions can read open DOM/storage.
  - **Not Zero-Knowledge:** Salted SHA-256 commitments allow redacting hidden attributes while still revealing the credential root ID/hash and disclosed fields. Two presentations from the same credential remain linkable via `credentialHash` / `credentialId`, and **no ZK-SNARKs or BBS+ unlinkable signatures are implemented.**

### C. Browser Storage (`localStorage`) vs. Production Security
- **Demo Mode Default:** Unauthenticated demo state uses browser `localStorage` (`skills_passport_credentials_v1`) for offline walkthroughs. Even without inline `<script>` tags (`script-src 'self'`), `localStorage` is readable by any script or extension running in the same origin and is **not suitable for production credential custody**.
- **Client-Side Encrypted Vault Option:** Learners can passphrase-encrypt their vault (`PBKDF2-SHA256`, 150,000 iterations + `AES-256-GCM`) via [`vaultCrypto.ts`](../apps/web/src/passport/vaultCrypto.ts), which scrubs the plaintext demo storage keys and supports encrypted `.skp-vault.json` backup files. Signing transactions remains delegated to external Stellar wallets (Freighter) rather than storing raw `S...` keys in browser storage.
- **Production Requirement:** Real deployments should migrate secret storage to OS keychains, WebAuthn-backed hardware enclaves, or HSM-custodied enterprise KMS alongside encrypted remote backup.

---

## 4. Auxiliary Sealed Allocation Round Module

The repository includes a secondary coordination primitive located at [`contracts/round`](../contracts/round):
- **Role:** Auxiliary sealed commit-reveal module designed for grant allocation, bounty escrow, and hackathon judging using Drand timelock encryption and Stellar Asset Contract (SAC) settlement.
- **Independence:** The **Education & Skills Passport** (`contracts/passport`) is the primary credential surface and maintains separate contract deployment artifacts ([`deployed-testnet.json`](../contracts/passport/deployed-testnet.json)) and ABI checks (`pnpm passport:check`). Do not conflate `contracts/round` Mainnet tests with Passport contract readiness.
