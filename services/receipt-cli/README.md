# Receipt CLI

Deterministic round-receipt exporter and offline verifier.

Exports a portable round receipt from a Soroban RPC endpoint, verifies it offline (no RPC, no secrets), and redacts sensitive fields for public sharing. Uses the verification and redaction logic from [`skills-passport-sdk`](../packages/sdk).

---

## Quick start

```bash
pnpm install

# Export a receipt from testnet (uses env config)
CONTRACT_ID=CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y \
  pnpm --filter @decentralized-global-education-skills-passport/receipt-cli start export 1

# Verify a local receipt file
pnpm --filter @decentralized-global-education-skills-passport/receipt-cli start verify round-1-receipt.json

# Redact sensitive fields for public demo
pnpm --filter @decentralized-global-education-skills-passport/receipt-cli start redact round-1-receipt.json

# Run tests
pnpm --filter @decentralized-global-education-skills-passport/receipt-cli test    # 19 tests
```

## Commands

| Command | Description |
|---------|-------------|
| `receipt-cli export <roundId>` | Fetch a round receipt from RPC (uses env config: `RPC_URL`, `NETWORK_PASSPHRASE`, `CONTRACT_ID`) |
| `receipt-cli verify <receipt.json>` | Verify a local receipt file offline. Supports `--json` flag for structured output and `--verify-artifact-checksum <path>` for artifact integrity checking |
| `receipt-cli redact <receipt.json> [out.json]` | Redact sensitive fields (bidder identities, bids, evidence) for public sharing. Outputs to `<input>.redacted.json` by default |

## Environment

| Variable | Default | Used by |
|----------|---------|---------|
| `RPC_URL` | `https://soroban-testnet.stellar.org` | `export` |
| `NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | `export` |
| `CONTRACT_ID` | (required for `export`) | `export` |

## Verification output

### Text mode (default)

```
Verification: PASS
Computed winner: GBCD… = 500
```

Or with issues:

```
Verification: FAIL
  ✖ [bid_commitment_mismatch] Bidder GBCD… committed H=ab12… but revealed H!=cd34…
  ⚠ [bidder_not_found] Round has no bidder index entry for GBCD…
```

### JSON mode (`--json`)

```json
{
  "valid": false,
  "computedWinner": { "address": null, "value": null },
  "issues": [
    {
      "severity": "error",
      "code": "missing_round_events",
      "message": "Receipt round events array is empty"
    }
  ],
  "receipt": { /* verified receipt snapshot */ }
}
```

### Artifact checksum verification (`--verify-artifact-checksum <path>`)

If the receipt carries an `artifactChecksum` field (SHA-256 of the deployed contract WASM), the CLI can verify it against a local artifact file:

```bash
receipt-cli verify round-1-receipt.json --verify-artifact-checksum skills_passport_round.wasm
```

## Dependencies

- [`skills-passport-sdk`](../../packages/sdk) — `exportReceipt`, `verifyReceipt`, `parseReceipt`, `redactReceipt`
- [`skills-passport-tlock`](../../packages/tlock) — commitment verification helpers

## Related

- [Receipt verification docs](../../docs/RECEIPTS.md) — schema, trust model, offline verification
- [Web UI /verify page](../../apps/web) — receipt verification browser interface
- [`skills-passport-sdk`](../../packages/sdk) — core verification logic

## License

MIT — see the root [LICENSE](../../LICENSE).
