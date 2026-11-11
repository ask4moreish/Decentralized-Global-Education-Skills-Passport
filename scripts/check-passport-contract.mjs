#!/usr/bin/env node
/**
 * Independent Soroban Passport Contract WASM, ABI & Error Parity Checker
 *
 * Verifies `contracts/passport` independently of `contracts/round` / `packages/round-bindings`:
 *   1. Compiles `skills-passport-core` release WASM (`wasm32v1-none`) unless `--skip-build` is given.
 *   2. Parses the compiled WASM binary directly using Node's native WebAssembly API:
 *        - Confirms Soroban `contractspecv0` and `contractenvmetav0` custom sections exist.
 *        - Confirms every function invoked by `packages/sdk/src/passport/client.ts` is actually
 *          exported by `skills_passport_core.wasm`.
 *   3. Verifies 1-to-1 discriminant and variant-name parity between:
 *        - `contracts/passport/src/types.rs` (`PassportError`)
 *        - `contracts/passport/ERRORS.md`
 *        - `packages/sdk/src/passport/client.ts` (`PASSPORT_CONTRACT_ERRORS`)
 */

import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const WASM_PATH = resolve(ROOT, "target/wasm32v1-none/release/skills_passport_core.wasm");
const TYPES_RS_PATH = resolve(ROOT, "contracts/passport/src/types.rs");
const ERRORS_MD_PATH = resolve(ROOT, "contracts/passport/ERRORS.md");
const CLIENT_TS_PATH = resolve(ROOT, "packages/sdk/src/passport/client.ts");
const TESTNET_META_PATH = resolve(ROOT, "contracts/passport/deployed-testnet.json");

const EXPECTED_WASM_FUNCTIONS = [
  "initialize",
  "propose_admin",
  "accept_admin",
  "set_admin",
  "get_admin",
  "get_pending_admin",
  "pause",
  "unpause",
  "is_paused",
  "register_issuer",
  "deauthorize_issuer",
  "reactivate_issuer",
  "rotate_issuer_key",
  "update_issuer_metadata",
  "is_issuer_authorized",
  "get_issuer",
  "register_template",
  "get_template",
  "issue_credential",
  "batch_issue_credentials",
  "revoke_credential",
  "suspend_credential",
  "reactivate_credential",
  "verify_credential",
  "get_credential",
  "get_credential_status",
  "get_learner_credentials",
  "get_learner_credential_count",
  "get_learner_credentials_page",
];

function fail(msg) {
  console.error(`❌ Passport contract check failed: ${msg}`);
  process.exit(1);
}

if (!process.argv.includes("--skip-build")) {
  console.log("[1/4] Building contracts/passport release WASM (wasm32v1-none)...");
  execSync("cargo build -p skills-passport-core --target wasm32v1-none --release", {
    cwd: ROOT,
    stdio: "inherit",
  });
}

if (!existsSync(WASM_PATH)) {
  fail(`Missing compiled WASM binary at ${WASM_PATH}`);
}

const wasmBytes = readFileSync(WASM_PATH);
const wasmSha256 = crypto.createHash("sha256").update(wasmBytes).digest("hex");
console.log(`[2/4] Inspecting WASM module (${wasmBytes.length} bytes, sha256=${wasmSha256})...`);

const wasmModule = new WebAssembly.Module(wasmBytes);
const specSections = WebAssembly.Module.customSections(wasmModule, "contractspecv0");
const envMetaSections = WebAssembly.Module.customSections(wasmModule, "contractenvmetav0");
if (specSections.length === 0 || envMetaSections.length === 0) {
  fail("Compiled WASM lacks Soroban contractspecv0 / contractenvmetav0 custom metadata sections");
}

const exportedFuncs = new Set(
  WebAssembly.Module.exports(wasmModule)
    .filter((e) => e.kind === "function")
    .map((e) => e.name)
);

for (const fnName of EXPECTED_WASM_FUNCTIONS) {
  if (!exportedFuncs.has(fnName)) {
    fail(`Compiled WASM is missing expected contract entrypoint '${fnName}'`);
  }
}
console.log(`      Verified all ${EXPECTED_WASM_FUNCTIONS.length} Passport contract entrypoints in WASM exports.`);

// Verify every Soroban call in client.ts targets a real WASM export
const clientTs = readFileSync(CLIENT_TS_PATH, "utf8");
const invokedFuncs = Array.from(
  clientTs.matchAll(/simulateRead[^(]*\(\s*["']([a-z0-9_]+)["']|buildInvokeOperation\(\s*["']([a-z0-9_]+)["']/g),
  (m) => m[1] || m[2]
);
if (invokedFuncs.length === 0) {
  fail("Failed to inspect EducationPassportClient method calls in client.ts");
}
for (const called of new Set(invokedFuncs)) {
  if (!exportedFuncs.has(called)) {
    fail(`EducationPassportClient calls '${called}', which is NOT exported by skills_passport_core.wasm`);
  }
}
console.log(
  `      Verified all ${new Set(invokedFuncs).size} EducationPassportClient contract calls against WASM ABI.`
);

console.log("[3/4] Checking PassportError discriminant & doc parity (types.rs <-> ERRORS.md <-> client.ts)...");
const typesRs = readFileSync(TYPES_RS_PATH, "utf8");
const errorsMd = readFileSync(ERRORS_MD_PATH, "utf8");

const enumMatch = typesRs.match(/pub enum PassportError\s*\{([\s\S]*?)\}/);
if (!enumMatch) {
  fail("Could not parse PassportError enum in contracts/passport/src/types.rs");
}
const rustVariants = Array.from(
  enumMatch[1].matchAll(/([A-Za-z0-9_]+)\s*=\s*(\d+)\s*,/g),
  (m) => ({ variant: m[1], code: Number(m[2]) })
);
if (rustVariants.length === 0) {
  fail("Parsed zero variants from PassportError enum");
}

for (const { variant, code } of rustVariants) {
  const mdRe = new RegExp(`\\|\\s*\`?${code}\`?\\s*\\|\\s*\`${variant}\``);
  if (!mdRe.test(errorsMd)) {
    fail(`ERRORS.md missing row for PassportError::${variant} = ${code}`);
  }
  const sdkRe = new RegExp(`${code}:\\s*\\{\\s*variant:\\s*["']${variant}["']`);
  if (!sdkRe.test(clientTs)) {
    fail(`client.ts PASSPORT_CONTRACT_ERRORS missing mapping for ${code}: ${variant}`);
  }
}
console.log(`      Verified ${rustVariants.length} error codes across types.rs, ERRORS.md, and client.ts.`);

const HARDENED_META_PATH = resolve(ROOT, "contracts/passport/deployed-testnet-hardened.json");
console.log("[4/4] Verifying deployed Testnet passport metadata separation from Round contract...");
const deployed = JSON.parse(readFileSync(TESTNET_META_PATH, "utf8"));
if (!/^C[A-Z2-7]{55}$/.test(deployed.contractId || "")) {
  fail(`Invalid Testnet contractId in deployed-testnet.json: ${deployed.contractId}`);
}
if (!/^[0-9a-f]{64}$/.test(deployed.wasmHash || "")) {
  fail(`Invalid Testnet wasmHash in deployed-testnet.json: ${deployed.wasmHash}`);
}
console.log(`      Legacy Testnet contractId:   ${deployed.contractId}`);
console.log(`      Legacy Testnet WASM SHA-256: ${deployed.wasmHash}`);
if (existsSync(HARDENED_META_PATH)) {
  const hardened = JSON.parse(readFileSync(HARDENED_META_PATH, "utf8"));
  if (!/^C[A-Z2-7]{55}$/.test(hardened.contractId || "")) {
    fail(`Invalid Testnet contractId in deployed-testnet-hardened.json: ${hardened.contractId}`);
  }
  if (hardened.contractId === deployed.contractId) {
    fail("deployed-testnet-hardened.json must use a separate contractId from legacy deployed-testnet.json");
  }
  console.log(`      Hardened Testnet contractId: ${hardened.contractId}`);
  if (hardened.wasmHash === wasmSha256) {
    console.log(`      Hardened Testnet WASM:       ${hardened.wasmHash} (MATCHES local WASM)`);
  } else if (process.argv.includes("--strict-hardened-hash")) {
    fail(
      `Hardened Testnet manifest WASM hash (${hardened.wasmHash}) differs from current local WASM (${wasmSha256})`
    );
  } else {
    console.log(
      `      Hardened Testnet WASM:       ${hardened.wasmHash} (local build ${wasmSha256}; differs across OS/rustc toolchains)`
    );
  }
} else {
  console.log(`      Current Local WASM SHA-256:  ${wasmSha256}`);
}
console.log("✅ Passport contract build, ABI, error map, and Testnet metadata checks passed.");
