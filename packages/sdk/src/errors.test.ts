import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SkillsPassportClientConfigError,
  SkillsPassportSubmitError,
  SkillsPassportTransactionError,
  SkillsPassportMissingReturnValueError,
  SkillsPassportTimeoutError,
} from "./errors.js";
import { SkillsPassportClient } from "./client.js";

describe("SkillsPassportClientConfigError", () => {
  it("sets name and message", () => {
    const err = new SkillsPassportClientConfigError("bad config");
    assert.equal(err.name, "SkillsPassportClientConfigError");
    assert.equal(err.message, "bad config");
  });

  it("preserves cause", () => {
    const cause = new Error("root");
    const err = new SkillsPassportClientConfigError("msg", { cause });
    assert.equal(err.cause, cause);
  });
});

describe("SkillsPassportSubmitError", () => {
  it("sets name and message", () => {
    const err = new SkillsPassportSubmitError("submit failed");
    assert.equal(err.name, "SkillsPassportSubmitError");
    assert.equal(err.message, "submit failed");
  });

  it("preserves cause", () => {
    const cause = new Error("network err");
    const err = new SkillsPassportSubmitError("submit failed", { cause });
    assert.equal(err.cause, cause);
  });
});

describe("SkillsPassportTransactionError", () => {
  it("sets name, hash, status, and message", () => {
    const err = new SkillsPassportTransactionError("abc123", "FAILED");
    assert.equal(err.name, "SkillsPassportTransactionError");
    assert.equal(err.hash, "abc123");
    assert.equal(err.status, "FAILED");
    assert.equal(err.message, "transaction abc123 ended with status FAILED");
  });

  it("preserves cause", () => {
    const cause = new Error("root");
    const err = new SkillsPassportTransactionError("abc", "FAILED", { cause });
    assert.equal(err.cause, cause);
  });
});

describe("SkillsPassportMissingReturnValueError", () => {
  it("sets name, hash, and message", () => {
    const err = new SkillsPassportMissingReturnValueError("abc123");
    assert.equal(err.name, "SkillsPassportMissingReturnValueError");
    assert.equal(err.hash, "abc123");
    assert.equal(
      err.message,
      "transaction abc123 succeeded without a return value",
    );
  });
});

describe("SkillsPassportTimeoutError", () => {
  it("sets all properties", () => {
    const err = new SkillsPassportTimeoutError({
      hash: "0xdeadbeef",
      submitter: "mock-submitter",
      lastStatus: "NOT_FOUND",
      timeoutMs: 30_000,
      pollIntervalMs: 1_000,
    });
    assert.equal(err.name, "SkillsPassportTimeoutError");
    assert.equal(err.hash, "0xdeadbeef");
    assert.equal(err.submitter, "mock-submitter");
    assert.equal(err.lastStatus, "NOT_FOUND");
    assert.equal(err.timeoutMs, 30_000);
    assert.equal(err.pollIntervalMs, 1_000);
    assert(
      err.message.includes("0xdeadbeef"),
      "message should contain hash",
    );
    assert(
      err.message.includes("mock-submitter"),
      "message should contain submitter name",
    );
    assert(
      err.message.includes("NOT_FOUND"),
      "message should contain last status",
    );
  });

  it("allows zero or non-standard timing values", () => {
    const err = new SkillsPassportTimeoutError({
      hash: "x",
      submitter: "s",
      lastStatus: "FAILED",
      timeoutMs: 0,
      pollIntervalMs: 0,
    });
    assert.equal(err.timeoutMs, 0);
    assert.equal(err.pollIntervalMs, 0);
  });
});

// -------------------------------------------------------------------------
// Config validation
// -------------------------------------------------------------------------

const BASE_CONFIG = {
  rpcUrl: "https://example.com",
  networkPassphrase: "Test SDF Network ; September 2015",
  contractId: "CCW67TSA3JH6KABMZAWOS6J2GKY6BKBJ5TKQAMM6P3EXZ7OAFM2TJ5BQ",
};

describe("SkillsPassportClientConfig validation", () => {
  it("rejects confirmTimeout < 1000", () => {
    assert.throws(
      () => new SkillsPassportClient({ ...BASE_CONFIG, confirmTimeout: 999 }),
      SkillsPassportClientConfigError,
    );
  });

  it("rejects non-finite confirmTimeout values", () => {
    for (const confirmTimeout of [Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => new SkillsPassportClient({ ...BASE_CONFIG, confirmTimeout }),
        SkillsPassportClientConfigError,
      );
    }
  });

  it("accepts confirmTimeout = 1000", () => {
    assert.doesNotThrow(
      () => new SkillsPassportClient({ ...BASE_CONFIG, confirmTimeout: 1000 }),
    );
  });

  it("rejects pollInterval < 100", () => {
    assert.throws(
      () => new SkillsPassportClient({ ...BASE_CONFIG, pollInterval: 99 }),
      SkillsPassportClientConfigError,
    );
  });

  it("rejects non-finite pollInterval values", () => {
    for (const pollInterval of [Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => new SkillsPassportClient({ ...BASE_CONFIG, pollInterval }),
        SkillsPassportClientConfigError,
      );
    }
  });

  it("accepts pollInterval = 100", () => {
    assert.doesNotThrow(
      () => new SkillsPassportClient({ ...BASE_CONFIG, pollInterval: 100 }),
    );
  });

  it("uses default values when not configured", () => {
    const client = new SkillsPassportClient(BASE_CONFIG);
    assert.ok(client instanceof SkillsPassportClient);
  });
});

// -------------------------------------------------------------------------
// Custom polling settings with injected sleep
// -------------------------------------------------------------------------

describe("custom polling settings with injected sleep", () => {
  it("accepts injected sleep without invoking it during construction", () => {
    let sleepCalls = 0;
    const fakeSleep = async (_ms: number) => {
      sleepCalls += 1;
    };

    const client = new SkillsPassportClient({
      ...BASE_CONFIG,
      confirmTimeout: 10_000,
      pollInterval: 200,
      _sleep: fakeSleep,
    });
    assert.ok(client instanceof SkillsPassportClient);
    assert.equal(sleepCalls, 0);
  });

  it("timeout error carries timing context that matches config", () => {
    const timeoutMs = 10_000;
    const pollIntervalMs = 500;
    const err = new SkillsPassportTimeoutError({
      hash: "0xdeadbeef",
      submitter: "mock-submitter",
      lastStatus: "NOT_FOUND",
      timeoutMs,
      pollIntervalMs,
    });
    assert.equal(err.timeoutMs, timeoutMs);
    assert.equal(err.pollIntervalMs, pollIntervalMs);
  });

  it("can classify failures by error type without parsing messages", () => {
    const configErr = new SkillsPassportClientConfigError("bad config");
    const submitErr = new SkillsPassportSubmitError("submit failed");
    const txErr = new SkillsPassportTransactionError("h", "FAILED");
    const missingErr = new SkillsPassportMissingReturnValueError("h");
    const timeoutErr = new SkillsPassportTimeoutError({
      hash: "h",
      submitter: "s",
      lastStatus: "NOT_FOUND",
      timeoutMs: 1000,
      pollIntervalMs: 100,
    });

    assert.equal(configErr instanceof SkillsPassportClientConfigError, true);
    assert.equal(submitErr instanceof SkillsPassportSubmitError, true);
    assert.equal(txErr instanceof SkillsPassportTransactionError, true);
    assert.equal(missingErr instanceof SkillsPassportMissingReturnValueError, true);
    assert.equal(timeoutErr instanceof SkillsPassportTimeoutError, true);

    assert.equal(configErr instanceof Error, true);
    assert.equal(submitErr instanceof Error, true);
    assert.equal(txErr instanceof Error, true);
    assert.equal(missingErr instanceof Error, true);
    assert.equal(timeoutErr instanceof Error, true);
  });
});
