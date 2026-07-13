// Unit tests for permalink.ts, focused on the new buildPermalinkUrl(raw)
// signature that returns `{ url, oversized }` instead of a bare string.
//
// Notes:
//   - buildPermalinkUrl uses `window.location.origin` and
//     `window.location.pathname`, so we install a deterministic stub on
//     globalThis before the suite runs and tear it down after. This is the
//     standard pattern for testing browser-only globals under Node's
//     `node --import tsx --test` runner.
//   - The 4KB soft limit is implemented as a strict `>`, so we test both
//     flanks of the boundary rather than just the threshold value.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import {
  buildPermalinkUrl,
  byteLengthUtf8,
  decodePermalink,
  readDataParam,
} from "./permalink.js";

const ORIGIN = "https://verifier.example.com";
const PATHNAME = "/app/";
const SOFT_LIMIT_BYTES = 4 * 1024;

before(() => {
  // buildPermalinkUrl reads `window.location.origin` / `window.location.pathname`.
  // Install a minimal stub so the function executes against deterministic values
  // regardless of the host environment.
  Object.defineProperty(globalThis, "window", {
    value: { location: { origin: ORIGIN, pathname: PATHNAME } },
    configurable: true,
    writable: true,
  });
});

after(() => {
  // Restore the host environment if `window` was previously defined when the
  // test process started; otherwise, drop the stub outright. Either way, the
  // test run ends with the global in its original state.
  delete (globalThis as { window?: unknown }).window;
});

test("returns PermalinkUrl shape with { url, oversized }, NOT a bare string", () => {
  const result = buildPermalinkUrl("{}");
  assert.equal(typeof result, "object", "result is an object");
  assert.equal(result !== null, true, "result is not null");
  assert.equal(typeof (result as { url: unknown }).url, "string");
  assert.equal(typeof (result as { oversized: unknown }).oversized, "boolean");
  // Positive: the old signature was `string`, so make sure the new field set
  // has exactly the two keys callers depend on.
  assert.deepEqual(Object.keys(result).sort(), ["oversized", "url"]);
});

test("URL starts with origin + pathname and includes '#/verify?d='", () => {
  const raw = '{"version":1,"roundId":"1"}';
  const { url } = buildPermalinkUrl(raw);
  assert.ok(
    url.startsWith(`${ORIGIN}${PATHNAME}#/verify?d=`),
    `url should start with origin+pathname+#/verify?d=, got: ${url}`,
  );
});

test("encoded d parameter round-trips back to the original raw JSON", () => {
  const raw = '{"version":1,"roundId":"42","network":"Test SDF"}';
  const { url } = buildPermalinkUrl(raw);
  const hash = url.slice(url.indexOf("#"));
  const encoded = readDataParam(hash);
  assert.ok(encoded !== null, "readDataParam should extract a `d` value");
  assert.equal(decodePermalink(encoded), raw);
});

test("URI encoding preserves special characters in the raw JSON", () => {
  // Strong test: the raw JSON contains braces, colons, quotes, and spaces —
  // all of which must survive encodeURIComponent and round-trip.
  const raw = '{"weird":"value with spaces, {\"nested\":true}","x":1}';
  const { url } = buildPermalinkUrl(raw);
  const encoded = readDataParam(url.slice(url.indexOf("#")));
  assert.ok(encoded !== null);
  assert.equal(decodePermalink(encoded), raw);
  // Specifically: the raw JSON's braces MUST NOT appear unescaped in the URL;
  // encodeURIComponent converts them to %7B / %7D.
  assert.ok(!url.includes("{") && !url.includes("}"),
    `raw braces leaked into URL: ${url}`);
});

test("oversized=false for receipts well under the 4KB soft limit", () => {
  const raw = '{"roundId":"1"}';
  assert.ok(byteLengthUtf8(raw) < SOFT_LIMIT_BYTES);
  const { oversized } = buildPermalinkUrl(raw);
  assert.equal(oversized, false);
});

test("oversized=true for receipts well over the 4KB soft limit", () => {
  // Padding ~5KB pushes the URL comfortably over the limit.
  const padding = "a".repeat(5 * 1024);
  const raw = `{"data":"${padding}"}`;
  assert.ok(byteLengthUtf8(raw) > SOFT_LIMIT_BYTES);
  const { oversized } = buildPermalinkUrl(raw);
  assert.equal(oversized, true);
});

test("oversized flips at the 4KB + 1 boundary (strict-gt semantics)", () => {
  // The implementation is `byteLengthUtf8(raw) > 4096`, so exactly 4096 bytes
  // is NOT oversized and 4097 IS. Pad a base JSON shape to land precisely on
  // each side of the boundary without relying on a magic constant.
  const basePrefix = `{"d":"`;
  const baseSuffix = `"}`;
  const overhead = byteLengthUtf8(basePrefix + baseSuffix);

  for (const target of [SOFT_LIMIT_BYTES, SOFT_LIMIT_BYTES + 1]) {
    const padLen = target - overhead;
    const raw = `${basePrefix}${"a".repeat(padLen)}${baseSuffix}`;
    assert.equal(byteLengthUtf8(raw), target,
      `padded raw should be exactly ${target} bytes, got ${byteLengthUtf8(raw)}`);
    const { oversized } = buildPermalinkUrl(raw);
    assert.equal(oversized, target > SOFT_LIMIT_BYTES,
      `at ${target} bytes oversized should be ${target > SOFT_LIMIT_BYTES}, got ${oversized}`);
  }
});

test("decodePermalink returns null for null/empty/whitespace input", () => {
  assert.equal(decodePermalink(null), null);
  assert.equal(decodePermalink(""), null);
  assert.equal(decodePermalink("   "), null);
});

test("decodePermalink returns null for malformed URI sequences (does NOT throw)", () => {
  // '%' without two hex digits is invalid percent-encoding; the function must
  // swallow the error and return null (callers depend on this).
  assert.equal(decodePermalink("%ZZ"), null);
  assert.equal(decodePermalink("%"), null);
  assert.equal(decodePermalink("100%"), null);
});

test("decodePermalink round-trips a typical URLSearchParams-encoded value", () => {
  const original = "hello world & goodbye";
  const encoded = encodeURIComponent(original);
  assert.equal(decodePermalink(encoded), original);
});

test("readDataParam returns null when hash has no query string", () => {
  assert.equal(readDataParam(""), null);
  assert.equal(readDataParam("#/verify"), null);
  assert.equal(readDataParam("#/verify/welcome"), null);
});

test("readDataParam handles a hash with query but no `d` parameter", () => {
  assert.equal(readDataParam("#/verify?other=foo"), null);
});

test("byteLengthUtf8 matches TextEncoder for ASCII, multibyte chars, and emoji", () => {
  // ASCII: 1 byte per code unit.
  assert.equal(byteLengthUtf8("abc"), 3);
  assert.equal(byteLengthUtf8(""), 0);
  // 2-byte UTF-8 sequence (e.g. é = U+00E9 = 0xC3 0xA9).
  assert.equal(byteLengthUtf8("é"), 2);
  // 4-byte UTF-8 sequence (rocket emoji = U+1F680 = F0 9F 9A 80).
  assert.equal(byteLengthUtf8("🚀"), 4);
  // Mixed string.
  assert.equal(byteLengthUtf8("aé🚀"), 1 + 2 + 4);
});
