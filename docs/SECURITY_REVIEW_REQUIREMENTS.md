# Independent Security Review Requirements & Audit Readiness Guide

> [!CAUTION]
> **MANDATORY AUDIT REQUIREMENT PRIOR TO PRODUCTION DATA**
> This repository provides a verified pre-production implementation and Testnet demonstration on Stellar Soroban. **Automated unit tests, CI test matrices, and Testnet transaction verifications DO NOT constitute a formal cryptographic or smart contract security audit.**
> 
> Before processing real student records, deploying to Stellar Mainnet, or issuing legally binding academic credentials, **a formal, independent third-party security review by certified smart contract and application security specialists is strictly mandatory.**

---

## 1. Scope of the System Under Review

The Decentralized Global Education & Skills Passport comprises four primary layers:

1. **Soroban Core Contract (`contracts/passport`):**
   - Implements issuer registration, credential template definitions, atomic batch issuance, status transitions (Active, Suspended, Revoked), and on-chain verification query entrypoints.
2. **TypeScript SDK & Cryptographic Pipeline (`packages/sdk`):**
   - W3C Verifiable Credentials formatting, RFC 8785 JSON Canonicalization Scheme (JCS) deterministic serialisation, SHA-256 hash commitment derivation, document-level selective disclosure presentation views, and share package encoding.
3. **Web Application & Local Storage (`apps/web`):**
   - Learner Passport Vault, Educational Institution Console, Employer Verification Portal, and wallet connection integrations.
4. **Soroban RPC Integration Layer:**
   - Stateless read queries, transaction simulation, fee estimation, and timeout/failure handling.

---

## 2. Threat Vector Checklist for Independent Auditors

Independent auditors should inspect the following specific threat vectors:

### A. Unauthorized Issuer Registration & Credential Issuance
- **Admin Privilege Escalation:** Verify that only the designated contract administrator (`storage::get_admin`) can call `register_issuer`, `deauthorize_issuer`, and `set_admin`.
- **Issuance Authority Checks:** Verify that `issue_credential` and `batch_issue_credentials` enforce `issuer.require_auth()` and check `is_issuer_authorized`. Confirm that an unregistered or deauthorized address cannot insert credentials into the ledger.
- **Race Conditions:** Verify that concurrent issuance requests cannot corrupt ledger balances or learner credential indexes.

### B. Credential Tampering, Replay, Duplicate Issuance & Forgery
- **Hash Sensitivity & Canonicalization:** Verify that alterations to any credential field (e.g., student name, grades, institution name, issuance date) produce an entirely different SHA-256 digest under RFC 8785 canonicalization.
- **Recipient DID Substitution Attacks:** Test whether an attacker can replace the recipient address/DID in an intercepted credential and pass on-chain verification.
- **Replay / ID Collision:** Confirm that attempting to register an identical `credential_id` is rejected by the contract (`PassportError::CredentialAlreadyExists`).

### C. Revocation, Suspension, Reactivation & Expiry Enforcement
- **Caller Authorization for Revocation:** Ensure only the original issuing institution or the contract administrator can revoke or suspend credentials.
- **Irreversibility of Revocation:** Verify that a credential with status `Revoked` cannot be reactivated under any circumstance (`PassportError::CredentialAlreadyRevoked`).
- **Suspension Lifecycle:** Verify that suspended credentials fail verification (`is_valid: false`) during the suspension window, and can only be restored to `Active` by an authorized caller.
- **Expiration Timestamp Checks:** Verify that credentials with an expired ledger timestamp are unambiguously flagged as expired and invalid.

### D. Admin & Issuer Key Security & Failure Recovery
- **Key Loss & Rotation:** Assess administrative key rotation procedures via `set_admin`.
- **Threshold Signatures & Multisig:** Evaluate whether high-volume institutional issuers require multi-signature accounts or Soroban smart account policies rather than single-signature Ed25519 keys.
- **Emergency Deauthorization:** Confirm that deauthorizing a compromised institution key immediately flags all credentials issued by that key as untrusted.

### E. Exposure of Personally Identifiable Information (PII)
- **Zero On-Chain PII Guarantee:** Confirm that zero student names, grades, or personal details are persisted in Soroban contract storage or emitted in unhashed event topics.
- **Log Sanitization:** Review backend and frontend logging to prevent credential preimages from leaking into monitoring logs or telemetry.
- **URL & QR Code Leakage:** Assess whether URL query parameters in sharing links (`?data=...`) leak confidential attributes via browser history or referer headers.
- **Browser `localStorage` Vulnerability:** Assess the security implications of storing private credentials in browser-accessible `localStorage` in the web application. Detail mitigation requirements (such as migrating to WebAuthn / Passkey-encrypted client enclaves or native keychain storage) for production.

### F. Failure Behavior, Stale Data & Network Degradation
- **RPC Availability:** Confirm that when Soroban RPC calls fail, time out, or return malformed responses, the client reports an explicit, non-blocking error rather than treating the failure as verification success.
- **Stale Ledger Data:** Confirm that verification results always reflect the authoritative current ledger state and do not cache verification success indefinitely.

---

## 3. Cryptographic Boundary Assumptions

1. **Hash Commitments:**
   - Security depends on SHA-256 collision resistance and preimage resistance.
   - Deterministic sorting uses RFC 8785 JSON Canonicalization Scheme (JCS).
2. **Selective Disclosure Boundary:**
   - **v1 Scope (Document-Level Selective View):** The current implementation provides UI/payload-level filtering (`createSelectiveCredentialView`). It shares a redacted subset of attributes while referencing the parent credential root identifier for auditability.
   - **v2 Scope (Planned Cryptographic Attribute Proofs):** Proving individual claims without disclosing the parent credential root hash or other claims requires zero-knowledge cryptographic primitives (e.g., BBS+ signatures or ZK-SNARKs), scheduled for v2.

---

## 4. Auditor Package & Evidence Artifacts

Auditors can review the following self-contained reproducible artifacts:

1. **Soroban Contract Source:** [`contracts/passport/src`](../contracts/passport/src)
2. **Soroban Contract Test Suite (19 tests):** [`contracts/passport/src/test.rs`](../contracts/passport/src/test.rs) (`pnpm passport:test`)
3. **Cryptographic SDK Suite (100 tests):** [`packages/sdk/src/passport.test.ts`](../packages/sdk/src/passport.test.ts) (`pnpm sdk:test`)
4. **End-to-End Lifecycle Scenarios (10 scenarios):** [`scripts/e2e-credential-lifecycle.mjs`](../scripts/e2e-credential-lifecycle.mjs) (`pnpm lifecycle:passport`)
5. **Direct Testnet Verification Runner:** [`scripts/verify-testnet-contract.mjs`](../scripts/verify-testnet-contract.mjs) (`pnpm passport:verify:testnet`)
6. **Live Testnet Lifecycle Execution:** [`scripts/testnet-e2e-live.mjs`](../scripts/testnet-e2e-live.mjs) (`pnpm passport:lifecycle:testnet`)
7. **Testnet Contract Deployment Artifact:** [`contracts/passport/deployed-testnet.json`](../contracts/passport/deployed-testnet.json)
