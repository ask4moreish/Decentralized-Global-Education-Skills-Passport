# Known Limitations, Honest Scope Boundaries & Verification Hierarchy

This document provides transparent, verifiable boundaries and operational status across the Decentralized Global Education & Skills Passport. No hidden fallbacks, exaggerated claims, or simulated results treated as production readiness.

---

## 1. Five-Tier Verification Hierarchy

To avoid conflating local simulation with production security, the project operates under a strict five-tier verification model:

| Tier | Environment | Scope & Proof | Status |
| :--- | :--- | :--- | :--- |
| **Tier 1: Local Unit & VM Tests** | Offline / Local Soroban VM | 19 passport contract tests (`cargo test -p skills-passport-core`), 106 SDK tests (`pnpm sdk:test`), 79 web tests (`pnpm web:test`), and 10 E2E lifecycle scenarios (`pnpm lifecycle:passport`). | **FIXED AND VERIFIED** |
| **Tier 2: Automated CI Results** | GitHub Actions (`ubuntu-latest`) | Matrix builds verifying contract WASM compilation, workspace typecheck (11/11 packages), linters, bindings, and automated tests on every push/PR. | **FIXED AND VERIFIED** |
| **Tier 3: Live Testnet Verification** | Stellar Soroban Testnet | Passport contract [`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5`](https://stellar.expert/explorer/testnet/contract/CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5) deployed and independently verified via direct Soroban JSON-RPC (`pnpm passport:verify:testnet`). Complete 10-stage lifecycle executed with real transaction receipts (`pnpm passport:lifecycle:testnet`). | **FIXED AND VERIFIED** |
| **Tier 4: Production Mainnet Deployment** | Stellar Mainnet | Live deployment of the passport contract to Mainnet is **pending operational scheduling and independent audit completion**. Do not label Mainnet readiness as complete simply because Testnet works. | **PENDING AUDIT & SCHEDULE** |
| **Tier 5: Independent Security Review** | External Audit Specialist | Formal review of smart contract invariants, key management, PII containment, and revocation controls. **Automated tests do NOT substitute for a third-party security audit.** | **MANDATORY PRIOR TO REAL PII** |

---

## 2. Education & Skills Passport Implementation Status

| Capability | Status | Implementation Details & Honest Boundaries |
| :--- | :--- | :--- |
| **Soroban Core Contract** | **Implemented & Verified** | [`contracts/passport`](../contracts/passport): 19 unit tests passing (`cargo test -p skills-passport-core`). Enforces authorized issuer registry, template schemas, atomic batch issuance, fast status queries, temporary suspension, and permanent revocation. |
| **W3C VC Cryptography** | **Implemented & Verified** | [`packages/sdk`](../packages/sdk): RFC 8785 JSON Canonicalization Scheme (JCS) + SHA-256 hash commitments. 106 tests passing (`pnpm sdk:test`). Verified hash sensitivity to title, grade, recipient, and skill alterations. |
| **Digital Passport Vault & UI** | **Implemented & Verified** | [`apps/web`](../apps/web): Learner Vault, Institution Console, and Employer Verifier. Persistent state with 79 passing tests (`pnpm web:test`), including full multi-party user journey test. |
| **Testnet Contract Deployment** | **Deployed & Verified** | Live on Stellar Testnet ([`CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5`](https://stellar.expert/explorer/testnet/contract/CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5)). Contract instance and WASM code hash verified directly via Soroban RPC (`pnpm passport:verify:testnet`). |
| **Selective Disclosure Scope** | **v1 Document-Level Disclosure** | `createSelectiveCredentialView` filters displayed skills in software while preserving the parent credential root identifier for on-chain auditability. **This is not a zero-knowledge attribute proof.** Full ZK-SNARK or BBS+ selective attribute proofs without revealing the parent root hash are planned for v2. |

---

## 3. Privacy Claims & Cryptographic Boundaries

### A. What v1 Document-Level Disclosure Does
- Allows learners to export and share a redacted credential view containing only relevant competencies (e.g., sharing "Rust" and "Soroban" while omitting "Cryptography").
- Preserves the parent credential identifier (`urn:uuid:...`) so employers can verify the issuing institution and revocation status on the Stellar ledger.
- Encodes the filtered credential into a compact, URL-safe base64 string for QR codes.

### B. What v1 Does NOT Do (Planned for v2)
- **No Zero-Knowledge Attribute Proofs:** v1 does not cryptographically prove that a hidden credential contains an attribute without disclosing the parent credential identifier.
- **Root Preimage Correlation:** The parent root credential hash committed on-chain covers the full preimage. When sharing a filtered view, verifiers check the parent credential ID's status on-chain, but the filtered payload itself has a different SHA-256 digest from the unredacted root.
- **v2 Roadmap:** Cryptographic selective disclosure using BBS+ signatures or ZK-SNARK credential proofs is planned for version 2.

### C. Browser Storage (`localStorage`) Security Notice
- The web demo stores learner credentials and issuer records in the browser's `localStorage` for convenience during testing and demonstrations.
- **Security Limitation:** `localStorage` is accessible to scripts within the same origin and vulnerable to Cross-Site Scripting (XSS).
- **Production Requirement:** Production deployments must migrate private credential storage to WebAuthn / Passkey-encrypted client enclaves, native OS keychains, or hardware security modules (HSMs).

---

## 4. Off-Chain vs. On-Chain Enforcement

- **Student PII (Names, Grades, Transcripts):** 100% off-chain. No personal identifiable information is ever stored in Soroban contract state or emitted in unhashed event topics.
- **On-Chain Footprint:** Only 32-byte SHA-256 commitments (`credential_hash`), unique 32-byte identifiers (`credential_id`), status flags (Active, Suspended, Revoked), and issuer/recipient Stellar public keys are stored on ledger.
- **Issuer Authorization:** The Soroban contract strictly enforces that only administrator-approved institutions can issue credentials (`issuer.require_auth()` + `is_issuer_authorized`).

---

## 5. Auxiliary Sealed Allocation Round Module

The repository includes a secondary coordination primitive located at [`contracts/round`](../contracts/round):
- **Role:** Auxiliary sealed commit-reveal module designed for grant allocation, bounty escrow, and hackathon judging using Drand timelock encryption and Stellar Asset Contract (SAC) settlement.
- **Independence:** The **Education & Skills Passport** (`contracts/passport`) is the primary product surface. Do not conflate the sealed allocation contract's Mainnet test transactions with passport deployment status.
