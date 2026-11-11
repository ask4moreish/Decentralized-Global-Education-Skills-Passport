# Verifier Trust Model & Cryptographic Verification Boundaries

## 1. Overview

The Decentralized Global Education & Skills Passport uses a hybrid on-chain/off-chain verification model combining **W3C Verifiable Credentials Data Model v1.1** documents, **RFC 8785 JCS SHA-256** commitments, optional **W3C Data Integrity (`eddsa-jcs-2022`)** Ed25519 signatures, and **Stellar Soroban** registry contracts.

This document defines:
1. **What the Verifier Proves** cryptographically and against Soroban ledger state.
2. **What the Verifier Trusts** across governance, RPC infrastructure, and holder browsers.
3. **What the Verifier Does NOT Prove** (explicit non-guarantees).
4. **W3C Interoperability & Selective Disclosure Model Comparison**.

---

## 2. What the Verifier Proves

When a verifier runs `verifyEducationCredential()` or queries `verify_credential` on Soroban:

### A. Document Integrity (`RFC 8785 JCS + SHA-256`)
- Computed canonical JSON hash matches `proof.credentialHash` and the 32-byte `credential_hash` recorded on-chain (using exact UTF-16 code-unit sorting per RFC 8785).
- For **`StellarSorobanSaltedClaims2026`** credentials, each disclosed claim matches `SHA256("skp-claim-v1:" + key + ":" + saltHex + ":" + JCS(value))` against its committed entry in `proof.selectiveDisclosure.commitments`, while the root digest covers all commitments + issuer metadata. Omitted attributes cannot be verified unless disclosed, and any injected/altered claim or missing salt invalidates verification.

### B. Optional W3C Data Integrity Signature (`eddsa-jcs-2022`)
- When a `DataIntegrityProof` with `cryptosuite: "eddsa-jcs-2022"` is attached (standalone or in a multi-proof array `[StellarSoroban*, DataIntegrityProof]`), verification follows W3C Data Integrity EdDSA Cryptosuites v1.0:
  - Signs/verifies `SHA256(JCS(proofConfig)) || SHA256(JCS(unsecuredDocument))` with Pure Ed25519 and base58-btc multibase (`z...`).
  - Resolves public keys offline from `did:key:z6Mk...` (multicodec `0xed01`) or `did:stellar:G...`, and checks that the signing key matches the `issuer.id` Stellar account.

### C. Issuer Authorization & On-Chain Lifecycle Status
- Confirms `is_issuer_authorized(issuer)` against Soroban ledger state (or demo cache when explicitly in Demo mode) and enforces real-time status: `Active`, `Suspended` (`is_valid = false`), `Revoked` (`is_valid = false` + reason), and temporal expiration (`now >= expires_at`).

---

## 3. What the Verifier Trusts

| Trust Root | Role & Responsibility | Failure Mode / Threat |
| :--- | :--- | :--- |
| **Contract Administrator** | Vetting/registering issuers; two-step `propose_admin` -> `accept_admin` transfer and emergency `pause` in hardened contract. | Compromised admin key could authorize a rogue issuer or pause issuance until recovered/transferred. |
| **Issuing Institution** | Custody of issuer signing keys and truthfulness of academic claims; `rotate_issuer_key` / `deauthorize_issuer` handle key rotation/compromise. | Leaked issuer key allows fraudulent issuance until deauthorized; off-chain dishonesty (diploma mill vetted as real) cannot be caught by hash math alone. |
| **Soroban RPC Node** | Faithful ledger state & transaction simulation responses for [`CAP3J5ZOK...`](https://stellar.expert/explorer/testnet/contract/CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5). | Malicious or stale RPC node could serve outdated status; independent verifiers should cross-check or run their own Stellar RPC/Horizon node. |
| **Browser Environment (UI)** | Protecting unlocked React memory, QR rendering, and clipboard/history hygiene. | Same-origin XSS or compromised browser extensions can inspect unlocked DOM, storage, or shared URLs. |

---

## 4. What the Verifier Does NOT Prove

### 1. Real-World Student Competence
Blockchain verification proves only that a registered issuer key committed that credential hash on Stellar. It does not verify exam proctoring or real-world mastery.

### 2. Zero-Knowledge Unlinkability or Attribute Confidentiality on Raw Payloads
- **Hashing is NOT encryption.** Anyone holding an unredacted credential JSON can read every claim.
- **Salted Selective Disclosure != ZK Proofs:** `StellarSorobanSaltedClaims2026` hides omitted claims and their 128-bit salts in redacted shares, raising the barrier against dictionary guessing, **but** presentations still share `credentialHash` / `credentialId` (making presentations linkable across verifiers) and reveal the selected plaintext values. Full ZK unlinkability requires BBS+ or ZK-SNARKs (not implemented).

### 3. Universal W3C Cryptosuite Support
Only **`eddsa-jcs-2022`** (JCS canonicalization + Ed25519) and custom **`StellarSorobanHashCommitment2026` / `StellarSorobanSaltedClaims2026`** proofs are supported. Explicitly **unsupported** suites that are rejected cleanly:
- `eddsa-rdfc-2022`, `Ed25519Signature2020`, `Ed25519Signature2018` (JSON-LD RDF Dataset Canonicalization / URDNA2015)
- `bbs-2023`, `BbsBlsSignature2020`, `BbsBlsSignatureProof2020` (BLS12-381 pairing ZK signatures)
- `ecdsa-rdfc-2019`, `ecdsa-jcs-2019`, `JsonWebSignature2020`

### 4. Browser History or Screenshot Immunity via `#` URL Fragments
Hash fragments (`#/passport/verify?...`) keep parameters off HTTP server access logs and `Referer` headers, and the web verifier scrubs them from `window.location.hash` after verification. **They do NOT erase prior browser history entries, OS clipboard history, chat link previews, forwarded links, or screenshots.**

### 5. Security Audit Equivalence
Passing automated contract, SDK, web, and Testnet checks is engineering regression testing—**NOT an independent third-party security audit**.

---

## 5. Verification Matrix Summary

| Claim | Mechanism | Guarantee Level |
| :--- | :--- | :--- |
| **Document Byte Integrity** | RFC 8785 JCS + SHA-256 (`credentialHash`) | Cryptographic Integrity Proof |
| **Issuer Ed25519 Signature** | W3C Data Integrity `eddsa-jcs-2022` (`did:key` / `did:stellar`) | Standard W3C Public-Key Signature |
| **Issuer Authority & Revocation** | Soroban Ledger State (`verify_credential`) | Ledger Consensus (RPC Trusted) |
| **Salted Attribute Redaction** | `StellarSorobanSaltedClaims2026` (128-bit per-claim salts) | Hash-Hidden Omitted Claims (Linkable Root; Not ZK) |
| **Zero-PII Anchor URLs** | `#/passport/verify?cid=...&id=...&h=...` | Off-Log Anchor Only (Ledger Pubkeys Remain Public) |
| **Unlinkable ZK Credentials** | BBS+ / ZK-SNARK | **Not Implemented** |
