import assert from "node:assert/strict";
import { test } from "node:test";

import { Keypair } from "@stellar/stellar-sdk";

import { bidFromAppraisal, createSessionMandate, DEFAULT_BASE_PRICE_USDC, usdcToStroops } from "./mandate.js";

test("two agents with different appraisal inputs produce different bid sizes under same cap", () => {
  const common = {
    contractId: "CCONTRACT123456789012345678901234567890123456789012345678901234",
    roundId: 7n,
    itemRef: "skills-passport://rfp/x",
    basePriceUsdc: DEFAULT_BASE_PRICE_USDC,
    category: "spectrum" as const,
    maxBidStroops: usdcToStroops(200),
    maxEscrowStroops: usdcToStroops(200),
    maxAppraisalSpendStroops: usdcToStroops(1),
    appraisalPriceStroops: usdcToStroops(0.1),
    commitDeadline: Math.floor(Date.now() / 1000) + 3600,
  };

  // Suggested max bids (USDC) that stay under the shared cap and differ.
  const strongSuggested = 75;
  const weakSuggested = 35;

  const m1 = createSessionMandate({ ...common, principalSecret: Keypair.random().secret() }).mandate;
  const m2 = createSessionMandate({ ...common, principalSecret: Keypair.random().secret() }).mandate;

  const b1 = bidFromAppraisal(strongSuggested, m1);
  const b2 = bidFromAppraisal(weakSuggested, m2);
  assert.ok(b1.bidValue > b2.bidValue);
  assert.ok(b1.bidValue <= usdcToStroops(200));
  assert.ok(b2.bidValue <= usdcToStroops(200));
});
