#!/usr/bin/env node
/**
 * Safe Deployment & Preflight Preparation Script for the Hardened Education Passport Contract
 *
 * Default behavior (--dry-run / missing CONFIRM_TESTNET_DEPLOY=1):
 *   Performs read-only preflight checks ONLY (validates local release WASM SHA-256,
 *   checks environment variables, inspects deployed-testnet.json protection, verifies live
 *   Testnet RPC connectivity) without generating keys, calling Friendbot, spending XLM,
 *   or deploying contracts.
 *
 * Authorized live deployment:
 *   CONFIRM_TESTNET_DEPLOY=1 PASSPORT_ADMIN_SECRET=S... node scripts/deploy-passport-testnet.mjs --execute
 *   (or ALLOW_EPHEMERAL_KEYS=1 for a fresh throwaway Testnet keypair funded via Friendbot).
 *   Existing contracts/passport/deployed-testnet.json is NEVER overwritten unless
 *   CONFIRM_OVERWRITE_DEPLOYED=1 is also explicitly set.
 */

import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sdk from "../packages/sdk/node_modules/@stellar/stellar-sdk/lib/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const {
  Address,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  rpc,
  scValToNative,
} = sdk;

const RPC_URL = process.env.RPC_URL || process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
const WASM_PATH = resolve(ROOT, "target/wasm32v1-none/release/skills_passport_core.wasm");
const FROZEN_META_PATH = resolve(ROOT, "contracts/passport/deployed-testnet.json");

const EXECUTE_REQUESTED =
  process.argv.includes("--execute") &&
  !process.argv.includes("--dry-run") &&
  process.env.CONFIRM_TESTNET_DEPLOY === "1";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForTx(server, hash, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await server.getTransaction(hash);
    if (res.status === "SUCCESS") return res;
    if (res.status === "FAILED") {
      throw new Error(`Transaction ${hash} failed: ${JSON.stringify(res.resultXdr)}`);
    }
    await sleep(2000);
  }
  throw new Error(`Transaction ${hash} timed out waiting for inclusion`);
}

async function simulateReadOnly(server, contractId, fnName, args = []) {
  const dummy = Keypair.random();
  const account = new sdk.Account(dummy.publicKey(), "0");
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: fnName,
        args,
      })
    )
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!sim.result || !sim.result.retval) {
    throw new Error(`Simulation failed for ${fnName}: ${sim.error || JSON.stringify(sim)}`);
  }
  return scValToNative(sim.result.retval);
}

async function main() {
  console.log("==================================================================");
  console.log("  Education & Skills Passport — Safe Testnet Deployment Check");
  console.log(`  Mode:        ${EXECUTE_REQUESTED ? "AUTHORIZED LIVE DEPLOYMENT" : "DRY-RUN PREFLIGHT (READ-ONLY)"}`);
  console.log(`  RPC URL:     ${RPC_URL}`);
  console.log(`  Passphrase:  ${NETWORK_PASSPHRASE}`);
  console.log("==================================================================\n");

  if (NETWORK_PASSPHRASE !== Networks.TESTNET) {
    throw new Error(
      `Refusing non-Testnet passphrase (${NETWORK_PASSPHRASE}). This script targets Stellar Testnet only.`
    );
  }

  // 1. Validate local WASM build and compare with existing Testnet record
  if (!existsSync(WASM_PATH)) {
    throw new Error(
      `Missing compiled release WASM at ${WASM_PATH}. Build first via: cargo build -p skills-passport-core --target wasm32v1-none --release`
    );
  }
  const wasm = readFileSync(WASM_PATH);
  const localWasmHash = crypto.createHash("sha256").update(wasm).digest("hex");

  const wasmModule = new WebAssembly.Module(wasm);
  const exportedFuncs = new Set(
    WebAssembly.Module.exports(wasmModule)
      .filter((e) => e.kind === "function")
      .map((e) => e.name)
  );
  for (const requiredFn of [
    "initialize",
    "propose_admin",
    "accept_admin",
    "pause",
    "unpause",
    "rotate_issuer_key",
    "get_learner_credentials_page",
  ]) {
    if (!exportedFuncs.has(requiredFn)) {
      throw new Error(`Local WASM lacks expected hardened entrypoint '${requiredFn}'`);
    }
  }

  const frozenMeta = existsSync(FROZEN_META_PATH)
    ? JSON.parse(readFileSync(FROZEN_META_PATH, "utf8"))
    : null;

  console.log(`[1/4] Local WASM validated (${wasm.length} bytes)`);
  console.log(`      Hardened Local WASM Hash: ${localWasmHash}`);
  if (frozenMeta) {
    console.log(`      Existing Testnet ID:      ${frozenMeta.contractId} (deployed ${frozenMeta.deployedAt})`);
    console.log(`      Existing Testnet WASM:    ${frozenMeta.wasmHash}`);
    console.log(
      `      Overwrite Protection:     ${
        process.env.CONFIRM_OVERWRITE_DEPLOYED === "1"
          ? "CONFIRM_OVERWRITE_DEPLOYED=1 (would update deployed-testnet.json)"
          : "LOCKED (existing deployed-testnet.json preserved; writes to artifacts/)"
      }`
    );
  }

  // 2. Validate signing configuration WITHOUT touching or printing secret values
  const providedSecret = process.env.PASSPORT_ADMIN_SECRET || process.env.OPERATOR_SECRET;
  if (providedSecret !== undefined && providedSecret !== "") {
    if (!StrKey.isValidEd25519SecretSeed(providedSecret.trim())) {
      throw new Error("PASSPORT_ADMIN_SECRET / OPERATOR_SECRET is not a valid Stellar S... seed");
    }
    const pub = Keypair.fromSecret(providedSecret.trim()).publicKey();
    if (frozenMeta && pub === frozenMeta.adminPublicKey) {
      console.log(`      [NOTE] Provided admin public key matches previous deployment admin (${pub}).`);
    } else {
      console.log(`[2/4] Validated provided deployer/admin public key: ${pub}`);
    }
  } else {
    console.log(
      `[2/4] No PASSPORT_ADMIN_SECRET / OPERATOR_SECRET provided (${
        process.env.ALLOW_EPHEMERAL_KEYS === "1"
          ? "ALLOW_EPHEMERAL_KEYS=1 enabled for live throwaway keypair"
          : "ephemeral key generation blocked unless ALLOW_EPHEMERAL_KEYS=1"
      }).`
    );
  }

  // 3. Check live Soroban RPC reachability (read-only JSON-RPC getHealth avoids XDR header decoding)
  const healthRes = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
  });
  if (!healthRes.ok) {
    throw new Error(`Soroban RPC getHealth failed: HTTP ${healthRes.status}`);
  }
  const healthJson = await healthRes.json();
  if (healthJson.error || !healthJson.result) {
    throw new Error(`Soroban RPC getHealth error: ${JSON.stringify(healthJson.error || healthJson)}`);
  }
  console.log(
    `[3/4] Soroban Testnet RPC reachable (status: ${healthJson.result.status}, latest ledger: ${healthJson.result.latestLedger})`
  );

  if (!EXECUTE_REQUESTED) {
    console.log("\n[4/4] Dry-run complete. No keys generated, no funds spent, no contract deployed.");
    console.log("      To execute a non-destructive Testnet deployment once authorized:");
    console.log(
      "        CONFIRM_TESTNET_DEPLOY=1 PASSPORT_ADMIN_SECRET=S... node scripts/deploy-passport-testnet.mjs --execute"
    );
    return;
  }

  // 4. Authorized Live Execution Path
  let adminKeypair;
  if (providedSecret && providedSecret.trim()) {
    adminKeypair = Keypair.fromSecret(providedSecret.trim());
  } else if (process.env.ALLOW_EPHEMERAL_KEYS === "1") {
    adminKeypair = Keypair.random();
    console.log(`\n[*] Provisioning ephemeral Testnet admin keypair: ${adminKeypair.publicKey()}`);
    const friendbotRes = await fetch(
      `https://friendbot.stellar.org/?addr=${adminKeypair.publicKey()}`
    );
    if (!friendbotRes.ok) {
      throw new Error(`Friendbot funding failed: ${friendbotRes.statusText}`);
    }
  } else {
    throw new Error(
      "Refusing live deployment without PASSPORT_ADMIN_SECRET / OPERATOR_SECRET or ALLOW_EPHEMERAL_KEYS=1"
    );
  }

  const server = new rpc.Server(RPC_URL);

  const sendTx = async (op) => {
    const acc = await server.getAccount(adminKeypair.publicKey());
    const tx = new TransactionBuilder(acc, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(adminKeypair);
    const send = await server.sendTransaction(prepared);
    if (send.status === "ERROR") {
      throw new Error(`sendTransaction rejected: ${JSON.stringify(send)}`);
    }
    const receipt = await waitForTx(server, send.hash);
    return { tx: send.hash, receipt };
  };

  console.log("\n[*] Uploading hardened WASM bytecode...");
  const upload = await sendTx(Operation.uploadContractWasm({ wasm }));
  const uploadedHash = upload.receipt.returnValue.bytes().toString("hex");

  console.log("[*] Creating new Soroban contract instance...");
  const deploy = await sendTx(
    Operation.createCustomContract({
      address: new Address(adminKeypair.publicKey()),
      wasmHash: Buffer.from(uploadedHash, "hex"),
    })
  );
  const contractId = Address.fromScAddress(deploy.receipt.returnValue.address()).toString();

  console.log("[*] Initializing contract admin...");
  const init = await sendTx(
    Operation.invokeContractFunction({
      contract: contractId,
      function: "initialize",
      args: [new Address(adminKeypair.publicKey()).toScVal()],
    })
  );

  const verifiedAdmin = await simulateReadOnly(server, contractId, "get_admin");
  const pausedState = await simulateReadOnly(server, contractId, "is_paused");
  if (verifiedAdmin !== adminKeypair.publicKey() || pausedState !== false) {
    throw new Error("Post-deploy initialization state mismatch");
  }

  const output = {
    contractId,
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    wasmHash: uploadedHash,
    adminPublicKey: adminKeypair.publicKey(),
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://stellar.expert/explorer/testnet/contract/${contractId}`,
    transactions: {
      uploadWasm: upload.tx,
      deploy: deploy.tx,
      initialize: init.tx,
    },
  };

  const outPath =
    process.env.CONFIRM_OVERWRITE_DEPLOYED === "1"
      ? FROZEN_META_PATH
      : resolve(ROOT, `artifacts/passport-deploy-${Date.now()}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nDeployment complete (${contractId}); summary written to ${outPath}`);
}

main().catch((err) => {
  console.error("Deployment check failed:", err.message || err);
  process.exit(1);
});
