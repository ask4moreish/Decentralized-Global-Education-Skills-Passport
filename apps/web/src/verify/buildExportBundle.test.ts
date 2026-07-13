// Unit tests for the bundled export payload produced by the verifier UI's
// "Copy" button.
//
// Mirrors the existing buildJsonOutput.test.ts style: `node --import tsx
// --test`, an explicit JS extension on relative imports, and hand-rolled
// fixtures rather than live SDK round-trips where possible (so the test stays
// deterministic and doesn't depend on subtle SDK internals changing).

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  networkFingerprint,
  parseReceipt,
  redactReceipt,
  serializeReceipt,
  type RoundReceipt,
} from "@decentralized-global-education-skills-passport/sdk";

import { buildExportBundle } from "./buildExportBundle.js";
import type { JsonVerifyOutput } from "./buildJsonOutput.js";

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
    bidders: [
      "GA4GN2X7YQKQJF5Y5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3",
      "GB5HN3Y8ZRLRK6Z6Y4X4Y4X4Y4X4Y4X4Y4X4Y4X4Y4X4Y4X4Y4X4Y4X4Y4",
    ],
    bids: {
      "GA4GN2X7YQKQJF5Y5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3X5X3": {
        commitment: "d77d1adf5eca2aa1b1d26b310fe4da2af3900fb080bcb701cae8cae879be1e7a",
        escrow: "200",
        revealedValue: "100",
        nonce: "a".repeat(64),
        hashValid: true,
        valid: true,
        settled: true,
        evidence: { ciphertext: "a1b2c3d4", auditorBlob: "e5f6a7b8" },
      },
      "GB5HN3Y8ZRLRK6Z6Y4X4Y4X4Y4X4Y4X4Y4X4Y4X4Y4X4X4Y4Y4Y4Y4Y4Y4": {
        commitment: "c5ee5d77eaee11aac66da233c475bd9e14dc5dc89a639c84cfd8ca47d1837cb0",
        escrow: "500",
        revealedValue: "250",
        nonce: "b".repeat(64),
        hashValid: true,
        valid: true,
        settled: false,
        evidence: { ciphertext: "b2c3d4e5", auditorBlob: "f6a7b8c9" },
      },
    },
    winner: "GB5HN3Y8ZRLRK6Z6Y4X4Y4X4Y4X4Y4X4Y4X4Y4X4Y4X4X4Y4Y4Y4Y4Y4Y4",
    winningValue: "250",
    status: "Settled",
  };
}

function makeReport(overrides: Partial<JsonVerifyOutput> = {}): JsonVerifyOutput {
  return {
    valid: true,
    receiptId: "abc123",
    roundId: "1",
    checkedAt: "2026-06-23T12:00:00.000Z",
    errors: [],
    warnings: [],
    ...overrides,
  };
}

test("default formatting: trailing newline + 2-space indent", () => {
  const out = buildExportBundle('{"roundId":"1"}', makeReport());
  assert.equal(typeof out, "string");
  assert.ok(out.endsWith("\n"), "default bundle ends with a single newline");
  assert.ok(!out.endsWith("\n\n"), "default bundle does NOT double-newline");
  // 2-space indent visible at first nested key. The bundle's first nested
  // key is "receipt" (or "report" — both use the same indent level).
  assert.ok(out.includes('  "receipt"') || out.includes('  "report"'),
    `expected 2-space indent, got: ${out}`);
});

test("trailingNewline: false produces a string with no terminal newline", () => {
  const out = buildExportBundle("{}", makeReport(), { trailingNewline: false });
  assert.ok(!out.endsWith("\n"), `output should not end with \\n: ${JSON.stringify(out)}`);
});

test("custom indent is honoured", () => {
  const out = buildExportBundle("{}", makeReport(), { indent: 4, trailingNewline: false });
  // Anchor the indent check on a line-start (after a \n) so the substring
  // search cannot false-positive on smaller indents living inside larger
  // ones — a 4-space indent contains `  "x"` as a substring at byte offset 1,
  // so an unanchored `!includes('  "receipt"')` is a brittle / trap assertion.
  assert.match(out, /\n {4}"receipt"/,
    `expected 4-space indent at level 1, got: ${JSON.stringify(out)}`);
  // Level-2 nested keys carry the exact double of indent (8 spaces).
  assert.match(out, /\n {8}"valid"/,
    `expected 8-space indent at level 2, got: ${JSON.stringify(out)}`);
});

test("helper does NOT auto-trim embedded receipt strings — caller is responsible", () => {
  // The ExportReportPanel calls `exportedPayload.json.trim()` before invoking
  // buildExportBundle(). The helper itself must embed the receipt string
  // verbatim — auto-trimming here would let a future caller refactor silently
  // double-trim receipts and distort downstream byte-equality comparisons.
  // This test pins that contract: whitespace at the start/end of the embedded
  // receipt string and embedded newlines must all round-trip unchanged.
  const padded = '  {"x":1}\n\n  ';
  const out = buildExportBundle(padded, makeReport(), { trailingNewline: false });
  const parsed = JSON.parse(out);
  assert.equal(parsed.receipt, padded,
    `helper must NOT auto-trim embedded receipt strings; got: ${JSON.stringify(parsed.receipt)}`);
});

test("bundle parses back to { receipt: string, report: object }", () => {
  const receiptJson = '{"roundId":"1","version":1}';
  const report = makeReport({
    valid: false,
    errors: [{ code: "missing_network", message: "x" }],
  });
  const out = buildExportBundle(receiptJson, report, { trailingNewline: false });
  const parsed = JSON.parse(out);
  assert.equal(typeof parsed.receipt, "string");
  assert.equal(typeof parsed.report, "object");
  assert.equal(parsed.report.valid, false);
  assert.equal(parsed.report.errors.length, 1);
  assert.equal(parsed.report.errors[0].code, "missing_network");
  // The embedded `receipt` string can itself be re-parsed back to a receipt-shaped object.
  assert.deepEqual(JSON.parse(parsed.receipt), { roundId: "1", version: 1 });
});

test("report preserves nested arrays verbatim (no key reordering)", () => {
  // `buildJsonOutput` emits `errors` before `warnings` alphabetically (and the
  // JsonVerifyOutput contract sorts keys). The bundle must honor the exact
  // input shape, not re-canonicalize.
  const report = makeReport({
    warnings: [
      { code: "warn1", message: "x" },
      { code: "warn2", message: "y", path: "bids.foo" },
    ],
  });
  const parsed = JSON.parse(
    buildExportBundle("{}", report, { trailingNewline: false }),
  );
  assert.equal(parsed.report.warnings.length, 2);
  assert.equal(parsed.report.warnings[0].code, "warn1");
  assert.equal(parsed.report.warnings[1].code, "warn2");
  assert.equal(parsed.report.warnings[1].path, "bids.foo");
});

test("embedded receipt strings with quotes and braces survive verbatim", () => {
  // The receipt string itself contains `\\"`, `{`, and `}`; the bundle embeds
  // it as a JSON string, so those characters must be JSON-escaped on the way
  // in and only fully decoded on the way out.
  const receiptJson = '{"messy":"value with \\"quotes\\" and {braces}"}';
  const parsed = JSON.parse(
    buildExportBundle(receiptJson, makeReport(), { trailingNewline: false }),
  );
  assert.equal(typeof parsed.receipt, "string");
  assert.deepEqual(JSON.parse(parsed.receipt), {
    messy: 'value with "quotes" and {braces}',
  });
  // The embedded string's structural characters must NOT bleed into the
  // bundle's outer structure (otherwise the bundle wouldn't round-trip).
  const repaired = JSON.parse(parsed.receipt);
  assert.equal(repaired.messy, 'value with "quotes" and {braces}');
});

test("full pipeline round-trip: canonical receipt → bundle → SDK parseReceipt", () => {
  // Mirrors ExportReportPanel.tsx's handleCopy path: `exportedPayload.json`
  // is `${serializeReceipt(receipt)}\n`; the panel calls `.trim()` before
  // embedding; the bundle output adds its own trailing newline.
  const receipt = makeReceipt();
  const report = makeReport({ roundId: receipt.roundId });

  const exportedPayloadJson = `${serializeReceipt(receipt)}\n`;
  const receiptStringInsideBundle = exportedPayloadJson.trim();
  const bundle = buildExportBundle(receiptStringInsideBundle, report);

  // 1) The bundle is canonical JSON (with the expected trailing newline).
  assert.ok(bundle.endsWith("\n"));

  // 2) Parse the bundle; its `receipt` field equals what the panel trimmed in.
  const parsed = JSON.parse(bundle);
  assert.equal(parsed.receipt, receiptStringInsideBundle);

  // 3) The embedded string is the SDK's canonical receipt JSON.
  const recovered = parseReceipt(parsed.receipt);
  assert.equal(recovered.version, receipt.version);
  assert.equal(recovered.network, receipt.network);
  assert.equal(recovered.contractId, receipt.contractId);
  assert.equal(recovered.roundId, receipt.roundId);
  assert.equal(recovered.status, receipt.status);
  assert.equal(recovered.winner, receipt.winner);

  // 4) The report is preserved verbatim (no implicit sanitisation).
  assert.equal(parsed.report.roundId, "1");
  assert.equal(parsed.report.errors.length, 0);
  assert.equal(parsed.report.warnings.length, 0);
});

test("sanitise-on path: redactReceipt result is what the panel embeds when toggled", () => {
  // Mirrors ExportReportPanel.tsx when the user has the "Sanitise on export"
  // checkbox on: exportedReceipt = redactReceipt(originalReceipt).
  const original = makeReceipt();
  const redacted = redactReceipt(original);

  // The panel calls serializeReceipt + trims; do the same here.
  const exportedJson = `${serializeReceipt(redacted)}\n`.trim();
  const bundle = buildExportBundle(exportedJson, makeReport());
  const parsed = JSON.parse(bundle);

  // 1) The embedded receipt string is the redacted view: operator and the
  //    per-bidder evidence blobs are "<redacted>"; addresses in `bidders`
  //    become "<redacted:N>".
  assert.match(parsed.receipt, /"operator":"<redacted>"/);
  assert.match(parsed.receipt, /"ciphertext":"<redacted>"/);
  assert.match(parsed.receipt, /"auditorBlob":"<redacted>"/);
  assert.match(parsed.receipt, /<redacted:\d+>/);

  // 2) The original raw operator G-address MUST NOT appear anywhere in the
  //    embedded receipt string — that's exactly what the sanitise toggle exists
  //    to prevent.
  assert.ok(!parsed.receipt.includes(original.operator),
    `unexpected leak of raw operator address: ${parsed.receipt}`);

  // 3) The original raw auditor per-bidder blob bytes MUST NOT appear either.
  for (const entry of Object.values(original.bids)) {
    if (entry.evidence?.auditorBlob) {
      assert.ok(!parsed.receipt.includes(entry.evidence.auditorBlob),
        "unexpected leak of raw auditorBlob");
    }
    if (entry.evidence?.ciphertext) {
      assert.ok(!parsed.receipt.includes(entry.evidence.ciphertext),
        "unexpected leak of raw ciphertext");
    }
  }

  // 4) The auditorPubkey at the top level is, by design, NOT redacted —
  //    it's a public key used by anyone to encrypt identity blobs.
  assert.ok(parsed.receipt.includes(original.auditorPubkey),
    "auditorPubkey is public-by-design and should survive sanitisation");

  // 5) The `report` field, by contrast, is completely unmodified — it's the
  //    verification metadata whose values come from the panel's local
  //    verifyReceipt call against the un-redacted receipt.
  assert.equal(parsed.report.roundId, "1");
  assert.equal(parsed.report.valid, true);
});

test("large receipts don't throw and the embedded string round-trips fully", () => {
  const padding = "a".repeat(20 * 1024);
  const receiptJson = `{"big":"${padding}"}`;
  const out = buildExportBundle(receiptJson, makeReport());
  const parsed = JSON.parse(out);
  assert.equal(parsed.receipt, receiptJson);
  // The string survives byte-for-byte at this size — important because the
  // bundled payload is what the user pastes into Slack / Notion / etc.
  assert.equal(parsed.receipt.length, receiptJson.length);
});
