import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LEGACY_MANIFEST_PATH = resolve(ROOT, "contracts/passport/deployed-testnet.json");
const HARDENED_MANIFEST_PATH = resolve(
  ROOT,
  "contracts/passport/deployed-testnet-hardened.json"
);
const WASM_PATH = resolve(
  ROOT,
  "target/wasm32v1-none/release/skills_passport_core.wasm"
);

test("preserves legacy deployed-testnet.json alongside separate hardened Testnet manifest", () => {
  const legacy = JSON.parse(readFileSync(LEGACY_MANIFEST_PATH, "utf8"));
  const hardened = JSON.parse(readFileSync(HARDENED_MANIFEST_PATH, "utf8"));

  assert.equal(
    legacy.contractId,
    "CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5"
  );
  assert.equal(
    legacy.wasmHash,
    "f7f29f6c3ab6f0e3524605b7d3bb1ff41c1de7fb015973719f50aed5ce480610"
  );

  assert.match(hardened.contractId, /^C[A-Z2-7]{55}$/);
  assert.notEqual(hardened.contractId, legacy.contractId);
  assert.equal(
    hardened.wasmHash,
    "f7975920f377927af8d803f87df3a3ade4e84cc012835868f004eca4105888bf"
  );

  const localWasmHash = crypto
    .createHash("sha256")
    .update(readFileSync(WASM_PATH))
    .digest("hex");
  assert.equal(hardened.wasmHash, localWasmHash);

  assert.equal(hardened.legacyContractReference?.contractId, legacy.contractId);
  assert.equal(hardened.legacyContractReference?.wasmHash, legacy.wasmHash);
});

test("hardened manifest records full confirmed operations, queries, and enforcing simulations without leaking secrets", () => {
  const raw = readFileSync(HARDENED_MANIFEST_PATH, "utf8");
  const hardened = JSON.parse(raw);

  // Ensure no Stellar secret seed S... appears anywhere in deployment manifests
  assert.equal(/\bS[A-Z2-7]{55}\b/.test(raw), false);
  const legacyRaw = readFileSync(LEGACY_MANIFEST_PATH, "utf8");
  assert.equal(/\bS[A-Z2-7]{55}\b/.test(legacyRaw), false);

  const ops = hardened.evidence?.confirmedOperations ?? [];
  assert.equal(ops.length, 17);
  for (const op of ops) {
    assert.equal(op.status, "SUCCESS");
    assert.match(op.txHash, /^[0-9a-f]{64}$/);
    assert.ok(Number(op.ledger) > 0);
    assert.ok(op.operation && op.authorizingAccount && op.resultingState);
  }

  assert.equal(
    hardened.evidence?.readOnlyQueries?.paginationVerification?.matchesUnpaginatedOrderExact,
    true
  );
  assert.equal(
    hardened.evidence?.readOnlyQueries?.rollbackProbeCredentialAbsent,
    true
  );
  assert.match(
    hardened.evidence?.negativeSimulations?.oldAdminPauseRejected ?? "",
    /Error\(Auth, InvalidAction\)/
  );
  assert.match(
    hardened.evidence?.negativeSimulations?.pausedRegisterIssuerRejected ?? "",
    /Error\(Contract, #17\)/
  );
  assert.match(
    hardened.evidence?.negativeSimulations?.batchTooLarge ?? "",
    /Error\(Contract, #15\)/
  );
});

test("deployment scripts enforce overwrite locks and non-Testnet safeguards safely", () => {
  assert.throws(
    () => {
      execFileSync(
        process.execPath,
        [
          resolve(ROOT, "scripts/deploy-passport-testnet.mjs"),
          "--dry-run",
        ],
        {
          cwd: ROOT,
          env: {
            ...process.env,
            NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015",
          },
          stdio: "pipe",
        }
      );
    },
    /Refusing non-Testnet passphrase/
  );

  assert.throws(
    () => {
      execFileSync(
        process.execPath,
        [
          resolve(ROOT, "scripts/testnet-e2e-live.mjs"),
          "--execute",
          "--out",
          "contracts/passport/deployed-testnet.json",
        ],
        {
          cwd: ROOT,
          env: {
            ...process.env,
            CONFIRM_TESTNET_DEPLOY: "1",
            ALLOW_EPHEMERAL_KEYS: "0",
          },
          stdio: "pipe",
        }
      );
    },
    /ALLOW_EPHEMERAL_KEYS=1/
  );
});
