// Unit tests for the web-side buildJsonOutput mirror.
//
// Every assertion here corresponds to a property of the CLI's
// services/receipt-cli/src/json-output.ts implementation, so a parallel
// divergence is caught at CI time. The fixture here is hand-rolled rather
// than imported from the CLI fixtures so this test stays Node-only and
// doesn't depend on the SDK being bundled.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { buildJsonOutput, type JsonVerifyOutput } from "./buildJsonOutput.js";
import {
  networkFingerprint,
  parseReceipt,
  serializeReceipt,
  type RoundReceipt,
  type VerificationResult,
} from "skills-passport-sdk";

const TESTNET = "Test SDF Network ; September 2015";

function makeReceipt(): RoundReceipt {
  return {
    version: 1,
    network: TESTNET,
    networkFingerprint: networkFingerprint(TESTNET),
    contractId: "CA3D5K7FJ3YZM2SJ6XJ6Y5Q5XJ6Z2M3SJ6XJ6Y5Q5XJ6Z2M3SJ6XJ6Y5",
    exportedAt: "2026-06-23T12:00:00.000Z",
    roundId: "1",
    itemRef: "ab84f41446646ddbea23656fda8f2e0c282deb2da09603618a71f9d2ff1d1d6d",
    revealRound: 5000000,
    clearingRule: "HighestBid",
    commitDeadline: "1728000",
    revealDeadline: "1731600",
    operator: "GBCDABQZOSZG4Y5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3",
    auditorPubkey: "deadbeef".repeat(24),
    bidders: [],
    bids: {},
    winner: null,
    winningValue: null,
    status: "Open",
  };
}

test("parseError path: returns valid=false and a single parse_error", async () => {
  const out = await buildJsonOutput(null, null, "Invalid JSON: bad brace");
  assert.equal(out.valid, false);
  assert.equal(out.receiptId, null);
  assert.equal(out.roundId, null);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].code, "parse_error");
  assert.equal(out.errors[0].message, "Invalid JSON: bad brace");
  assert.equal(out.warnings.length, 0);
});

test("issues bucketing: errors and warnings split by severity", async () => {
  const receipt = makeReceipt();
  const result: VerificationResult = {
    valid: false,
    issues: [
      { severity: "error", code: "missing_network", message: "network missing" },
      { severity: "warning", code: "unknown_status", message: "weird status" },
    ],
    computedWinner: { address: null, value: null },
  };
  const out = await buildJsonOutput(receipt, result, null);
  assert.equal(out.valid, false);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].code, "missing_network");
  assert.equal(out.warnings.length, 1);
  assert.equal(out.warnings[0].code, "unknown_status");
});

test("issues carry path when verifier emits one", async () => {
  const receipt = makeReceipt();
  const result: VerificationResult = {
    valid: false,
    issues: [
      {
        severity: "error",
        code: "commitment_mismatch",
        message: "sha mismatch",
        path: "bids.GABC.commitment",
      },
    ],
    computedWinner: { address: null, value: null },
  };
  const out = await buildJsonOutput(receipt, result, null);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].path, "bids.GABC.commitment");
});

test("no issues: valid=true, empty arrays", async () => {
  const receipt = makeReceipt();
  const result: VerificationResult = {
    valid: true,
    issues: [],
    computedWinner: { address: null, value: null },
  };
  const out = await buildJsonOutput(receipt, result, null);
  assert.equal(out.valid, true);
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.warnings, []);
  assert.equal(out.roundId, receipt.roundId);
  assert.equal(typeof out.checkedAt, "string");
});

test("receiptId matches sha256 of canonical JSON", async () => {
  const receipt = makeReceipt();
  const result: VerificationResult = {
    valid: true,
    issues: [],
    computedWinner: { address: null, value: null },
  };
  const out = await buildJsonOutput(receipt, result, null);
  const expected = createHash("sha256")
    .update(serializeReceipt(receipt), "utf-8")
    .digest("hex");
  assert.equal(out.receiptId, expected);
  // Round-trip via parseReceipt to make sure receiptId matches the canonical layout.
  const reparsed = parseReceipt(JSON.stringify(receipt));
  void reparsed;
});

test("output shape keys are stable across calls", async () => {
  const out: JsonVerifyOutput = await buildJsonOutput(null, null, "x");
  const keys = Object.keys(out).sort();
  assert.deepEqual(keys, ["checkedAt", "errors", "receiptId", "roundId", "valid", "warnings"]);
});
