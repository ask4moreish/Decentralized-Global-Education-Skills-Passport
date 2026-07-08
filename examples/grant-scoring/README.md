# Sealed grant scoring pilot template

Integration template for **grant and hackathon allocation** workflows. It maps
judges, projects, scoring criteria, sealed score submission, reveal readiness,
and ranked settlement/receipt output into one repeatable flow.

This template is **separate from the jury demo trace** in `services/agent` and
`apps/web`. Those paths prove autonomous sealed bidding; this package shows how
a pilot partner wires **multi-project grant scoring** with `@decentralized-global-education-skills-passport/sdk` and
`@decentralized-global-education-skills-passport/tlock`.

## Quick start (no live credentials)

```bash
pnpm install
pnpm --filter @decentralized-global-education-skills-passport/grant-scoring-pilot test
pnpm --filter @decentralized-global-education-skills-passport/grant-scoring-pilot start
```

The default **fixture mode** runs the full sealed-score lifecycle offline:

1. Create one Soroban round per project (shared Drand reveal time `R`)
2. Two judges seal and commit scores for three projects (six submissions)
3. Track reveal readiness until all commits are in
4. Open reveal, decrypt scores, and reveal on-chain
5. Settle nominal escrows and emit a ranked organizer receipt

Fixture data lives in `src/fixtures.ts` (`PILOT_FIXTURE_PROGRAM`).

## Model

| Concept | Template type | On-chain mapping |
| --- | --- | --- |
| Grant program | `GrantPilotProgram` | Operator config + shared `revealRound` |
| Project | `GrantProject` | One round per project (`item_ref` = sha256 of `itemRef`) |
| Judge | `GrantJudge` | Bidder address committing a sealed score |
| Rubric row | `ScoringCriterion` | Off-chain; composite score sealed as `value` |
| Sealed score | `SealedScoreSubmission` | `commit` with tlock `commitment`, `ciphertext`, `auditorBlob` |
| Reveal readiness | `RevealReadinessReport` | All judges committed across project rounds |
| Final output | `GrantPilotReceipt` | Ranked projects + per-round settlement snapshot |

Scores use `scoreToStroops()` (1 display point = 1_000_000 stroops). Rankings
aggregate **revealed judge scores** per project; contract clearing rule
(`HighestBid`) is not used for grant ordering — settlement refunds nominal
escrow after reveal.

## Live Stellar testnet adaptation

Replace fixture mode with a real `SkillsPassportClient` and funded accounts:

```ts
import { SkillsPassportClient } from "@decentralized-global-education-skills-passport/sdk";
import { quicknet } from "@decentralized-global-education-skills-passport/tlock";
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
| --- | --- |
| `RPC_URL` | Soroban RPC (default testnet) |
| `NETWORK_PASSPHRASE` | Stellar network passphrase |
| `ROUND_CONTRACT_ID` | Deployed Decentralized Global Education & Skills Passport round contract |
| `OPERATOR_SECRET` | Creates project rounds |
| `JUDGE_*_SECRET` | One funded key per judge for commits |
| `USDC_SAC` | Token for nominal escrow (see `services/keeper/scripts/usdc-setup.ts`) |
| `KEEPER_SECRET` | Permissionless reveal/settle (see `@decentralized-global-education-skills-passport/keeper`) |

After Drand round `R` publishes, run the keeper (`pnpm keeper:e2e` pattern) or
your own watcher to `openReveal`, `reveal`, and `settle` each project round.
Then call `pilot.finalizeRankings(client)` to produce the organizer receipt.

See also [docs/INTEGRATION.md](../../docs/INTEGRATION.md) and
[docs/PILOT_PLAYBOOK.md](../../docs/PILOT_PLAYBOOK.md).

## API surface

```ts
import { GrantScoringPilot, PILOT_FIXTURE_PROGRAM } from "@decentralized-global-education-skills-passport/grant-scoring-pilot";
```

Key exports:

- `GrantScoringPilot` — orchestrates the lifecycle
- `sealJudgeScore` / `commitSealedJudgeScore` — `@decentralized-global-education-skills-passport/tlock` + SDK commit path
- `assessRevealReadiness` — commit progress and phase tracking
- `buildGrantReceipt` — organizer-facing ranked output
- `PILOT_FIXTURE_PROGRAM` — 2 judges × 3 projects with weighted criteria

## Tests

```bash
pnpm --filter @decentralized-global-education-skills-passport/grant-scoring-pilot test
```

Covers the full fixture lifecycle, reveal readiness, ranking, and tlock
commitment verification at reveal time.
