<p align="center">
  <img src="https://raw.githubusercontent.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/main/assets/decentralized-global-education-skills-passport-readme.png" width="180" alt="Decentralized Global Education & Skills Passport" />
</p>

<h1 align="center">
  <code>skills-passport-sdk</code>
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/skills-passport-sdk">
    <img src="https://img.shields.io/npm/v/skills-passport-sdk" alt="npm" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/npm/l/skills-passport-sdk" alt="license" />
  </a>
  <a href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/tests.yml">
    <img src="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport/actions/workflows/tests.yml/badge.svg" alt="Tests" />
  </a>
</p>

**TypeScript SDK** for the **Decentralized Global Education & Skills Passport** (`EducationPassportClient`, W3C Verifiable Credentials, salted selective disclosure, and `eddsa-jcs-2022` Data Integrity) and sealed coordination rounds (`SkillsPassportClient`).

---

## Install

```bash
npm install skills-passport-sdk
```

Requires `skills-passport-tlock` for sealing bid values and `round-bindings` for the sealed-round contract types. Both are declared as workspace dependencies and installed automatically.

---

## Education & Skills Passport API (`contracts/passport`)

```ts
import {
  EducationPassportClient,
  createVerifiableCredential,
  attachW3CDataIntegrityProof,
  createCredentialSharePackage,
  credentialIdToBytes32Hex,
  verifyEducationCredential,
} from "skills-passport-sdk";

// 1. Issue a W3C VC v1.1 credential with per-claim salted selective disclosure
const vc = createVerifiableCredential({
  credentialType: "DegreeCredential",
  issuer: { address: issuerPubKey, name: "MIT Digital Credentials" },
  recipient: { address: learnerPubKey, name: "Elena Rostova" },
  title: "M.Sc. Distributed Systems",
  institution: "MIT",
  skills: ["Rust", "Soroban", "Applied Cryptography"],
  grade: "4.0 GPA",
  achievementDescription: "Completed graduate degree requirements.",
  contractId: "CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5",
  selectiveDisclosure: true,
});

// 2. Optionally attach a standard W3C DataIntegrityProof (eddsa-jcs-2022)
const dualProofVc = attachW3CDataIntegrityProof(vc, issuerSecretKey, {
  verificationMethodFormat: "did:key",
});

// 3. Query live Soroban Testnet ledger state & verify
const client = new EducationPassportClient({
  contractId: "CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5",
  rpcUrl: "https://soroban-testnet.stellar.org",
});
const onChainRecord = await client.fetchOnChainRecord(credentialIdToBytes32Hex(vc.id));
const report = verifyEducationCredential(dualProofVc, onChainRecord);

// 4. Create a privacy-minimizing share link (Anchor or Redacted Salted Payload)
const share = createCredentialSharePackage(vc, {
  mode: "payload",
  selectedSkills: ["Soroban"],
  redactRecipientName: true,
  redactGrade: true,
});
```

Key Passport exports:
- **Client & Soroban RPC**: `EducationPassportClient` (`getAdmin`, `getPendingAdmin`, `isPaused`, `isIssuerAuthorized`, `getIssuer`, `getTemplate`, `getCredential`, `getCredentialStatus`, `getLearnerCredentials`, `getLearnerCredentialsPage`, `verifyCredentialOnChain`, `fetchOnChainRecord`, `buildIssueCredentialArgs`, `buildBatchIssueArgs`, `buildInvokeOperation`), `PASSPORT_CONTRACT_ERRORS`, `decodePassportContractError`, `PassportRpcError`
- **Canonicalization & Selective Disclosure**: `canonicalizeJson` (RFC 8785 UTF-16 JCS), `computeCredentialHash`, `computeSaltedClaimDigest`, `createCredentialSharePackage`, `createSelectiveCredentialView`, `inspectShareUrlPrivacy`, `formatFragmentUrl`, `parseVerificationUrl`
- **W3C Interoperability (`eddsa-jcs-2022`)**: `signDocumentEddsaJcs2022`, `verifyDocumentEddsaJcs2022`, `attachW3CDataIntegrityProof`, `validateVerifiableCredentialStructure`, `stellarPublicKeyToDidKey`, `resolveEd25519PublicKeyFromVerificationMethod`

---

## Quick start: Sealed Coordination Rounds (`contracts/round`)

> The primary Passport contract uses `EducationPassportClient` above. The secondary `SkillsPassportClient` below integrates [generated bindings](../round-bindings) for `contracts/round` sealed grant/RFP/auction rounds.

### 1. Create a client

```ts
import { SkillsPassportClient } from "skills-passport-sdk";

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
import { quicknet, sealBid, generateNonce } from "skills-passport-tlock";

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
import { quicknet, fetchRoundSignature, drandSignatureToSoroban } from "skills-passport-tlock";

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
import { verifyReceipt } from "skills-passport-sdk";
const result = verifyReceipt(receipt);
console.log(result.valid);     // true
console.log(result.issues);    // []
console.log(result.computedWinner); // { address: "G…", value: 250n }

// Redact sensitive fields for public sharing
import { redactReceipt } from "skills-passport-sdk";
const redacted = redactReceipt(receipt, { keep: ["winner", "winningValue"] });
```

### Optional OZ Relayer Channels submitter

```ts
import { SkillsPassportClient, createOzChannelsSubmitterFromEnv } from "skills-passport-sdk";

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
import { validateEncryptedBlob, MAX_CIPHERTEXT_BYTES } from "skills-passport-sdk";

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
} from "skills-passport-sdk";

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

The SDK re-exports all contract types from `round-bindings` so consumers only need one import:

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
} from "skills-passport-sdk";
```

---

## Related packages

- [`skills-passport-tlock`](../tlock) — Sealing/unsealing bid values with Drand timelock encryption
- [`round-bindings`](../round-bindings) — Generated Soroban contract bindings (types, Client, Spec)
