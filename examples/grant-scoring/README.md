<p align="center">
  <img src="https://raw.githubusercontent.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/main/assets/decentralized-global-education-skills-passport-readme.png" width="180" alt="Decentralized Global Education & Skills Passport" />
</p>

<h1 align="center">
  <code>@decentralized-global-education-skills-passport/grant-scoring-pilot</code>
</h1>

<p align="center">
  <a href="../../LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license" />
  </a>
  <a href="https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/actions/workflows/examples-typecheck.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/examples-typecheck.yml" alt="typecheck" />
  </a>
</p>

**Sealed grant scoring pilot template.** Integration template for grant and
hackathon allocation workflows. Maps judges, projects, scoring criteria, sealed
score submission, reveal readiness, and ranked settlement/receipt output into
one repeatable flow.

This template is **separate from the jury demo trace** in `services/agent` and
`apps/web`. Those paths prove autonomous sealed bidding; this package shows how
a pilot partner wires **multi-project grant scoring** with
[`skills-passport-sdk`](../../packages/sdk) and
[`skills-passport-tlock`](../../packages/tlock).

---

## Quick start

```bash
pnpm install

# Fixture mode — full lifecycle offline (no RPC, no secrets)
pnpm grant-scoring:start

# Tests — fixture lifecycle, reveal readiness, ranking, tlock commitment
pnpm grant-scoring:test

# Typecheck
pnpm grant-scoring:typecheck
```

The default **fixture mode** runs the full sealed-score lifecycle offline:

1. Create one Soroban round per project (shared Drand reveal time `R`)
2. Two judges seal and commit scores for three projects (six submissions)
3. Track reveal readiness until all commits are in
4. Open reveal, decrypt scores, and reveal on-chain
5. Settle nominal escrows and emit a ranked organizer receipt

Fixture data lives in `src/fixtures.ts` (`PILOT_FIXTURE_PROGRAM`).

---

## Model

| Concept | Template type | On-chain mapping |
|---|---|---|
| Grant program | `GrantPilotProgram` | Operator config + shared `revealRound` |
| Project | `GrantProject` | One round per project (`item_ref` = sha256 of `itemRef`) |
| Judge | `GrantJudge` | Bidder address committing a sealed score |
| Rubric row | `ScoringCriterion` | Off-chain; composite score sealed as `value` |
| Sealed score | `SealedScoreSubmission` | `commit` with tlock `commitment`, `ciphertext`, `auditorBlob` |
| Reveal readiness | `RevealReadinessReport` | All judges committed across project rounds |
| Final output | `GrantPilotReceipt` | Ranked projects + per-round settlement snapshot |

Scores use `scoreToStroops()` (1 display point = 1_000_000 stroops). Rankings
aggregate **revealed judge scores** per project; the contract's clearing rule
(`HighestBid`) is not used for grant ordering — settlement refunds nominal
escrow after reveal.

---

## API surface

```ts
import { GrantScoringPilot, PILOT_FIXTURE_PROGRAM } from "@decentralized-global-education-skills-passport/grant-scoring-pilot";
```

Key exports:

| Export | Description |
|---|---|
| `GrantScoringPilot` | Orchestrates the full lifecycle (fixture or live) |
| `sealJudgeScore` / `commitSealedJudgeScore` | tlock seal + SDK commit path |
| `assessRevealReadiness` | Commit progress and phase tracking |
| `buildGrantReceipt` | Organizer-facing ranked output |
| `PILOT_FIXTURE_PROGRAM` | 2 judges × 3 projects with weighted criteria |

---

## Live Stellar testnet adaptation

Replace fixture mode with a real `SkillsPassportClient` and funded accounts:

```ts
import { SkillsPassportClient } from "skills-passport-sdk";
import { quicknet } from "skills-passport-tlock";
import {
  GrantScoringPilot,
  commitSealedJudgeScore,
  createProjectRound,
} from "@decentralized-global-education-skills-passport/grant-scoring-pilot";

const client = new SkillsPassportClient({
  rpcUrl: process.env.RPC_URL!,
  networkPassphrase: process.env.NETWORK_PASSPHRASE!,
  contractId: process.env.ROUND_CONTRACT_ID!,
  secretKey: process.env.OPERATOR_SECRET!,
});

const pilot = new GrantScoringPilot({ fixtureMode: false });
const bindings = await pilot.createLiveProjectRounds(client);

// Each judge signs with their own secret key:
await commitSealedJudgeScore({
  client: judgeClient,
  program: pilot.program,
  judge,
  project,
  roundId: bindings.find((b) => b.projectId === project.id)!.roundId,
  compositeScore: 8.5,
  auditorPublicKey: pilot.auditor.publicKey,
  drand: quicknet(),
});
```

### Required testnet env

| Variable | Role |
|---|---|
| `RPC_URL` | Soroban RPC (default testnet) |
| `NETWORK_PASSPHRASE` | Stellar network passphrase |
| `ROUND_CONTRACT_ID` | Deployed round contract |
| `OPERATOR_SECRET` | Creates project rounds |
| `JUDGE_*_SECRET` | One funded key per judge for commits |
| `USDC_SAC` | Token for nominal escrow (see `services/keeper/scripts/usdc-setup.ts`) |
| `KEEPER_SECRET` | Permissionless reveal/settle (see `@decentralized-global-education-skills-passport/keeper`) |

After Drand round `R` publishes, run the keeper (`pnpm keeper:e2e` pattern) or
your own watcher to `openReveal`, `reveal`, and `settle` each project round.
Then call `pilot.finalizeRankings(client)` to produce the organizer receipt.

See also [docs/INTEGRATION.md](../../docs/INTEGRATION.md) and
[docs/PILOT_PLAYBOOK.md](../../docs/PILOT_PLAYBOOK.md).

---

## Tests

```bash
pnpm grant-scoring:test
```

Covers the full fixture lifecycle, reveal readiness, ranking, and tlock
commitment verification at reveal time (3 test files).

---

## Key dependencies

| Package | Purpose |
|---|---|
| [`skills-passport-sdk`](../../packages/sdk) | `SkillsPassportClient`, types, receipt verification |
| [`skills-passport-tlock`](../../packages/tlock) | `sealBid`, `commitment`, `quicknet` — score sealing and on-chain binding |

---

## Related

- [Integration guide](../../docs/INTEGRATION.md) — how another Stellar app embeds the protocol
- [Pilot playbook](../../docs/PILOT_PLAYBOOK.md) — outreach strategy, SCF demo narrative, pilot plan
- [`skills-passport-sdk`](../../packages/sdk) — client SDK
- [`skills-passport-tlock`](../../packages/tlock) — timelock encryption

## License

MIT — see the root [LICENSE](../../LICENSE).
