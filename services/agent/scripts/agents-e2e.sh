#!/usr/bin/env bash
# Live multi-agent e2e. Two principals delegate session keys; their autonomous
# agents pay x402 appraisal + commit sealed bids to the same round on testnet.
set -euo pipefail

cd "$(dirname "$0")/../../.."
NET="${STELLAR_NETWORK:-testnet}"

echo "→ [build] compiling wasm…"
stellar contract build --out-dir artifacts >/dev/null

echo "→ [keys] generating + funding accounts on ${NET}…"
for k in ag-issuer ag-op ag-p1 ag-p2 ag-appraisal ag-facil ag-keeper; do
  stellar keys generate "$k" --network "$NET" --overwrite >/dev/null 2>&1 || true
  stellar keys fund "$k" --network "$NET" >/dev/null 2>&1
done

ISSUER="$(stellar keys address ag-issuer)"
ASSET="USDC:${ISSUER}"
echo "→ [asset] ${ASSET}"

echo "→ [trustlines+mint] principals + appraisal server (via Horizon)…"
ISSUER_SECRET="$(stellar keys show ag-issuer)" \
PRINCIPAL1_SECRET="$(stellar keys show ag-p1)" \
PRINCIPAL2_SECRET="$(stellar keys show ag-p2)" \
APPRAISAL_SERVER_SECRET="$(stellar keys show ag-appraisal)" \
OPERATOR_SECRET="$(stellar keys show ag-op)" \
ASSET_CODE="USDC" \
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}" \
pnpm --filter @decentralized-global-education-skills-passport/agent exec tsx scripts/usdc-setup.ts

echo "→ [sac] deploying USDC Stellar Asset Contract…"
stellar contract asset deploy --asset "$ASSET" --source ag-issuer --network "$NET" >/dev/null 2>&1 || true
USDC_SAC="$(stellar contract id asset --asset "$ASSET" --network "$NET")"
echo "    USDC SAC: $USDC_SAC"

echo "→ [upload] installing contract wasm…"
WASM_HASH="$(stellar contract upload --wasm artifacts/skills_passport_round.wasm --source ag-op --network "$NET" 2>/dev/null | tail -1)"
echo "    wasm hash: $WASM_HASH"

echo "→ [e2e] running multi-agent lifecycle…"
OPERATOR_SECRET="$(stellar keys show ag-op)" \
PRINCIPAL1_SECRET="$(stellar keys show ag-p1)" \
PRINCIPAL2_SECRET="$(stellar keys show ag-p2)" \
KEEPER_SECRET="$(stellar keys show ag-keeper)" \
APPRAISAL_SERVER_SECRET="$(stellar keys show ag-appraisal)" \
FACILITATOR_SECRET="$(stellar keys show ag-facil)" \
ISSUER_SECRET="$(stellar keys show ag-issuer)" \
WASM_HASH="$WASM_HASH" \
USDC_SAC="$USDC_SAC" \
PRICE="${PRICE:-0.10}" \
RPC_URL="${RPC_URL:-https://soroban-testnet.stellar.org}" \
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}" \
X402_NETWORK="${X402_NETWORK:-stellar:testnet}" \
pnpm --filter @decentralized-global-education-skills-passport/agent exec tsx scripts/agents-e2e.ts
