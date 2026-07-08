#!/usr/bin/env bash
# Live keeper end-to-end. Provisions three funded testnet accounts (operator,
# bidder, keeper) + the native XLM SAC + uploaded wasm, then runs the e2e that
# deploys a round, commits a sealed bid, and lets the keeper wait for R, open
# the reveal with R's real Drand signature, decrypt and reveal. Re-runnable.
set -euo pipefail

cd "$(dirname "$0")/../../.."
NET="${STELLAR_NETWORK:-testnet}"

echo "→ [build] compiling wasm…"
stellar contract build --out-dir artifacts >/dev/null

echo "→ [keys] generating + funding operator/bidder/keeper on ${NET}…"
for k in smoke-op smoke-bid smoke-keeper; do
  stellar keys generate "$k" --network "$NET" --overwrite >/dev/null 2>&1 || true
  stellar keys fund "$k" --network "$NET" >/dev/null 2>&1
done

USDC_SAC="$(stellar contract id asset --asset native --network "$NET")"
stellar contract asset deploy --asset native --source smoke-op --network "$NET" >/dev/null 2>&1 || true
WASM_HASH="$(stellar contract upload --wasm artifacts/skills_passport_round.wasm --source smoke-op --network "$NET" 2>/dev/null | tail -1)"
echo "    wasm hash: $WASM_HASH"

echo "→ [e2e] running keeper end-to-end (this waits ~2-3 min for Drand round R)…"
OPERATOR_SECRET="$(stellar keys show smoke-op)" \
BIDDER_SECRET="$(stellar keys show smoke-bid)" \
KEEPER_SECRET="$(stellar keys show smoke-keeper)" \
WASM_HASH="$WASM_HASH" \
USDC_SAC="$USDC_SAC" \
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}" \
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}" \
pnpm --filter @decentralized-global-education-skills-passport/keeper exec tsx scripts/keeper-e2e.ts
