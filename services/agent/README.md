# Agent Service

Autonomous sealed-bid agents for the Decentralized Global Education & Skills Passport protocol.

Each agent holds a **principal-signed session mandate** (scoped caps on bid value, escrow, and appraisal spend), pays the [x402-gated appraisal API](../appraisal-api) per call, sizes a bid from the appraisal response, seals it with Drand timelock encryption, and commits over Soroban RPC using its session key — no relayer, no mock.

---

## Quick start

```bash
pnpm install

# Unit tests (mandate creation/verification, cap enforcement, edge cases)
pnpm agent:test           # 10 tests — no external calls

# Typecheck
pnpm agent:typecheck

# Full lifecycle on testnet (needs funded Stellar keys)
pnpm agents:e2e           # two mandated agents → x402 → commit → keeper → reveal → settle → 0
```

## Architecture

### Mandate (`src/mandate.ts`)

A human/principal signs a `SessionMandate` that binds a session public key to a single round with explicit caps:

| Cap | Description |
|-----|-------------|
| `maxBidStroops` | Highest sealed bid value the agent will submit |
| `maxEscrowStroops` | Maximum USDC locked at commit |
| `maxAppraisalSpendStroops` | Total x402 appraisal spend for the session |
| `appraisalPriceStroops` | Expected per-call price; agent refuses if the server asks for more |

The agent verifies the principal's Ed25519 signature before every action and refuses to exceed any cap. The contract enforces `value ≤ escrow` on-chain at reveal time — so caps are enforced **off-chain by the agent** and **on-chain by the contract**.

### Bidder agent (`src/bidder.ts`)

`runBidderAgent()` implements the autonomous flow:

1. **Verify mandate** — checks principal signature, expiry, round/contract binding
2. **Check round** — confirms round is still `Open` for commits
3. **Pay appraisal** — calls the x402-gated `POST /appraise` endpoint using the session secret
4. **Size bid** — clamps `suggestedMaxBid` from the appraisal to the mandate caps
5. **Seal** — timelock-encrypts `(value, nonce)` to the configured Drand reveal round via [`skills-passport-tlock`](../packages/tlock)
6. **Commit** — submits the sealed bid via [`skills-passport-sdk`](../packages/sdk) using the session key

### e2e script (`scripts/agents-e2e.ts`)

The canonical end-to-end test deploys a fresh Round contract on testnet, runs two autonomous agents with different appraisal attributes, then drives the keeper through reveal → clear → settle. The full demo trace is written to `apps/web/src/demo/demo-trace.generated.ts` for the jury UI.

## Key dependencies

| Package | Purpose |
|---------|---------|
| [`skills-passport-sdk`](../../packages/sdk) | `SkillsPassportClient` — round queries, commit submission |
| [`skills-passport-tlock`](../../packages/tlock) | `sealBid`, `generateNonce`, `quicknet` — timelock encryption |
| [`@decentralized-global-education-skills-passport/appraisal-api`](../../services/appraisal-api) | `createPaidFetch` — x402 payment client |
| [`@decentralized-global-education-skills-passport/keeper`](../../services/keeper) | `closeRound`, `keepRound` — lifecycle driver for the e2e |
| `@stellar/stellar-sdk` | Keypair generation, transaction signing |
| `@x402/core` | x402 payment protocol types |

## Related

- [Appraisal API](../appraisal-api) — x402-gated valuation endpoint
- [Keeper service](../keeper) — permissionless lifecycle driver
- [`skills-passport-tlock`](../../packages/tlock) — timelock encryption
- [`skills-passport-sdk`](../../packages/sdk) — Soroban client SDK

## License

MIT — see the root [LICENSE](../../LICENSE).
