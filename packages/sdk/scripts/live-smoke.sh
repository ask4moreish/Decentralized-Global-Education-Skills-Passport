#!/usr/bin/env bash
# Live smoke gate orchestration. Provisions funded testnet keys + the native
# XLM SAC + the uploaded wasm hash, then runs the TS smoke that drives the SDK
# (deploy → createRound → commit → read) over real Soroban RPC.
#
# Real network, real funds (testnet friendbot), no mock. Re-runnable.
set -euo pipefail

cd "$(dirname "$0")/../../.."
ROOT="$(pwd)"
NET="${STELLAR_NETWORK:-testnet}"

echo "→ [build] compiling wasm to artifacts/…"
stellar contract build --out-dir artifacts >/dev/null

echo "→ [keys] generating + funding operator/bidder on ${NET}…"
stellar keys generate smoke-op  --network "$NET" --overwrite >/dev/null 2>&1 || true
stellar keys generate smoke-bid --network "$NET" --overwrite >/dev/null 2>&1 || true
# Fund synchronously (waits for friendbot) so the first upload/deploy can't race
# an unfunded account.
stellar keys fund smoke-op  --network "$NET" >/dev/null 2>&1
stellar keys fund smoke-bid --network "$NET" >/dev/null 2>&1

OPERATOR_SECRET="$(stellar keys show smoke-op)"
BIDDER_SECRET="$(stellar keys show smoke-bid)"

echo "→ [token] resolving native XLM SAC id + ensuring it is instantiated…"
USDC_SAC="$(stellar contract id asset --asset native --network "$NET")"
stellar contract asset deploy --asset native --source smoke-op --network "$NET" >/dev/null 2>&1 || true

echo "→ [upload] installing contract wasm…"
WASM_HASH="$(stellar contract upload --wasm artifacts/skills_passport_round.wasm --source smoke-op --network "$NET" 2>/dev/null | tail -1)"
echo "    wasm hash: $WASM_HASH"

echo "→ [smoke] running the SDK live smoke…"
OPERATOR_SECRET="$OPERATOR_SECRET" \
BIDDER_SECRET="$BIDDER_SECRET" \
WASM_HASH="$WASM_HASH" \
USDC_SAC="$USDC_SAC" \
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}" \
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}" \
pnpm --filter @decentralized-global-education-skills-passport/sdk exec tsx scripts/live-smoke.ts
