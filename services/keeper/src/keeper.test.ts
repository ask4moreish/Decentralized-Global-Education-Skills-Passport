import { test } from "node:test";
import assert from "node:assert/strict";

import { errorMatches, errorName, waitForRound } from "./index.js";

test("errorMatches detects idempotent contract error codes in any shape", () => {
  assert.equal(errorMatches(new Error("RevealAlreadyOpen"), ["RevealAlreadyOpen"]), true);
  assert.equal(errorMatches(new Error("HostError: ... AlreadyRevealed(32)"), ["AlreadyRevealed"]), true);
  assert.equal(errorMatches({ message: "HashMismatch" }, ["HashMismatch"]), true);
  assert.equal(errorMatches({ error: { code: "RevealWindowClosed" } }, ["RevealWindowClosed"]), true);
  assert.equal(errorMatches(new Error("InvalidDrandSignature"), ["AlreadyRevealed"]), false);
});

test("errorName extracts a readable message", () => {
  assert.equal(errorName(new Error("boom")), "boom");
  assert.equal(errorName({ message: "x" }), JSON.stringify({ message: "x" }));
});

test("waitForRound returns false for a future round when not allowed to wait", async () => {
  // A stub Drand client whose chain info puts round R far in the future.
  const nowS = Math.floor(Date.now() / 1000);
  const fakeDrand = {
    chain: () => ({
      info: async () => ({ genesis_time: nowS, period: 3 }),
    }),
  } as never;

  const ok = await waitForRound(
    { sdk: {} as never, drand: fakeDrand, maxWaitSeconds: 0 },
    1_000_000, // ~ genesis + 3,000,000s in the future
  );
  assert.equal(ok, false);
});

test("waitForRound returns true immediately for an already-published round", async () => {
  const nowS = Math.floor(Date.now() / 1000);
  const fakeDrand = {
    chain: () => ({
      // genesis far in the past so round 1 is long published.
      info: async () => ({ genesis_time: nowS - 10_000, period: 3 }),
    }),
  } as never;

  const ok = await waitForRound(
    { sdk: {} as never, drand: fakeDrand, maxWaitSeconds: 0 },
    1,
  );
  assert.equal(ok, true);
});
