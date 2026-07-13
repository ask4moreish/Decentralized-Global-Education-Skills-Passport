<p align="center">
  <img src="https://raw.githubusercontent.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/main/assets/decentralized-global-education-skills-passport-readme.png" width="180" alt="Decentralized Global Education & Skills Passport" />
</p>

<h1 align="center">
  <code>@decentralized-global-education-skills-passport/sdk</code>
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@decentralized-global-education-skills-passport/sdk">
    <img src="https://img.shields.io/npm/v/@decentralized-global-education-skills-passport/sdk" alt="npm" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/npm/l/@decentralized-global-education-skills-passport/sdk" alt="license" />
  </a>
  <a href="https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/actions/workflows/npm-publish.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/npm-publish.yml" alt="build" />
  </a>
</p>

**High-level SDK** for integrating sealed coordination rounds into Stellar and Soroban apps.

Wraps the [generated contract bindings](../round-bindings) with a `SkillsPassportClient` that handles encoding, submission, preflight simulation, encrypted-blob validation, receipt export/verification, and optional OpenZeppelin Relayer Channels support.

---

## Install

```bash
npm install @decentralized-global-education-skills-passport/sdk
```

Requires `@decentralized-global-education-skills-passport/tlock` for sealing bid values and `@decentralized-global-education-skills-passport/round-bindings` for the contract types. Both are declared as workspace dependencies and will be installed automatically.

---

## Quick start

### 1. Create a client

```ts
import { SkillsPassportClient } from "@decentralized-global-education-skills-passport/sdk";

const client = new SkillsPassportClient({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contractId: "CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y",
  secretKey: "S…",  // required for state-changing calls
});
```

### 2. Create a round (operator)

```ts
const roundId = await client.createRound({
  itemRef: new TextEncoder().encode("my-grant-round"),
  revealRound: 29_176_840n,
  commitDeadline: 1_728_000n,
  revealDeadline: 1_731_600n,
  auditorPubkey: auditorPublicKey,
  clearingRule: "HighestBid",
});
```

### 3. Seal and commit a bid (bidder)

```ts
import { quicknet, sealBid, generateNonce } from "@decentralized-global-education-skills-passport/tlock";

const drand = quicknet();
const sealed = await sealBid({
  value: 250n,
  nonce: generateNonce(),
  round: 29_176_840n,
  client: drand,
  identity: new TextEncoder().encode("GBIDDER…alice"),
  auditorPublicKey,
});

await client.commit({
  roundId: 1n,
  sealed,
  escrow: 1000n,
});
```

### 4. Open reveal (anyone — after Drand round R)

```ts
import { quicknet, fetchRoundSignature, drandSignatureToSoroban } from "@decentralized-global-education-skills-passport/tlock";

const sig = await fetchRoundSignature(drand, 29_176_840);  // number, not bigint
const sorobanSig = drandSignatureToSoroban(sig);
await client.openReveal(1n, sorobanSig);

// Reveal each bidder
await client.reveal({ roundId: 1n, bidder: "G…", value: 250n, nonce });
await client.reveal({ roundId: 1n, bidder: "G…", value: 500n, nonce });

// Clear and settle
await client.clear(1n);
await client.settle(1n);
```

---

## API Reference

### `SkillsPassportClient`

| Method | Description |
|---|---|
| `createRound(params)` | Open a new sealed round (operator auth) |
| `commit(params)` | Submit a sealed bid + lock escrow (bidder auth) |
| `openReveal(roundId, signature)` | Submit Drand BLS signature to unlock reveal |
| `reveal(params)` | Reveal a bid with `(value, nonce)` |
| `clear(roundId)` | Deterministically compute the winner after reveal deadline |
| `settle(roundId)` | Transfer winner's bid to operator, refund losers |
| `void(roundId)` | Liveness safety valve — refund all escrow after grace |

### Read-only views

| Method | Description |
|---|---|
| `getRound(roundId)` | Fetch the round record |
| `getBidState(roundId, bidder)` | Fetch a bidder's commitment, escrow, reveal status |
| `getBidders(roundId)` | Deterministic, ordered bidder index |
| `getBiddersPage(roundId, cursor, limit)` | Paginated bidder index (cursor-based) |
| `bidders(roundId)` | Async generator that lazily pages through all bidders |
| `getSeal(roundId, bidder)` | Ephemeral ciphertext + auditor blob (may be null if expired) |
| `getConfig()` | Contract-global Drand and USDC configuration |

### Preflight simulation

Every mutating method has a matching `preflight*` helper that simulates the call without signing or submitting:

```ts
const preflight = await client.preflightCommit({ roundId, sealed, escrow });
if (preflight.ok) {
  console.log("Estimated fee (stroops):", preflight.fee.transactionFee);
  await client.commit({ roundId, sealed, escrow });
} else {
  console.error("Commit would fail:", preflight.error.message);
}
```

| Submit | Preflight |
|---|---|
| `createRound` | `preflightCreateRound` |
| `commit` | `preflightCommit` |
| `openReveal` | `preflightOpenReveal` |
| `reveal` | `preflightReveal` |
| `clear` | `preflightClear` |
| `settle` | `preflightSettle` |
| `void` | `preflightVoid` |

### Receipt export and verification

```ts
// Export a portable round receipt (fetches all on-chain state)
const receipt = await client.exportReceipt(1n);

// Offline verification — no RPC, no secrets
import { verifyReceipt } from "@decentralized-global-education-skills-passport/sdk";
const result = verifyReceipt(receipt);
console.log(result.valid);     // true
console.log(result.issues);    // []
console.log(result.computedWinner); // { address: "G…", value: 250n }

// Redact sensitive fields for public sharing
import { redactReceipt } from "@decentralized-global-education-skills-passport/sdk";
const redacted = redactReceipt(receipt, { keep: ["winner", "winningValue"] });
```

### Optional OZ Relayer Channels submitter

```ts
import { SkillsPassportClient, createOzChannelsSubmitterFromEnv } from "@decentralized-global-education-skills-passport/sdk";

const client = new SkillsPassportClient({
  rpcUrl,
  networkPassphrase,
  contractId,
  secretKey,
  submitter: createOzChannelsSubmitterFromEnv(),
});
```

### Encrypted blob validation

Validates ciphertext and auditor blob size/encoding before submitting (catches `PayloadTooLarge` errors before paying gas):

```ts
import { validateEncryptedBlob, MAX_CIPHERTEXT_BYTES } from "@decentralized-global-education-skills-passport/sdk";

const result = validateEncryptedBlob(ciphertext, "ciphertext");
if (!result.valid) {
  console.error(result.issues);
}
```

### Mainnet helpers

```ts
import {
  runMainnetReadiness,
  assertMainnetConfirmed,
  MAINNET_ARTIFACTS,
  MAINNET_CONFIRM_PHRASE,
} from "@decentralized-global-education-skills-passport/sdk";

const report = await runMainnetReadiness(defaultMainnetReadinessInput());
console.log(formatReadinessReport(report));
```

## Error types

| Error | Description |
|---|---|
| `SkillsPassportClientConfigError` | Invalid configuration (missing secretKey, bad contractId, etc.) |
| `SkillsPassportSubmitError` | Transaction submission failed (RPC or submitter error) |
| `SkillsPassportTransactionError` | Transaction ended with non-success status |
| `SkillsPassportMissingReturnValueError` | Transaction succeeded but has no return value |
| `SkillsPassportTimeoutError` | Transaction was submitted but not finalized within the timeout |
| `SkillsPassportPreflightError` | Preflight simulation failed (typed by kind: `rpc_error`, `simulation_error`, `expired_state`, `contract_error`, `malformed_response`) |

## Re-exported types from bindings

The SDK re-exports all contract types from `@decentralized-global-education-skills-passport/round-bindings` so consumers only need one import:

```ts
import {
  SkillsPassportClient,
  type Round,
  type BidState,
  type ClearingRule,
  type GlobalConfig,
  type Seal,
  type Status,
  type BiddersPage,
  RoundContract,       // raw Client class
  RoundErrors,         // error code → message map
} from "@decentralized-global-education-skills-passport/sdk";
```

---

## Related packages

- [`@decentralized-global-education-skills-passport/tlock`](../tlock) — Sealing/unsealing bid values with Drand timelock encryption
- [`@decentralized-global-education-skills-passport/round-bindings`](../round-bindings) — Generated Soroban contract bindings (types, Client, Spec)
