# Verifier Trust Model & Cryptographic Verification Boundaries

## 1. Overview

The Decentralized Global Education & Skills Passport uses an on-chain/off-chain hybrid verification model built on **W3C Verifiable Credentials Data Model v1.1** and **Stellar Soroban smart contracts**.

This document explicitly defines:
1. **What the Verifier Proves** (mathematically and cryptographically on-chain).
2. **What the Verifier Trusts** (governance, infrastructure, and presentation boundaries).
3. **What the Verifier Does NOT Prove** (clear limitations and non-guarantees).
4. **Privacy Guarantees** across v1 (document-level and zero-PII anchor) vs v2 (ZK-SNARK / BBS+).

---

## 2. What the Verifier Proves

When an independent verifier runs `verifyEducationCredential()` or executes `verify_credential` on the Soroban smart contract, the following guarantees are cryptographically and deterministically proven:

### A. Document Integrity (RFC 8785 JCS + SHA-256)
- The SHA-256 hash commitment on-chain matches the cryptographic digest of the credential payload canonicalized under **RFC 8785 JSON Canonicalization Scheme (JCS)**.
- **Guarantee:** Not a single byte, skill, character of the degree title, honors distinction, or student identifier has been altered, forged, or tampered with since the issuer committed the hash to the ledger.

### B. Issuer Authorization & Status
- The issuer identity (`did:stellar:<ADDRESS>`) was formally approved, accredited, and recorded on-chain by the passport administrator.
- **Guarantee:** If an unauthorized party or diploma mill attempts to issue a credential under their own address, the on-chain contract rejects issuance or flags `issuer_authorized: false`.

### C. Real-Time On-Chain Lifecycle Status
- The credential record is looked up directly on the Stellar Soroban distributed ledger.
- **Guarantee:** The verifier accurately detects whether the credential is:
  - `Active`: In good standing.
  - `Suspended`: Temporarily held pending academic integrity review.
  - `Revoked`: Permanently invalidated with an immutable on-chain revocation reason.

### D. Temporal Validity (Expiration)
- If the credential has an `expirationDate` or on-chain `expires_at` timestamp, the verifier enforces that `now() < expires_at`.
- **Guarantee:** Expired credentials are unambiguously rejected.

---

## 3. What the Verifier Trusts

Cryptographic proofs depend on defined trust roots. The verifier trusts:

| Trust Root | Role & Responsibility | Failure Mode / Threat |
| :--- | :--- | :--- |
| **Contract Administrator** | Vetting and registering accredited educational institutions. | If admin keys are compromised, an attacker could authorize a malicious issuer. Multi-sig / governance DAO mitigates this. |
| **Issuing Institution** | Custody of private keys and accurate academic record-keeping. | If an institution's private key is leaked, unauthorized credentials could be issued under its name until deauthorized by admin. |
| **Soroban RPC Provider** | Faithful querying of ledger state and contract data. | An untrusted or compromised RPC endpoint could spoof historical ledger data. Verifiers can verify transactions against their own full validator node. |
| **Client Presentation Layer** | Correct filtering of redacted claims in v1 selective presentation. | In v1, selective disclosure is performed by the client software filtering the attributes. |

---

## 4. What the Verifier Does NOT Prove

To maintain absolute technical honesty and security rigor, the system explicitly does **NOT** prove the following:

### 1. Real-World Student Competence or Coursework Completion
On-chain verification proves that *the accredited institution committed this credential record*. It cannot independently verify whether the student actually attended lectures, completed examinations without cheating, or retained the taught skills.

### 2. Confidentiality via Hashing
**Hashing is NOT encryption.** A SHA-256 hash commitment is an irreversible one-way digest used for integrity validation. It does not conceal, encrypt, or protect credential contents if the raw payload is shared. Confidentiality requires end-to-end encrypted envelopes or zero-knowledge commitments.

### 3. W3C DataIntegrityProof / Linked Data Signatures
The v1 passport uses Soroban smart contract ledger state as its non-repudiation and authorization layer (`StellarSorobanHashCommitment2026`). It does not currently embed detached W3C Linked Data Signatures (`Ed25519Signature2020` or BBS+ `BbsBlsSignature2020`). Full cryptosuite interoperability is on the v2 roadmap.

### 4. Mathematical Zero-Knowledge Selective Disclosure (v1 vs v2)
- **v1 Mode:** Offers **Zero-PII On-Chain Anchor Links** (URL contains only `contractId`, `credentialId`, and `hash`, with zero PII in the URL) and software-level selective filtering.
- **v2 Mode (Roadmap):** Will implement BBS+ signatures and ZK-SNARKs allowing cryptographic proof of individual skills without exposing the parent credential or unrelated attributes.

### 5. Third-Party Security Audit Assurance
Passing all automated test suites (contract VM tests, SDK tests, web E2E tests, and Testnet lifecycle scripts) demonstrates functional correctness against tested scenarios, but is **NOT equivalent to an independent professional security review**. A formal external security review remains required prior to handling real student data in production.

---

## 5. Verification Matrix Summary

| Claim | Verified By | Mechanism | Guarantee Level |
| :--- | :--- | :--- | :--- |
| **Payload Integrity** | Client & Contract | RFC 8785 + SHA-256 | Cryptographic Proof |
| **Issuer Accreditation** | Smart Contract | Admin Registry | Cryptographic Ledger State |
| **Revocation / Suspension** | Smart Contract | Direct Ledger Query | Real-Time Distributed Consensus |
| **Zero-PII Link Sharing** | SDK & Web App | URL Hash Fragment Anchor | Client-Side Security Isolation |
| **Attribute Secrecy (v1)** | Web Presentation | Software Filter | Application Layer |
| **Attribute Secrecy (v2)** | ZK Primitives | BBS+ / ZK-SNARK | Cryptographic Proof |
