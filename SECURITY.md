# Security Policy

Security is central to this project: it coordinates *funds* (SAC escrow) and
*confidentiality* (sealed bids) on Stellar Soroban. We treat security reports
seriously.

## Reporting a vulnerability

**Do not open a public GitHub issue** for a security vulnerability.

Report it privately to the maintainers via GitHub's private reporting flow:

1. Go to the repository **Security** tab → **Report a vulnerability**
   (https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/security/advisories/new)
2. Include a clear description, affected components, and a proof-of-concept or
   reproduction steps if possible.

We will acknowledge your report within 5 business days and aim to provide a
resolution or status update within 30 days. We follow a coordinated-disclosure
process and will credit reporters who wish to be named.

## Scope

| Area | In scope |
| --- | --- |
| `contracts/round` | Escrow accounting, settlement/refund logic, BLS12-381 Drand verification gate, storage TTL handling, state-machine transitions |
| `packages/tlock` | tlock seal/open, auditor identity blob (X25519 + XChaCha20-Poly1305), commitment encoding |
| `packages/sdk` | Transaction encoding/decoding, receipt verification, preflight, submitter adapters |
| `services/*` | Keeper, appraisal API (x402), agent mandate enforcement |

### Out of scope

- Anything that requires the adversary to hold the victim's secret keys.
- Known, documented limitations — see [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md)
  and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md). In particular: mandate
  caps are enforced off-chain by agent software, not the contract; the appraisal
  price is not enforced on-chain; and receipts are offline-consistency checks,
  not a proof of current on-chain state.

## Important note on deployed contracts

The `Round` contract is **immutable** (no upgrade path, no admin key) — this is
intentional and documented in [`ARCHITECTURE.md`](ARCHITECTURE.md). A confirmed
contract vulnerability may require a redeployment and a public notice rather
than a patch. Please disclose contract findings promptly for this reason.

## Preferred languages

English.
