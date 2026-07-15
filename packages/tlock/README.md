<p align="center">
  <img src="https://raw.githubusercontent.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/main/assets/decentralized-global-education-skills-passport-readme.png" width="180" alt="Decentralized Global Education & Skills Passport" />
</p>

<h1 align="center">
  <code>skills-passport-tlock</code>
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/skills-passport-tlock">
    <img src="https://img.shields.io/npm/v/skills-passport-tlock" alt="npm" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/npm/l/skills-passport-tlock" alt="license" />
  </a>
  <a href="https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/actions/workflows/npm-publish.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport/npm-publish.yml" alt="build" />
  </a>
</p>

**Off-chain timelock encryption** for sealed bid values, byte-compatible with the Skills Passport Round contract.

Seals a bid value to a future Drand round **R**. Before R, the ciphertext is undecryptable by anyone — including the operator. After R, the public Drand threshold signature unlocks all sealed values simultaneously. The commitment binding (`sha256(value ‖ nonce)`) is verified on-chain at reveal time.

Optionally encrypts a bidder identity to a designated auditor public key for selective disclosure (values public post-R, identities auditor-only).

---

## Install

```bash
npm install skills-passport-tlock
```

## Quick start — seal and open a bid

```ts
import {
  quicknet,
  sealBid,
  openBid,
  generateNonce,
  commitment,
  toHex,
} from "skills-passport-tlock";

// 1. Connect to Drand quicknet
const drand = quicknet();

// 2. Prepare the bid
const value = 250n;
const nonce = generateNonce(); // random 32 bytes
const revealRound = 29_176_840n; // future Drand round

// 3. Seal the bid (timelock encrypt to Drand round R)
const sealed = await sealBid({ value, nonce, round: revealRound, client: drand });

console.log(toHex(sealed.commitment)); // sha256 of the preimage — what goes on-chain
console.log(sealed.ciphertext.length); // ≤ 4096 bytes (contract limit)

// 4. After Drand round R is published, open the seal
const opened = await openBid(sealed.ciphertext, drand);
console.log(opened.value);             // 250n
console.log([...opened.nonce]);        // matches the original nonce

// 5. Verify the commitment matches what was committed on-chain
const h = commitment(opened.value, opened.nonce);
console.log(toHex(h) === toHex(sealed.commitment)); // true
```

## Quick start — auditor identity blob

```ts
import {
  sealBid,
  openBid,
  generateAuditorKeypair,
  openIdentity,
} from "skills-passport-tlock";

const auditor = generateAuditorKeypair();

const sealed = await sealBid({
  value: 250n,
  nonce: generateNonce(),
  round: revealRound,
  client: drand,
  identity: new TextEncoder().encode("GBIDDER…alice"),
  auditorPublicKey: auditor.publicKey,
});

// Only the auditor can recover the identity:
const identity = openIdentity(sealed.auditorBlob, auditor.secretKey);
console.log(new TextDecoder().decode(identity)); // "GBIDDER…alice"
```

## API

### Sealing / opening

| Function | Description |
|---|---|
| `sealBid(params)` | Timelock-encrypt a `(value, nonce)` pair to Drand round R. Optionally encrypts an `identity` to an auditor public key. Returns `{ commitment, ciphertext, auditorBlob }`. |
| `openBid(ciphertext, drandClient)` | Decrypt a sealed bid ciphertext after round R. Returns `{ value, nonce }`. |
| `generateNonce()` | Generate a cryptographically random 32-byte nonce. |

### Commitment helpers

| Function | Description |
|---|---|
| `commitment(value, nonce)` | Compute `sha256(be16(value) ‖ nonce)` — the on-chain commitment. |
| `encodeBidPreimage(value, nonce)` | Encode `be16(value) ‖ nonce` (the full preimage). |
| `decodeBidPreimage(preimage)` | Decode a preimage back into `(value, nonce)`. |
| `toHex(bytes)` / `fromHex(hex)` | Hex encode/decode for Uint8Arrays. |

### Drand client

| Function | Description |
|---|---|
| `quicknet()` | Create a Drand client for the League of Entropy quicknet. |
| `currentRound(client)` | Fetch the latest published Drand round number. |
| `chainInfo(client)` | Fetch Drand chain information (public key, genesis, period). |
| `fetchRoundBeacon(client, round)` | Fetch the Drand beacon for a specific round. |
| `fetchRoundSignature(client, round)` | Fetch the threshold signature for a specific round (can be used for `open_reveal`). |
| `roundInSeconds(config, round)` | Compute the wall-clock time (Unix seconds) when a Drand round is published. |
| `QUICKNET_HASH` | Frozen SHA-256 hash of the quicknet chain info, used for deploy validation. |

### Auditor / identity

| Function | Description |
|---|---|
| `generateAuditorKeypair()` | Generate a new X25519 keypair for auditor identity encryption. |
| `auditorPublicKey(secretKey)` | Derive the public key from an auditor secret key. |
| `sealIdentity(identity, auditorPubkey)` | Encrypt a bidder identity to an auditor public key. |
| `openIdentity(auditorBlob, secretKey)` | Decrypt an auditor blob (requires the auditor's secret key). |

### BLS / Soroban encoding

| Function | Description |
|---|---|
| `drandSignatureToSoroban(sig)` | Convert a Drand signature to the Soroban G1 encoding used by `open_reveal`. |
| `encodeG1Soroban(point)` | Encode a G1 point into the 96-byte Soroban format. |

### Round freshness

| Function | Description |
|---|---|
| `classifyDrandRound(config, round)` | Classify a Drand round as `future`, `fresh`, or `stale` relative to the current time and a staleness threshold. |

## Types

```ts
type SealedBid = {
  commitment: Uint8Array;  // sha256(be16(value) ‖ nonce) — 32 bytes
  ciphertext: Uint8Array;  // tlock ciphertext — ≤ 4096 bytes
  auditorBlob: Uint8Array; // encrypted identity — ≤ 2048 bytes
};

type OpenedBid = {
  value: bigint;
  nonce: Uint8Array;       // 32 bytes
};

type SealBidParams = {
  value: bigint;
  nonce: Uint8Array;
  round: number | bigint;
  client: DrandClient;
  identity?: Uint8Array;
  auditorPublicKey?: Uint8Array;
};

type DrandClient = { ... }; // returned by quicknet()

type AuditorKeypair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};
```

## Cryptographic design

- **Seal:** Drand tlock IBE (`bls-unchained-g1-rfc9380`) via `tlock-js`
- **Binding:** `H = sha256(be16(value) ‖ nonce)` — verified on-chain at reveal
- **Unlock:** round-R BLS signature verified on-chain via Soroban's BLS12-381 host functions
- **Auditor blob:** X25519 ECDH + HKDF-SHA256 + XChaCha20-Poly1305

## Size limits

| Field | Max bytes | Contract error |
|---|---|---|
| Ciphertext | 4,096 | `PayloadTooLarge` (33) |
| Auditor blob | 2,048 | `PayloadTooLarge` (33) |

---

## Related packages

- [`round-bindings`](../round-bindings) — Soroban contract bindings (the on-chain counterpart)
- [`skills-passport-sdk`](../sdk) — High-level client, receipt verification, preflight simulation
