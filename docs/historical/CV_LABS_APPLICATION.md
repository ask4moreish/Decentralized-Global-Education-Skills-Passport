# Stellar x CV Labs Accelerator Application

> **Read first — today's primitive-first narrative.** Today's Soroban sealed commit–reveal coordination primitive powers four verticals tracked in parallel: **Grants** (SCF-style judge panels), **RFPs** (procurement), **Auctions** (closed-bid books), and **Credentials** (planned), with two pilots — OverBlock (internal) and a sealed credential portfolio (partner-led candidate).
>
> For today's commercial wedge, GTM scope, and pilot portfolio, see [../README.md](../../README.md), [../ARCHITECTURE.md](../../ARCHITECTURE.md), [../PILOT_PLAYBOOK.md](../PILOT_PLAYBOOK.md), and [../INTEGRATION.md](../INTEGRATION.md). The body below is the original 2026 CV Labs Accelerator application draft, preserved verbatim per [docs/historical/README.md](./README.md).

Working draft for the 2026 Stellar x CV Labs Accelerator application.

## Recommendation

Apply.

Decentralized Global Education & Skills Passport is eligible and strategically aligned because it is:

- based in EMEA;
- already built natively on Stellar and Soroban;
- an early-stage project with a working product, testnet lifecycle, and mainnet
  proof;
- relevant to financial coordination through sealed auctions, procurement,
  RFPs, capital allocation, and other workflows where early information leakage
  creates unfair outcomes.

The accelerator is separate from SCF #44. The application should disclose the
active SCF #44 submission and clearly separate the scopes:

| Program | Proposed scope |
| --- | --- |
| SCF #44 Build Award | Harden and package the open-source protocol, SDK, keeper, testnet pilots, and mainnet launch |
| Stellar x CV Labs Accelerator | Validate the commercial wedge, secure design partners, develop GTM, and become investor-ready |

If both programs provide development funding, confirm the scopes and budgets
with SDF before accepting funds so that no deliverable is funded twice.

## Program Facts

- Application deadline: July 3, 2026
- Format: 12 weeks, remote-first
- Region: teams based in or building for EMEA
- Focus: DeFi, payments, and real-world assets
- In-person component: Cape Town, South Africa
- Demo Day: Stellar Meridian, Lisbon, October 2026
- Potential support: up to $150,000 in XLM from SDF, mentorship, ecosystem
  perks, and investor introductions

Funding and participation terms, including any equity or token rights, must be
confirmed before acceptance.

## Positioning For This Application

### One-line pitch

Decentralized Global Education & Skills Passport is sealed execution infrastructure for Stellar: financial applications
can collect bids, scores, and allocation decisions privately, reveal them
simultaneously, and settle the outcome transparently on-chain.

### Short description

Public blockchains reveal information too early. In auctions, procurement,
capital allocation, and competitive financial workflows, that leakage lets late
participants react to earlier inputs and forces users to trust an operator.

Decentralized Global Education & Skills Passport removes that operator from the trust path. Participants submit
timelock-encrypted decisions and escrow to a Soroban contract. A future public
Drand round unlocks every valid submission at the same time; the contract then
verifies, clears, and settles the outcome deterministically using Stellar
assets.

Decentralized Global Education & Skills Passport is delivered as an embeddable Soroban primitive, TypeScript SDK, tlock
package, and permissionless keeper rather than only as a hosted application.

### Commercial wedge

Start with sealed auctions and procurement/RFP workflows for Stellar ecosystem
teams and asset issuers. These use cases have:

- an obvious cost of information leakage;
- measurable transaction and settlement activity;
- a clear buyer or integration partner;
- a natural path from a pilot to recurring infrastructure usage.

DAO voting, grant scoring, bounty judging, and token allocation remain supported
integration templates, but they should not lead the accelerator pitch.

## Draft Application Answers

### What problem are you solving?

Transparent ledgers are valuable after a financial decision is finalized, but
harmful while participants are still making competing decisions. Visible bids,
scores, and demand signals create front-running, strategic copying, and unfair
late-mover advantages. Existing systems avoid this by trusting a centralized
operator to keep submissions secret.

Decentralized Global Education & Skills Passport provides timed confidentiality with public settlement. Inputs remain
unreadable until a predetermined deadline, then become simultaneously
verifiable and settleable on Stellar without operator discretion.

### What is your solution?

Decentralized Global Education & Skills Passport is a sealed coordination protocol built on Soroban. Applications create
a round with deadlines, a future Drand round, a clearing rule, and a Stellar
asset for escrow. Participants submit commitments and timelock-encrypted inputs.
When the chosen Drand round is published, anyone can open the reveal phase. The
contract verifies the Drand BLS signature on-chain, validates reveals, clears the
round, and settles escrow and refunds deterministically.

Integrators use the protocol through a TypeScript SDK, tlock helpers, and a
permissionless keeper service.

### Why Stellar?

Stellar is part of the product's execution and settlement path:

- Soroban enforces the sealed-round lifecycle and verifies the unlock condition.
- Stellar Asset Contracts provide escrow, settlement, and refunds.
- Fast, low-cost finality makes repeated coordination rounds practical.
- Stellar's focus on real-world financial infrastructure creates a natural
  market for fair auctions, procurement, and allocation workflows.

Decentralized Global Education & Skills Passport already has a Stellar mainnet contract and a settled mainnet proof
using native XLM, plus full USDC and multi-agent lifecycle proofs on testnet.

### What traction do you have?

- Won 1st Place in the Hack Privacy Track at the Build On Stellar Hackathon,
  IBW 2026.
- Built and open-sourced the Soroban round contract, TypeScript SDK, tlock
  package, permissionless keeper, multi-agent proof, and integration
  documentation.
- Completed a full two-bidder USDC lifecycle on Stellar testnet.
- Completed an end-to-end multi-agent flow with x402 appraisal, sealed commits,
  keeper reveal, and settlement on Stellar testnet.
- Deployed and settled a live round on Stellar mainnet using native XLM.
- Submitted a $100,000 SCF #44 Build Award application, "Sealed Coordination
  System on Stellar."

Current traction is technical and ecosystem validation. The next objective is
to convert it into design-partner pilots and repeat usage.

### What is your business model?

The core protocol and SDK will remain open source. The initial commercial model
is managed infrastructure and integration support:

- hosted keeper and round-monitoring operations;
- usage-based fees for managed sealed-round execution;
- implementation and support packages for teams embedding Decentralized Global Education & Skills Passport;
- enterprise features such as operational reporting, policy controls, and
  service-level agreements.

The accelerator will be used to validate pricing and identify which managed
service creates the strongest recurring demand.

### Who are your customers?

The initial customers are Stellar ecosystem applications, asset issuers, and
financial platforms that run competitive allocation processes:

- auction and marketplace operators;
- procurement and RFP platforms;
- tokenized-asset and capital-allocation products;
- DeFi applications that need sealed order or intent collection;
- grant, bounty, and governance platforms requiring blind evaluation.

The first GTM target is a small set of Stellar-based design partners with a
concrete sealed-auction or RFP workflow.

### What is your competitive advantage?

Decentralized Global Education & Skills Passport combines timed confidentiality and deterministic Stellar settlement in
one reusable integration layer. It does not require a trusted reveal operator,
and it does not keep final outcomes private: early information stays hidden,
while final outcomes remain public and verifiable.

The working implementation already includes the Soroban contract, on-chain
Drand BLS verification, Stellar asset escrow, SDK, keeper, threat model, and
mainnet proof. This reduces integration risk for partners compared with building
the cryptography and operations themselves.

### What will you achieve during the accelerator?

1. Select and validate the strongest commercial wedge: sealed auctions,
   procurement/RFPs, or capital allocation.
2. Secure at least three design partners and launch at least one live pilot.
3. Define pricing and a repeatable managed-infrastructure offering.
4. Improve partner onboarding, monitoring, and operational readiness.
5. Complete a security review plan and production launch roadmap.
6. Build an investor-ready narrative, data room, and fundraising strategy.

### Why this accelerator?

Decentralized Global Education & Skills Passport has moved beyond concept risk: the protocol works on Stellar testnet
and mainnet. Its largest remaining risk is market selection and distribution.
The Stellar x CV Labs Accelerator directly addresses that gap through access to
Stellar ecosystem teams, financial-use-case mentors, GTM support, design
partners, and investors.

The program can help turn a technically validated Stellar primitive into
adopted financial infrastructure.

### How does SCF #44 relate to this application?

Decentralized Global Education & Skills Passport has an active $100,000 SCF #44 Build Award submission focused on
open-source technical productization: hardening the contract, packaging the SDK,
running testnet pilots, and preparing a mainnet launch.

This accelerator application is focused on company-building: selecting a
commercial wedge, securing design partners, validating pricing and GTM, and
becoming investor-ready. We will transparently coordinate scopes and budgets
with SDF and will not charge the same deliverable to both programs.

## Evidence Links

- Repository: https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport
- Mainnet contract:
  https://stellar.expert/explorer/public/contract/CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX
- SCF #44 round:
  https://communityfund.stellar.org/awards/rec4FnYypcsKpBRB4
- Accelerator:
  https://www.cvlabs.com/accelerator/stellar

## Information Needed Before Submission

Do not guess these fields:

- founder's preferred full name, title, email, phone, LinkedIn, and location;
- whether Decentralized Global Education & Skills Passport has a legal entity and, if so, incorporation details and cap
  table;
- team members, roles, biographies, and time commitment;
- current users, pilot discussions, letters of intent, revenue, and usage
  metrics;
- fundraising history and current fundraising target;
- availability for the full 12-week program, Cape Town component, and Lisbon
  Demo Day;
- pitch deck URL and product demo/video URL;
- exact relationship to any other grants or funding received;
- confirmation of funding, equity, token, travel, and attendance terms.

## Submission Checklist

- [ ] Confirm founder and company details
- [ ] Add real pilot/customer evidence and metrics
- [ ] Create or update a concise accelerator pitch deck
- [ ] Record a short product and founder video
- [ ] Confirm SCF #44 disclosure and non-overlapping budgets
- [ ] Confirm participation and funding terms
- [ ] Submit before July 3, 2026
