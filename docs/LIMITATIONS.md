# Known Limitations & Honest Scope Boundaries

Honest boundaries and operational status across the platform. No hidden fallbacks or fabricated claims.

---

## 1. Education & Skills Passport Status

| Capability | Status | Implementation Details |
| --- | --- | --- |
| **Soroban Core Contract** | **Implemented & Verified** | [`contracts/passport`](../contracts/passport): 19 unit tests passing (`cargo test -p skills-passport-core`), covering issuer registration, template definitions, batch issuance, fast status queries, suspension, and revocation. |
| **W3C VC Cryptography** | **Implemented & Verified** | [`packages/sdk`](../packages/sdk): RFC 8785 JSON Canonicalization Scheme (JCS) + SHA-256 hashing. 100 tests passing (`pnpm sdk:test`). |
| **Digital Passport Vault & UI** | **Implemented & Verified** | [`apps/web`](../apps/web): Learner Vault, Institution Console, and Employer Verifier. Persistent `localStorage` state with 78 passing tests (`pnpm web:test`). |
| **CLI Verifier & E2E Suite** | **Implemented & Verified** | `scripts/verify-credential.mjs` and `scripts/e2e-credential-lifecycle.mjs` (`pnpm lifecycle:passport` verifies all 10 core lifecycle scenarios). |
| **Passport Contract Deployment** | **Deployed & Verified on Testnet** | The passport contract is live on Stellar Testnet ([`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5`](https://stellar.expert/explorer/testnet/contract/CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5)). Full 10-stage lifecycle verified with on-chain receipts (`pnpm passport:lifecycle:testnet`). Independent third-party security review required prior to production mainnet deployment. |
| **Selective Disclosure Scope** | **v1 Document-Level Disclosure** | `createSelectiveCredentialView` filters displayed skills while preserving the parent credential identifier. Full ZK-SNARK or BBS+ selective attribute proofs without revealing the parent root hash are planned for v2. |

---

## 2. Sealed Allocation & Coordination Status

| Capability | Network | What it shows | Command |
| --- | --- | --- | --- |
| **Keeper lifecycle (USDC, 2 bidders)** | **Testnet** | Escrow locking, Drand round-R BLS verify, settlement → balance 0 | `pnpm lifecycle:e2e` |
| **Multi-agent + x402 + UI trace** | **Testnet** | Autonomous agents paying x402 appraisal and submitting bids | `pnpm agents:e2e` |
| **Round deploy + settle smoke** | **Mainnet** | Real XLM SAC deposit and settlement verification | `pnpm mainnet:deploy`, `pnpm mainnet:settle`, `pnpm mainnet:verify` |
| **Optional micro commit** | **Mainnet** | Dry-run checklist for small XLM bids | `pnpm mainnet:micro` |

Mainnet smoke uses **1 XLM bid / 5 XLM escrow** on native XLM SAC. It does **not** replay testnet USDC amounts.

---

## 3. Off-Chain vs On-Chain Enforcement

- **Student PII:** Completely off-chain. Names, transcripts, and personal data are never stored in public contract storage.
- **Credential Integrity:** The Soroban contract strictly enforces that only the registered issuer can issue credentials, and verifies that the claimed 32-byte hash matches the committed hash.
- **Mandate caps (`maxBid`, `maxAppraisalSpend`):** In the allocation module, caps are enforced by agent software off-chain, not by the Soroban contract. The contract strictly checks escrow balances and bid bounds (`bid <= escrow`).

---

## 4. Operational Boundaries

- **Receipt verification:** Round receipts (`docs/RECEIPTS.md`) verify internal mathematical consistency offline without calling live RPCs.
- **Drand availability:** The allocation round requires Drand quicknet to publish round R; the keeper includes a grace period to void the round if Drand fails to publish.
- **Storage lifetime:** Allocation temporary storage expires after the reveal window; passport credential commitments are persistent to provide permanent verifiability.
