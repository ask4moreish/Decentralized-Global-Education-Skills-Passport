# Drand Tools

**Risk-2 validation harness: validates `tlock ↔ Drand ↔ on-chain BLS` consistency and generates Soroban deploy constants.**

Fetches live Drand quicknet data, confirms the exact message construction and domain separation tag (DST) the Soroban contract must use, and emits the Soroban-encoded BLS12-381 constants (`drand_pubkey`, `negated G2 generator`, `DST`) needed for contract deployment.

The name "Risk-2" comes from the threat model category it guards against: a mismatch between the off-chain tlock sealing library and the on-chain BLS verification would cause all reveals to fail silently — no bids could be decrypted after Drand round R.

---

## Quick start

```bash
pnpm install

# Fetch live quicknet data and generate validation report
pnpm --filter @decentralized-global-education-skills-passport/drand-tools validate

# Generate a frozen test vector for the Rust contract test
VECTOR_ROUND=29155653 pnpm --filter @decentralized-global-education-skills-passport/drand-tools exec tsx src/vectors.ts
```

## What it validates

### 1. Message / DST construction

The contract's BLS verification must use the exact same message and DST as the Drand quicknet. The harness tries both known message variants (`sha256(be8(round))` and raw `be8(round)`) against a live beacon and reports which one verifies:

```
✓ verified with message = sha256(be8)
✓ DST = "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"
```

If neither variant verifies, the harness exits with a failure — the contract's BLS logic would reject all valid Drand signatures.

### 2. Fp2 field ordering

Soroban host functions expect BLS12-381 G2 points with Fp2 elements in `(c1, c0)` byte order. The `(c0, c1)` ordering is rejected by the host as "point not on curve." The harness confirms this by emitting both orderings:

```
Fp2 ordering confirmed on-chain by the contract's BLS test;
the (c0,c1) ordering is rejected by the host as not-on-curve.
```

This was discovered empirically — the noble/curves library stores Fp2 as `{ c0, c1 }`, but Soroban expects `(c1, c0)`. The harness emits the correct ordering so deploy scripts don't need to guess.

### 3. Deploy constants

The harness outputs the exact hex strings to bake into the contract deploy configuration:

```
drand_pubkey      = <192-byte hex>  (public key, uncompressed G2, c1c0)
g2_neg_generator  = <192-byte hex>  (negated G2 generator, uncompressed, c1c0)
DST hex           = <32-byte hex>   (BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_)
```

These are the values passed to `RoundContract.deploy()` and embedded in the e2e scripts (`agents-e2e.ts`, `sealed-auction.ts`, `lifecycle-e2e.ts`).

---

## Modules

| Module | Purpose |
|--------|---------|
| `src/quicknet.ts` | Live Drand quicknet API client — fetches chain info, beacons, computes round times |
| `src/parity.ts` | Off-chain replica of the contract's BLS verification using `@noble/curves` — confirms message construction and DST |
| `src/encode.ts` | Soroban BLS12-381 serialization — uncompressed, big-endian G1/G2 with configurable Fp2 ordering |
| `src/vectors.ts` | Frozen test vector generator for the Rust contract's on-chain BLS test — captures real network data at a fixed round |
| `src/index.ts` | Main validation report entry point |

### `quicknet.ts`

```ts
import { getChainInfo, getBeacon, roundAt, timeOfRound, QUICKNET_HASH } from "@decentralized-global-education-skills-passport/drand-tools";

const info = await getChainInfo();
console.log(info.period);        // 3 (seconds)
console.log(info.genesis_time);  // 1692803367

const beacon = await getBeacon(29155653);
console.log(beacon.round);       // 29155653
console.log(beacon.signature);   // 48-byte compressed G1 hex

// The constant used by tlock's `quicknet()` function
console.log(QUICKNET_HASH);      // 52db9ba70e0cc0f...
```

### `parity.ts`

```ts
import { verifyBeacon, detectMessageVariant, DST } from "@decentralized-global-education-skills-passport/drand-tools";

// Verify a specific round
const ok = verifyBeacon(29155653, sigHex, pubkeyHex, "sha256(be8)");
console.log(ok);  // true

// Auto-detect which message variant the quicknet uses
const variant = detectMessageVariant(29155653, sigHex, pubkeyHex);
console.log(variant);  // "sha256(be8)"
```

### `encode.ts`

```ts
import { encodeG1, encodeG2, pubkeyToSoroban, negatedG2Generator, toHex } from "@decentralized-global-education-skills-passport/drand-tools";

// Decompress a Drand signature (48-byte compressed G1 → 96-byte uncompressed)
const sigPt = bls.G1.Point.fromHex(sigHex);
console.log(toHex(encodeG1(sigPt)));  // 96-byte hex for open_reveal

// Convert the Drand public key to Soroban format (c1c0 ordering)
const pk = pubkeyToSoroban(pubkeyHex, "c1c0");
console.log(toHex(pk));  // 192-byte hex for deploy config

// Generate the negated G2 generator
const negGen = negatedG2Generator("c1c0");
console.log(toHex(negGen));  // 192-byte hex for deploy config
```

---

## Test vectors

The `vectors.ts` script generates frozen test vectors for the Rust contract's BLS test at [`contracts/round/src/test.rs`](../../contracts/round/src/test.rs). These capture real quicknet data at a fixed finalized round — not a mock:

```bash
VECTOR_ROUND=29155653 pnpm --filter @decentralized-global-education-skills-passport/drand-tools exec tsx src/vectors.ts
```

Output includes both `c0c1` and `c1c0` orderings so the contract test can confirm the correct host format.

---

## Relationship to publishable packages

| Package | Relationship |
|---------|-------------|
| [`@decentralized-global-education-skills-passport/tlock`](../../packages/tlock) | The tlock package uses the **same Drand quicknet** (`QUICKNET_HASH`) for sealing bids. The harness validates that tlock's off-chain seal/unseal matches the contract's on-chain BLS verification. |
| [`@decentralized-global-education-skills-passport/sdk`](../../packages/sdk) | The SDK's `RoundContract.deploy()` consumes the constants generated by this harness (`drand_pubkey`, `g2_neg_generator`, `DST`). |
| [`@decentralized-global-education-skills-passport/round-bindings`](../../packages/round-bindings) | The generated bindings expose the `deploy` method that receives these constants. |

The harness has **no runtime dependency** on any of the publishable packages — it uses `@noble/curves` directly for BLS operations. This is intentional: an independent validation path catches bugs in the tlock/SDK libraries.

---

## Dependencies

- `@noble/curves` — BLS12-381 pairing, point operations, hash-to-curve
- `@noble/hashes` — SHA-256 (for message construction)

No Stellar SDK, no tlock, no contract bindings — the harness is deliberately independent.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm --filter @decentralized-global-education-skills-passport/drand-tools validate` | Run the full validation report (fetches live quicknet data) |
| `pnpm --filter @decentralized-global-education-skills-passport/drand-tools exec tsx src/vectors.ts` | Generate frozen test vectors for the Rust contract test |

## Related

- [`@decentralized-global-education-skills-passport/tlock`](../../packages/tlock) — off-chain seal/unseal using the same Drand quicknet
- [`contracts/round/src/test.rs`](../../contracts/round/src/test.rs) — on-chain BLS test that consumes the vectors
- [docs/TECH_DESIGN.md](../../docs/TECH_DESIGN.md) — cryptography design (tlock, BLS, on-chain verification)

## License

MIT — see the root [LICENSE](../../LICENSE).
