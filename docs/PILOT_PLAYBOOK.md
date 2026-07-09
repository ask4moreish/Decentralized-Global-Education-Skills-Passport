# Pilot Playbook

Operational guide for turning the sealed commit–reveal primitive into running
pilots. Two pilots are tracked in parallel:

1. **Pilot 1 — OverBlock (internal):** the team's own builder-community
   playground, used as a sandbox for sealed judging, bounty allocation, and
   grant-style scoring workflows.
2. **Pilot 2 — Sealed credential portfolio (partner-led candidate):** a
   skills / credentials partner runs the same primitive against their own
   attestation surface. No partner confirmed yet — section is scope-only.

Both pilots share identical technical surface (same contract, same tlock
helpers, same SDK, same keeper) — only the **operator** changes. Run them
side-by-side so lessons from the internal pilot inform the partner-led
pilot and vice versa.

For the full vertical catalogue these two pilots map into, see
[`VERTICALS.md`](./VERTICALS.md).

---

## Positioning

Decentralized Global Education & Skills Passport is verifiable allocation infrastructure for Stellar grants,
hackathons, bounties, RFPs, and sealed auctions.

It keeps scores, bids, and allocation inputs unreadable until a shared reveal
time, then produces a public result that can be verified and settled on
Soroban.

The same primitive powers both OverBlock (internal sealed-grading) and any
sealed credential portfolio a partner adopts — see
[`VERTICALS.md`](./VERTICALS.md) for the vertical catalogue as a whole.

---

## Pilot portfolio

| # | Pilot | Operator type | Workflow | Today |
|---|---|---|---|---|
| 1 | **OverBlock** | Internal builder-community (the team's own environment) | Sealed judging, bounty allocation, grant-style scoring | **Active** — see § Pilot 1 |
| 2 | **Sealed credential portfolio** | Skills / credentials partner (TBD) | Sealed attestations, selective reveal to verifiers | **Planned, scope-only** — see § Pilot 2 |

The two pilots track different conversations:

- **Pilot 1 (OverBlock)** is run end-to-end by the team and exercises
  workflows the team controls — the external ask here is *visibility +
  partnership readiness*, not partner operations.
- **Pilot 2 (credential portfolio)** is partner-led — somebody else's
  attestation surface gets sealed-reveal fairness bolted on. The external
  ask is *active outreach* to one partner.

---

## Pilot 1 — OverBlock (internal)

OverBlock is the team's own builder-community playground and serves as the
**first internal pilot**. It exercises the sealed judging, bounty
allocation, and grant-style scoring patterns on workflows the team controls
end-to-end.

The internal pilot validates:

- whether organizers can create and monitor a sealed scoring round;
- whether judges understand the commit and reveal flow;
- whether sealed inputs reduce anchoring and late-score influence;
- whether the final result, settlement/refund state, and receipt are clear;
- what an external organizer needs to integrate or operate the workflow.

**Components:** the same primitives as the production solution —
`packages/sdk` for round creation / commit / reveal lifecycle, `packages/tlock`
for the cryptographic seal, `services/keeper` for permissionless
reveal / clear / settle, and the receipt codec in `packages/sdk` for the
post-round export / offline verify. The
[`examples/grant-scoring`](../examples/grant-scoring/README.md) package runs
offline as a fixture pilot for the OverBlock internal scoring workflow — see
the grants/scoring row of `VERTICALS.md` for the proof attribution.

---

## Pilot 2 — Sealed credential portfolio (partner-led candidate)

Pilot 2 is a **partner-led pilot candidate** — a skills / credentials partner
runs the same primitive against their own attestation surface. Goal:

- prove the primitive supports an attestation workflow *without* a contract
  change;
- expose partner-side ergonomics (issuer → holder → verifier) under
  real-world conditions;
- build a public, reusable attestation example for downstream partners.

### Workflow sketch

1. **Issuer** publishes an attestation for a holder (e.g. course completion,
   certified credential) and submits a sealed commit to a Stellar round
   using `packages/tlock`'s timelock seal helper — `sealBid` works for any
   value-shaped payload (bid **or** attestation; the same primitive treats
   the sealed payload as opaque to the contract).
2. **Holder** stores the receipt (`exportReceipt`) — the receipt's
   `networkFingerprint` binds the issuer's claim to the Soroban network
   the contract lives on, so any verifier can offline-recompute the
   commitment and the settlement outcome.
3. **Verifier** (employer / issuing body / regulator) requests a reveal
   after the preset Drand round R; the keeper (`services/keeper`) drives
   `open_reveal` once the BLS signature is published on Drand quicknet.
4. **Identity** (issuers, holders) stays cipher-only until the round
   auditor key unlocks the blob — values become public post-R; identities
   stay selective-disclosure-only via the auditor (X25519 AEAD to the
   auditor pubkey per `THREAT_MODEL.md`).

### Components (unchanged from any other vertical)

- `packages/tlock` for the cryptographic seal and `openBid` after R
- `packages/sdk` for the client + receipt codec (`exportReceipt`,
  `redactReceipt`, `verifyReceipt`, `parseReceipt`)
- `services/keeper` for permissionless reveal / clear / settle
- `apps/web` offline receipt verifier (already covered by the
  `buildExportBundle.test.ts` / `permalink.test.ts` test suites) for the
  post-round frontend

**No contract change required** — the WASM at `contracts/round` is a generic
sealed-commit–reveal state machine. The credential-portfolio vertical adds
zero new lines to the Rust crate; the surface lives entirely above the
contract.

### Partner-sketch (categories of partner)

- **Skills / credentials platforms** that already issue searchable
  attestations and want fairness guarantees before results are visible to
  participants.
- **LMS / course providers** that want to time-control the public
  visibility of cohort outcomes (e.g. release exam scores after R so
  cohort participants see them simultaneously).
- **Education consortia** that batch-verify sealed credential receipts
  across member organizations (one round per term, one verifier per
  member org, deterministic final outcome).

> Do not describe a partner pilot as confirmed until the partner explicitly
> agrees to run it. Until then, this section is scope-only.

### Pilot 2 — scope: what is *and isn't* in this candidate

**In scope:** the same `packages/{tlock,sdk}` + `services/keeper` surface
used by every other vertical; the receipt verifier (`apps/web`) already
covers the post-round verification flow; the SDK's `redactReceipt` helper
keeps operator / holder addresses out of shared exports; the
`serializer / parser` round-trip ensures downstream tools that consume
`packages/sdk` can also consume a credential-portfolio receipt unchanged.

**Out of scope (would be a different workstream):** W3C Verifiable
Credentials data-model alignment; native issuer-onboarding tooling;
credential revocation registries; zero-knowledge proof wrappers. None of
those is on the critical path for the SCF #44 / CV Labs / mainnet launch —
they belong to a follow-on tranche once a partner is confirmed and the
core pilot loops are exercised end-to-end.

---

## External pilot ask (split by pilot type)

### For Pilot 1 / OverBlock — visibility + partnership readiness

Target five small **visibility** conversations:

1. Rise In / Build on Stellar organizer
2. Stellar hackathon organizer
3. SCF or Stellar ecosystem builder
4. DAO or community operator
5. Project distributing grants or bounties

Suggested message (unchanged from the prior framing):

> Decentralized Global Education & Skills Passport won 1st Place in the Hack Privacy Track at Build On Stellar. We are
> now turning the protocol into verifiable allocation infrastructure for
> sealed judging, bounty allocation, grant scoring, RFPS, and sealed auctions
> on Stellar. Would you be open to a small pilot using one upcoming judging or
> allocation workflow?

> Do not describe an external pilot as confirmed until the organizer
> explicitly agrees to run it.

### For Pilot 2 / Credential portfolio — active partner outreach

Target three categories of partner:

1. **Skills / credentials platforms** that already issue searchable
   attestations and want fairness before results are visible.
2. **LMS / course providers** that time-control cohort outcome visibility.
3. **Education consortia** that batch-verify receipts across member orgs.

Suggested message (sketch):

> The Soroban sealed commit–reveal primitive at `skills-passport-round` keeps
> attestations unreadable until a public Drand round unlocks them — same
> fairness model that won 1st Place at Build On Stellar Hack Privacy. We are
> looking for one education/credentials partner willing to run a small sealed
> attestation pilot end-to-end. Would your team be open to that conversation?

> Do not describe a partner pilot as confirmed until the partner explicitly
> agrees to run it.

---

## SCF-style demo narrative (Pilot 1 — OverBlock)

Remains unchanged — exercises OverBlock's sealed-grading flow.

The SCF-facing walkthrough should make the allocation workflow obvious:

1. Five projects enter a grant round.
2. Three judges submit sealed scores.
3. Scores remain unreadable until the reveal time.
4. Drand unlocks the reveal and the final result becomes public.
5. Soroban shows deterministic settlement and refunds.
6. The organizer receives a public proof/receipt for the round.

The current live grant-scoring case demonstrates the sealed-score primitive.
The next demo iteration should add the multi-project allocation view and a
single organizer receipt that ties scoring, result, and settlement together.

### Demo narrative for Pilot 2 / Credential portfolio (when a partner is confirmed)

When a partner confirms Pilot 2, the demo narrative expands:

1. Issuer signs and submits a sealed attestation via the partner's portal.
2. Holders see only a placeholder ("announced at round R") until reveal.
3. Verifier requests the reveal at R; the keeper drives `open_reveal`.
4. Holders' identities (issuers + holders) remain redacted in public exports
   — only the round auditor can decrypt identity blobs, per the
   `THREAT_MODEL.md`.

---

## Short social post (covers both pilots)

Decentralized Global Education & Skills Passport won 1st Place in the Hack Privacy Track at Build On Stellar. We are
now preparing small Stellar pilots for sealed judging, bounty allocation, and
grant-style scoring: inputs stay hidden until reveal, then the result is
publicly verifiable and settled on Soroban.

Alongside the internal OverBlock pilot, we are scoping a partner-led
**sealed credential portfolio** pilot — same primitive, no contract change —
applied to skills / credentials attestation partners that want sealed-reveal
fairness.

If you run a hackathon, grant, bounty, DAO, RFP, or skills / credentials
workflow, would you be open to a small pilot?
