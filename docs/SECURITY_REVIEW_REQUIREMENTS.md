# Independent Security Review Requirements & Audit Readiness Guide

> [!CAUTION]
> **MANDATORY AUDIT REQUIREMENT PRIOR TO PRODUCTION DATA**
> This repository provides a hardened pre-production implementation and Stellar Testnet demonstration. **Automated unit tests, CI checks, and Testnet verification scripts DO NOT substitute for a formal third-party security audit.**
>
> Before processing real student PII, deploying to Stellar Mainnet, or issuing binding academic credentials, **an independent security audit by qualified Soroban and application security specialists is mandatory.**

---

## 1. System Scope Under Audit

1. **Soroban Passport Contract (`contracts/passport`):**
   - Two-step admin transfer (`propose_admin` / `accept_admin` alongside legacy `set_admin` warning surface), emergency `pause` / `unpause`, issuer registration/deauthorization/reactivation/`rotate_issuer_key`, bounded batch issuance (`MAX_BATCH_SIZE = 50`), input/length validation, template ownership checks, and permanent revocation finality (`PassportError` variants `1..=20`, [ERRORS.md](../contracts/passport/ERRORS.md)).
2. **TypeScript SDK (`packages/sdk/src/passport`):**
   - RFC 8785 UTF-16 JCS canonicalization, SHA-256 root commitments (`StellarSorobanHashCommitment2026`), salted per-claim commitments (`StellarSorobanSaltedClaims2026`), W3C VC DM v1.1 validation, W3C Data Integrity (`eddsa-jcs-2022`) signing/verification, share package privacy inspection, and `EducationPassportClient` error decoding.
3. **Web Application (`apps/web/src/passport` & headers):**
   - Content Security Policy (`script-src 'self'; object-src 'none'` in `_headers`, `vercel.json`, `index.html`), optional PBKDF2-SHA256 (150k+ iterations) + AES-256-GCM browser vault (`vaultCrypto.ts`), safe URL sanitization (`isSafeHttpOrIpfsUrl`), fragment scrubbing, Freighter signing delegation, and live Soroban Testnet RPC verifier (`EmployerVerifier.tsx`).

---

## 2. Specific Threat Vectors for Auditors

### A. Privilege & Access Control (`contracts/passport`)
- **Admin Governance:** Verify two-step admin transfer (`propose_admin` -> `accept_admin`), ensure legacy `set_admin` risk surface is evaluated for Mainnet removal/multisig, and verify emergency `pause` blocks state mutation while allowing read-only verification (`verify_credential`, `get_credential`).
- **Issuer Compromise & Recovery:** Confirm `deauthorize_issuer` immediately blocks issuing, template registration, metadata updates, suspending, revoking, and reactivating (`require_lifecycle_caller`), while `rotate_issuer_key` safely migrates control to a new key and prevents reuse of the compromised address.
- **Template Ownership Spoofing:** Verify an unauthorized/different issuer cannot reference a template registered by another institution (`issue_credential`).

### B. Forgery, Substitution, Replay & Batch Atomicity
- Verify non-zero ID/hash guards, self-issuance prohibition (`issuer != recipient`), duplicate `credential_id` rejection (`CredentialAlreadyExists`), and atomic rollback when any item inside `batch_issue_credentials` fails validation or duplicates an ID.
- Verify SDK cross-binding checks (`issuer` DID, `recipient` DID, `strictCredentialIdMatch`, `expectedContractId`, malformed dates, `eddsa-jcs-2022` signer mismatch).

### C. Selective Disclosure, URL Privacy & Frontend Storage
- **Salted Commitments vs. Weak-Entropy Guessing:** Verify per-claim 16-byte CSPRNG salts protect hidden low-entropy attributes (e.g., letter grades) from trivial dictionary reversal, while auditing the correlation risk of the shared `credentialHash` / `credentialId` root.
- **URL Fragment & Client Hygiene:** Audit browser history, clipboard copy behavior, QR rendering (`qr.tsx` `aria-label` isolation), prototype pollution guards in URL/JSON decoding, and XSS protections (`script-src 'self'`, URI scheme checks).
- **Encrypted Browser Vault (`vaultCrypto.ts`):** Audit Web Crypto PBKDF2 work factor (`>= 100,000`), random 16-byte salt + 12-byte GCM IV generation, AAD binding, plaintext localStorage scrubbing on encryption, and clearly verify that browser storage remains demo/transitional rather than hardware-backed enclave storage.

---

## 3. Auditor Artifacts & Verification Entrypoints

1. **Passport Contract Source & Error Reference:** [`contracts/passport/src`](../contracts/passport/src) & [`contracts/passport/ERRORS.md`](../contracts/passport/ERRORS.md)
2. **Contract Test Suite (32 tests):** `pnpm passport:test`
3. **Contract WASM, ABI & Error Parity Check:** `pnpm passport:check`
4. **SDK & Interop / Privacy Suites (123 tests):** `pnpm sdk:test` (`passport.test.ts`, `privacy.test.ts`, `interop.test.ts`)
5. **E2E Credential Lifecycle Scenarios (10 scenarios):** `pnpm lifecycle:passport`
6. **Frontend & Vault Security Suites (87 tests):** `pnpm web:test` (`vaultCrypto.test.ts`, `qr.test.ts`, `passportState.test.ts`, `userJourney.test.ts`)
7. **Live Testnet Verification &tx Archive Proof:** `pnpm passport:verify:testnet` against [`deployed-testnet.json`](../contracts/passport/deployed-testnet.json)
