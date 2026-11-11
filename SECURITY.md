# Security Policy

Security is central to this project: it coordinates *funds* (SAC escrow) and
*confidentiality* (sealed bids) on Stellar Soroban. We treat security reports
seriously.

## Reporting a vulnerability

**Do not open a public GitHub issue** for a security vulnerability.

Report it privately to the maintainers via GitHub's private reporting flow:

1. Go to the repository **Security** tab → **Report a vulnerability**
   (https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/security/advisories/new)
2. Include a clear description, affected components, and a proof-of-concept or
   reproduction steps if possible.

We will acknowledge your report within 5 business days and aim to provide a
resolution or status update within 30 days. We follow a coordinated-disclosure
process and will credit reporters who wish to be named.

## Scope

| Area | In scope |
| --- | --- |
| `contracts/passport` | Issuer authorization, admin two-step transfer, pause circuit breaker, issuer key rotation, commitment uniqueness, revocation finality ([ERRORS.md](contracts/passport/ERRORS.md)) |
| `contracts/round` | Escrow accounting, settlement/refund logic, BLS12-381 Drand verification gate, storage TTL handling, state-machine transitions |
| `packages/sdk` | `EducationPassportClient`, RFC 8785 JCS hashing, salted claim commitments, W3C `eddsa-jcs-2022` Data Integrity, `SkillsPassportClient`, receipt verification |
| `packages/tlock` | tlock seal/open, auditor identity blob (X25519 + XChaCha20-Poly1305), commitment encoding |
| `apps/web` | Client-side PBKDF2-SHA256 + AES-256-GCM encrypted vault, CSP (`script-src 'self'`), fragment scrubbing, Freighter signing, live Soroban verifier |
| `services/*` | Keeper, appraisal API (x402), agent mandate enforcement |

### Out of scope

- Anything that requires the adversary to hold the victim's secret keys or vault passphrase.
- Known, documented limitations — see [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md),
  [`docs/VERIFIER_TRUST_MODEL.md`](docs/VERIFIER_TRUST_MODEL.md), and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).
  In particular: browser `localStorage` is demo-grade storage unless hardened by an OS/hardware enclave;
  salted claim commitments are not ZK-SNARKs or BBS+ unlinkable proofs; mandate caps are enforced off-chain;
  and offline receipts do not guarantee current ledger state without RPC lookup.

## Important note on deployed contracts

The `Round` contract (`contracts/round`) is **immutable** (no upgrade path, no admin key) — this is
intentional and documented in [`ARCHITECTURE.md`](ARCHITECTURE.md). The Education Passport contract
(`contracts/passport`) uses role-based authorization (`admin`, authorized `issuer`s, emergency `pause`)
with irreversible credential revocation. A confirmed contract bug requires deploying a patched WASM instance.

## Preferred languages

English.
