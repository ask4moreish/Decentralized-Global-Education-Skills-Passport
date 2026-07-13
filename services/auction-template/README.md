# Sealed Auction Template

End-to-end sealed-auction integration template. Demonstrates the full protocol lifecycle — deploy, commit, reveal, clear, settle, verify — using the [SDK](../packages/sdk), [keeper](../keeper), and [tlock](../packages/tlock) in a single script.

A reference for integrators embedding a Decentralized Global Education & Skills Passport round into their Stellar app.

---

## Quick start

```bash
pnpm install

# Offline fixture mode (no RPC, no secrets — verifies the golden receipt)
pnpm template:fixture

# Full testnet lifecycle (needs funded Stellar keys)
pnpm template:testnet

# Unit + smoke tests
pnpm template:test

# Typecheck
pnpm template:typecheck
```

## Modes

### Fixture mode (`FIXTURE=1`)

Reads the golden receipt fixture from `packages/sdk/fixtures/golden.json` and walks through each protocol phase with commentary. No RPC connection, no Stellar keys, no network costs. Good for:

- First-time exploration of the protocol phases
- CI checks (no external dependencies)
- Documentation / demo walkthroughs

```bash
pnpm template:fixture
```

### Testnet mode

Deploys a fresh Round contract to Stellar testnet, runs two human-funded bidders through the full lifecycle, and verifies the final receipt:

```
Phase 1  — Deploy + Create Round
Phase 2  — Seal + Commit
Phase 3  — Keeper: Wait R → Open → Reveal All
Phase 4  — Clear + Settle
Phase 5  — Receipt Export + Verify
```

Requires funded Stellar keys. Uses a 3-second Drand round and ~2 minute deadlines:

```bash
pnpm template:testnet
```

## Protocol phases (as documented by fixture mode)

| Phase | Description | On-chain call | Off-chain library |
|-------|-------------|---------------|-------------------|
| **1. Setup** | Operator deploys contract, configures Drand params, creates round | `create_round` | `SkillsPassportClient.createRound` |
| **2. Commit** | Bidders seal `(value, nonce)` to Drand R, lock USDC escrow | `commit` | `sealBid` from `@decentralized-global-education-skills-passport/tlock` |
| **3. Reveal** | Keeper fetches Drand R signature, opens reveal, decrypts all seals | `open_reveal`, `reveal` | `keepRound` from `@decentralized-global-education-skills-passport/keeper` + `openBid` |
| **4. Clear + Settle** | Winner is determined; contract transfers funds | `clear`, `settle` | `closeRound` from `@decentralized-global-education-skills-passport/keeper` |
| **5. Verify** | Receipt exported and verified offline | (read-only) | `exportReceipt` + `verifyReceipt` from `@decentralized-global-education-skills-passport/sdk` |

## Failure cases documented

| Scenario | Mechanism |
|----------|-----------|
| Under-escrowed bid (bid > escrow) | `EscrowTooSmall` at clear → bid marked invalid |
| Missed reveal | Bidder never reveals → no valid bid → not in winner selection |
| Late commit | `CommitWindowClosed` error from contract |
| Void after grace | Drand R never arrives → `void()` after `revealDeadline + 3600s` → all refunded |

## Key dependencies

| Package | Purpose |
|---------|---------|
| [`@decentralized-global-education-skills-passport/sdk`](../../packages/sdk) | `SkillsPassportClient`, `verifyReceipt`, `RoundContract` |
| [`@decentralized-global-education-skills-passport/tlock`](../../packages/tlock) | `sealBid`, `openBid`, `generateNonce`, `quicknet` |
| [`@decentralized-global-education-skills-passport/keeper`](../keeper) | `keepRound`, `closeRound` — lifecycle driver |
| `@stellar/stellar-sdk` | Account, TransactionBuilder, Keypair (testnet mode only) |

## Related

- [Keeper service](../keeper) — permissionless lifecycle driver
- [Receipt CLI](../receipt-cli) — standalone receipt export and verification
- [Agent service](../agent) — autonomous mandate-capped bidding agents
- [`@decentralized-global-education-skills-passport/sdk`](../../packages/sdk) — client SDK
- [`@decentralized-global-education-skills-passport/tlock`](../../packages/tlock) — timelock encryption

## License

MIT — see the root [LICENSE](../../LICENSE).
