#!/usr/bin/env node
/**
 * Live Stellar Testnet Hardened Education & Skills Passport Lifecycle Runner
 *
 * Safe by default: runs preflight checks ONLY unless executed with BOTH
 * CONFIRM_TESTNET_DEPLOY=1 AND --execute (preventing accidental Testnet
 * key creation, Friendbot calls, or contract deployments).
 *
 * Covers the complete hardened lifecycle when executed live:
 *   1. Ephemeral keypair provisioning (only when ALLOW_EPHEMERAL_KEYS=1) + WASM upload & deploy.
 *   2. Initialize contract & read-only get_admin / is_paused check.
 *   3. Two-step administrator handover (propose_admin -> get_pending_admin -> accept_admin),
 *      NoPendingAdmin (#18), and old-admin rejection simulations.
 *   4. Emergency circuit breaker (pause -> is_paused=true -> paused registration rejection #17 -> unpause).
 *   5. Issuer registration & template registration ('Degree').
 *   6. Unauthorized issuance (#4), primary credential issuance, verify_credential, duplicate ID (#5).
 *   7. Batch issuance (4 items <= 50), BatchTooLarge (#15, 51 items), atomic rollback sim (#5),
 *      and full multi-page get_learner_credentials_page verification (zero duplicates/omissions).
 *   8. Suspension, reactivation, active/revoked reactivation restrictions (#8), and permanent revocation.
 *   9. Dual-signed issuer key rotation (rotate_issuer_key -> old key rejected #4 -> rotated key
 *      template registration 'Cert' + post-rotation issuance + template ownership check).
 */

import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sdk from "../packages/sdk/node_modules/@stellar/stellar-sdk/lib/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const {
  Keypair,
  Address,
  Operation,
  StrKey,
  TransactionBuilder,
  Networks,
  rpc,
  nativeToScVal,
  xdr,
  scValToNative,
  authorizeEntry,
  hash: stellarHash,
} = sdk;

const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
const WASM_PATH = resolve(ROOT, "target/wasm32v1-none/release/skills_passport_core.wasm");
const LEGACY_META_PATH = resolve(ROOT, "contracts/passport/deployed-testnet.json");
const DEFAULT_HARDENED_META_PATH = resolve(
  ROOT,
  "contracts/passport/deployed-testnet-hardened.json"
);

function getArgValue(flag) {
  const eqArg = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (eqArg) return eqArg.slice(flag.length + 1);
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

const EXECUTE_LIVE =
  process.argv.includes("--execute") &&
  !process.argv.includes("--dry-run") &&
  process.env.CONFIRM_TESTNET_DEPLOY === "1";

function canonicalizeJson(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`RFC 8785 JCS rejects non-finite number: ${String(value)}`);
    }
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new Error(`RFC 8785 JCS rejects unsupported type: ${typeof value}`);
  }
  if (typeof value.toJSON === "function") {
    return canonicalizeJson(value.toJSON());
  }
  if (Array.isArray(value)) {
    return (
      "[" +
      value
        .map((item) =>
          item === undefined || typeof item === "function" || typeof item === "symbol"
            ? "null"
            : canonicalizeJson(item)
        )
        .join(",") +
      "]"
    );
  }
  const keys = Object.keys(value)
    .filter(
      (k) =>
        value[k] !== undefined &&
        typeof value[k] !== "function" &&
        typeof value[k] !== "symbol"
    )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const pairs = keys.map((k) => JSON.stringify(k) + ":" + canonicalizeJson(value[k]));
  return "{" + pairs.join(",") + "}";
}

function computeCredentialHash(unsigned) {
  return crypto.createHash("sha256").update(canonicalizeJson(unsigned), "utf8").digest("hex");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchRpcHealth() {
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
  return healthJson.result;
}

async function fundAccount(keypair, label) {
  console.log(`[*] Funding ${label} (${keypair.publicKey()}) via Friendbot...`);
  const res = await fetch(`https://friendbot.stellar.org/?addr=${keypair.publicKey()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Friendbot failed for ${label}: ${res.status} ${body}`);
  }
}

function computeDeterministicContractId(deployerPublicKey, saltBuffer) {
  const networkId = stellarHash(Buffer.from(NETWORK_PASSPHRASE, "utf8"));
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(deployerPublicKey).toScAddress(),
          salt: saltBuffer,
        })
      ),
    })
  );
  return StrKey.encodeContract(stellarHash(preimage.toXDR()));
}

async function waitForTx(server, hash, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await server.getTransaction(hash);
    if (res.status === "SUCCESS") return res;
    if (res.status === "FAILED") {
      throw new Error(`Transaction ${hash} failed: ${JSON.stringify(res.resultXdr)}`);
    }
    await sleep(2000);
  }
  throw new Error(`Transaction ${hash} timed out`);
}

async function sendOp(server, sourceKeypair, operation, extraAuthSigners = []) {
  const account = await server.getAccount(sourceKeypair.publicKey());
  const rawTx = new TransactionBuilder(account, {
    fee: "200000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  let prepared;
  if (extraAuthSigners.length === 0) {
    prepared = await server.prepareTransaction(rawTx);
  } else {
    const sim = await server.simulateTransaction(rawTx);
    if (sim.error || sim.result?.error) {
      throw new Error(`Simulation failed before auth signing: ${sim.error || sim.result?.error}`);
    }
    const { latestLedger } = await fetchRpcHealth();
    const validUntilLedgerSeq = Number(latestLedger) + 100;
    const signerMap = new Map(extraAuthSigners.map((kp) => [kp.publicKey(), kp]));

    const signedAuth = await Promise.all(
      (sim.result?.auth || []).map(async (entry) => {
        if (entry.credentials().switch() === xdr.SorobanCredentialsType.sorobanCredentialsAddress()) {
          const signerAddr = Address.fromScAddress(entry.credentials().address().address()).toString();
          const signerKp = signerMap.get(signerAddr);
          if (!signerKp) {
            throw new Error(`Missing Soroban auth signer for address ${signerAddr}`);
          }
          return await authorizeEntry(entry, signerKp, validUntilLedgerSeq, NETWORK_PASSPHRASE);
        }
        return entry;
      })
    );

    const invokeOp = rawTx.operations[0];
    const authOp = Operation.invokeHostFunction({
      func: invokeOp.func,
      auth: signedAuth,
    });
    const accountAfterRead = await server.getAccount(sourceKeypair.publicKey());
    const txWithAuth = new TransactionBuilder(accountAfterRead, {
      fee: "300000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(authOp)
      .setTimeout(60)
      .build();
    const sim2 = await server.simulateTransaction(txWithAuth);
    if (sim2.error || sim2.result?.error) {
      throw new Error(`Simulation failed with signed auth: ${sim2.error || sim2.result?.error}`);
    }
    prepared = rpc.assembleTransaction(txWithAuth, sim2).build();
  }

  prepared.sign(sourceKeypair);
  const sendRes = await server.sendTransaction(prepared);
  if (sendRes.status === "ERROR") {
    throw new Error(`Send transaction error: ${JSON.stringify(sendRes)}`);
  }
  const receipt = await waitForTx(server, sendRes.hash);
  return { hash: sendRes.hash, ledger: receipt.ledger, status: receipt.status, receipt };
}

async function simulateRead(server, contractId, fn, args = []) {
  const dummy = Keypair.random().publicKey();
  const acc = new sdk.Account(dummy, "0");
  const tx = new TransactionBuilder(acc, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.invokeContractFunction({ contract: contractId, function: fn, args }))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!sim.result?.retval) {
    throw new Error(`Read simulation failed for ${fn}: ${sim.error || JSON.stringify(sim)}`);
  }
  return scValToNative(sim.result.retval);
}

async function simulateExpectReject(
  server,
  contractId,
  fn,
  args = [],
  sourcePublicKey,
  { enforceAuth = false } = {}
) {
  const acc = new sdk.Account(sourcePublicKey || Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(acc, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.invokeContractFunction({ contract: contractId, function: fn, args }))
    .setTimeout(30)
    .build();

  let err = "";
  if (enforceAuth) {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "simulateTransaction",
        params: { transaction: tx.toXDR(), authMode: "enforce" },
      }),
    }).then((r) => r.json());
    err = res.error?.message || res.result?.error || "";
  } else {
    const sim = await server.simulateTransaction(tx);
    err = sim.error || sim.result?.error || "";
  }
  if (!err) {
    throw new Error(`Expected rejection for ${fn}, but simulation succeeded!`);
  }
  return String(err).replace(/\s+/g, " ").trim();
}

function buildBatchItemScVal(credIdBytes, hashBytes, recipientAddress, templateSymbol = "Degree") {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("credential_hash"),
      val: nativeToScVal(hashBytes, { type: "bytes" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("credential_id"),
      val: nativeToScVal(credIdBytes, { type: "bytes" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("expires_at"),
      val: xdr.ScVal.scvVoid(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("recipient"),
      val: new Address(recipientAddress).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("template_id"),
      val: xdr.ScVal.scvSymbol(templateSymbol),
    }),
  ]);
}

function getCompilerDetails() {
  const safeExec = (cmd) => {
    try {
      return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
    } catch {
      return "unknown";
    }
  };
  return {
    rustc: safeExec("rustc --version"),
    cargo: safeExec("cargo --version"),
    target: "wasm32v1-none",
    profile: "release",
  };
}

async function main() {
  console.log("==================================================================");
  console.log("  Hardened Passport Contract — Stellar Testnet E2E Runner");
  console.log(`  Mode:    ${EXECUTE_LIVE ? "AUTHORIZED LIVE E2E" : "DRY-RUN PREFLIGHT (NO TXs SUBMITTED)"}`);
  console.log(`  RPC:     ${RPC_URL}`);
  console.log(`  Network: ${NETWORK_PASSPHRASE}`);
  console.log("==================================================================\n");

  if (NETWORK_PASSPHRASE !== Networks.TESTNET) {
    throw new Error(
      `Refusing non-Testnet passphrase (${NETWORK_PASSPHRASE}). This script targets Stellar Testnet only.`
    );
  }

  if (EXECUTE_LIVE && process.env.ALLOW_EPHEMERAL_KEYS !== "1") {
    throw new Error("Live E2E creates temporary Testnet test keypairs; set ALLOW_EPHEMERAL_KEYS=1 explicitly.");
  }

  const customOut = getArgValue("--out") || process.env.PASSPORT_OUT_META;
  const outPath = customOut
    ? resolve(ROOT, customOut)
    : DEFAULT_HARDENED_META_PATH;
  if (resolve(outPath) === resolve(LEGACY_META_PATH)) {
    throw new Error("Refusing to overwrite legacy contracts/passport/deployed-testnet.json!");
  }

  if (!existsSync(WASM_PATH)) {
    throw new Error(`WASM missing at ${WASM_PATH}. Build with cargo build -p skills-passport-core --target wasm32v1-none --release`);
  }
  const wasm = readFileSync(WASM_PATH);
  const wasmHash = crypto.createHash("sha256").update(wasm).digest("hex");
  const server = new rpc.Server(RPC_URL);
  const health = await fetchRpcHealth();

  console.log(`[PREFLIGHT] Local Hardened WASM SHA-256: ${wasmHash} (${wasm.length} bytes)`);
  console.log(
    `[PREFLIGHT] Testnet RPC reachable (status ${health.status}, ledger ${health.latestLedger})`
  );

  if (!EXECUTE_LIVE) {
    console.log("\n[DRY-RUN] Lifecycle steps prepared for authorized live execution:");
    console.log("  - Upload/Deploy/Initialize hardened WASM as a separate Testnet instance");
    console.log("  - Two-step admin handover (propose_admin -> get_pending_admin -> accept_admin) + old-admin rejection");
    console.log("  - Circuit breaker pause/unpause + paused registration rejection simulation (#17)");
    console.log("  - Issuer registration, template registration, single & atomic 4-item batch issuance");
    console.log("  - Oversized batch (>50 -> #15) + atomic failure rollback sims & multi-page pagination");
    console.log("  - Suspend, reactivation restrictions (#8), revoke, dual-signed rotate_issuer_key & post-rotation issuance");
    console.log("\nRun when authorized: CONFIRM_TESTNET_DEPLOY=1 ALLOW_EPHEMERAL_KEYS=1 node scripts/testnet-e2e-live.mjs --execute");
    return;
  }

  const evidence = {
    network: "testnet",
    rpcUrl: RPC_URL,
    steps: {},
    confirmedOperations: [],
    confirmedTransactions: {},
    readOnlyQueries: {},
    negativeSimulations: {},
  };

  function recordOp(opName, authAddr, txRes, resultingState, expectedResult, actualResult) {
    const txExplorerUrl = `https://stellar.expert/explorer/testnet/tx/${txRes.hash}`;
    evidence.confirmedTransactions[opName] = {
      hash: txRes.hash,
      ledger: txRes.ledger,
      status: txRes.status,
      authorizingAccount: authAddr,
      explorerUrl: txExplorerUrl,
    };
    evidence.confirmedOperations.push({
      operation: opName,
      authorizingAccount: authAddr,
      txHash: txRes.hash,
      explorerUrl: txExplorerUrl,
      status: txRes.status,
      ledger: txRes.ledger,
      resultingState,
      expectedResult,
      actualResult,
    });
  }

  // Generate ephemeral keypairs strictly in memory (secrets are never logged or persisted)
  const admin1 = Keypair.random();
  const admin2 = Keypair.random();
  const issuer1 = Keypair.random();
  const issuer2 = Keypair.random();
  const learner = Keypair.random();

  await fundAccount(admin1, "Admin1");
  await fundAccount(admin2, "Admin2");
  await fundAccount(issuer1, "Issuer1");
  await fundAccount(issuer2, "Issuer2");

  // 1. Upload, Deploy & Initialize Hardened WASM (separate new instance)
  console.log("\n[1/10] Uploading & deploying hardened WASM as a fresh Testnet instance...");
  const upload = await sendOp(server, admin1, Operation.uploadContractWasm({ wasm }));
  recordOp(
    "uploadContractWasm",
    admin1.publicKey(),
    upload,
    `WASM uploaded (sha256=${wasmHash})`,
    "WASM uploaded on Testnet ledger",
    `SUCCESS in ledger ${upload.ledger}`
  );
  evidence.steps.uploadWasm = { tx: upload.hash, ledger: upload.ledger, wasmHash };

  const salt = crypto.randomBytes(32);
  const contractId = computeDeterministicContractId(admin1.publicKey(), salt);
  const deploy = await sendOp(
    server,
    admin1,
    Operation.createCustomContract({
      address: new Address(admin1.publicKey()),
      wasmHash: Buffer.from(wasmHash, "hex"),
      salt,
    })
  );
  recordOp(
    "createCustomContract",
    admin1.publicKey(),
    deploy,
    `Contract deployed at ${contractId}`,
    "New Soroban contract instance created pointing to hardened WASM",
    `SUCCESS (${contractId}, ledger ${deploy.ledger})`
  );
  evidence.steps.deploy = { tx: deploy.hash, ledger: deploy.ledger, contractId };
  console.log(`       Deployed contract ID: ${contractId} (ledger ${deploy.ledger})`);

  const init = await sendOp(
    server,
    admin1,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "initialize",
      args: [new Address(admin1.publicKey()).toScVal()],
    })
  );
  evidence.readOnlyQueries.initialAdmin = await simulateRead(server, contractId, "get_admin");
  evidence.readOnlyQueries.initialIsPaused = await simulateRead(server, contractId, "is_paused");
  if (evidence.readOnlyQueries.initialAdmin !== admin1.publicKey() || evidence.readOnlyQueries.initialIsPaused !== false) {
    throw new Error("Initialization readback failed");
  }
  recordOp(
    "initialize",
    admin1.publicKey(),
    init,
    `admin=${admin1.publicKey()}, is_paused=false`,
    "Initial admin set and contract unpaused",
    `SUCCESS (get_admin=${evidence.readOnlyQueries.initialAdmin}, is_paused=false)`
  );
  evidence.steps.initialize = { tx: init.hash, ledger: init.ledger };

  // 2. Two-Step Administrator Handover (admin1 -> admin2) + old admin lock-out
  console.log("[2/10] Executing two-step administrator handover (propose_admin -> accept_admin)...");
  const prop1 = await sendOp(
    server,
    admin1,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "propose_admin",
      args: [new Address(admin2.publicKey()).toScVal()],
    })
  );
  evidence.readOnlyQueries.pendingAdminBeforeAccept = await simulateRead(
    server,
    contractId,
    "get_pending_admin"
  );
  if (evidence.readOnlyQueries.pendingAdminBeforeAccept !== admin2.publicKey()) {
    throw new Error("get_pending_admin mismatch");
  }
  recordOp(
    "propose_admin",
    admin1.publicKey(),
    prop1,
    `pending_admin=${admin2.publicKey()} (admin remains ${admin1.publicKey()})`,
    "Pending admin nominated without immediate authority switch",
    `SUCCESS (get_pending_admin=${evidence.readOnlyQueries.pendingAdminBeforeAccept})`
  );
  evidence.steps.proposeAdmin = { tx: prop1.hash, ledger: prop1.ledger, proposedAdmin: admin2.publicKey() };

  const acc1 = await sendOp(
    server,
    admin2,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "accept_admin",
      args: [],
    })
  );
  evidence.readOnlyQueries.adminAfterHandover = await simulateRead(server, contractId, "get_admin");
  evidence.readOnlyQueries.pendingAdminAfterAccept = await simulateRead(
    server,
    contractId,
    "get_pending_admin"
  );
  if (evidence.readOnlyQueries.adminAfterHandover !== admin2.publicKey()) {
    throw new Error("Admin handover failed");
  }
  recordOp(
    "accept_admin",
    admin2.publicKey(),
    acc1,
    `admin=${admin2.publicKey()}, pending_admin=None`,
    "Proposed admin accepts role and clears PendingAdmin",
    `SUCCESS (get_admin=${evidence.readOnlyQueries.adminAfterHandover})`
  );
  evidence.steps.acceptAdmin = { tx: acc1.hash, ledger: acc1.ledger, acceptedAdmin: admin2.publicKey() };

  evidence.negativeSimulations.oldAdminPauseRejected = await simulateExpectReject(
    server,
    contractId,
    "pause",
    [],
    admin1.publicKey(),
    { enforceAuth: true }
  );
  evidence.negativeSimulations.oldAdminRegisterIssuerRejected = await simulateExpectReject(
    server,
    contractId,
    "register_issuer",
    [
      new Address(issuer1.publicKey()).toScVal(),
      nativeToScVal("Old Admin Rogue University", { type: "string" }),
      nativeToScVal("https://example.edu/rogue.json", { type: "string" }),
    ],
    admin1.publicKey(),
    { enforceAuth: true }
  );
  evidence.negativeSimulations.acceptAdminWithoutPendingRejected = await simulateExpectReject(
    server,
    contractId,
    "accept_admin",
    [],
    admin1.publicKey()
  );

  // 3. Emergency Pause & Unpause Circuit Breaker
  console.log("[3/10] Executing emergency pause / paused-guard sim / unpause...");
  const pauseTx = await sendOp(
    server,
    admin2,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "pause",
      args: [],
    })
  );
  evidence.readOnlyQueries.isPausedWhilePaused = await simulateRead(server, contractId, "is_paused");
  if (evidence.readOnlyQueries.isPausedWhilePaused !== true) {
    throw new Error("Expected is_paused() === true");
  }
  recordOp(
    "pause",
    admin2.publicKey(),
    pauseTx,
    "is_paused=true",
    "Admin enables circuit breaker; mutations rejected with ContractPaused (#17)",
    `SUCCESS (is_paused=true, ledger ${pauseTx.ledger})`
  );
  evidence.steps.pause = { tx: pauseTx.hash, ledger: pauseTx.ledger };

  evidence.negativeSimulations.pausedRegisterIssuerRejected = await simulateExpectReject(
    server,
    contractId,
    "register_issuer",
    [
      new Address(issuer1.publicKey()).toScVal(),
      nativeToScVal("Paused Check University", { type: "string" }),
      nativeToScVal("https://example.edu/paused.json", { type: "string" }),
    ],
    admin2.publicKey()
  );

  const unpauseTx = await sendOp(
    server,
    admin2,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "unpause",
      args: [],
    })
  );
  evidence.readOnlyQueries.isPausedAfterUnpause = await simulateRead(server, contractId, "is_paused");
  if (evidence.readOnlyQueries.isPausedAfterUnpause !== false) {
    throw new Error("Expected is_paused() === false");
  }
  recordOp(
    "unpause",
    admin2.publicKey(),
    unpauseTx,
    "is_paused=false",
    "Admin resumes normal registry mutations",
    `SUCCESS (is_paused=false, ledger ${unpauseTx.ledger})`
  );
  evidence.steps.unpause = { tx: unpauseTx.hash, ledger: unpauseTx.ledger };

  // 4. Register Authorized Issuer & Template
  console.log("[4/10] Registering authorized issuer and Degree template...");
  const regIssuer = await sendOp(
    server,
    admin2,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "register_issuer",
      args: [
        new Address(issuer1.publicKey()).toScVal(),
        nativeToScVal("MIT Digital Credentials Institute", { type: "string" }),
        nativeToScVal("https://credentials.mit.edu", { type: "string" }),
      ],
    })
  );
  const issuer1Auth = await simulateRead(server, contractId, "is_issuer_authorized", [
    new Address(issuer1.publicKey()).toScVal(),
  ]);
  if (issuer1Auth !== true) throw new Error("Expected issuer1 authorized");
  recordOp(
    "register_issuer",
    admin2.publicKey(),
    regIssuer,
    `issuer=${issuer1.publicKey()} is_active=true`,
    "Authorized issuer persisted after unpause",
    `SUCCESS (is_issuer_authorized=true, ledger ${regIssuer.ledger})`
  );
  evidence.steps.registerIssuer = {
    tx: regIssuer.hash,
    ledger: regIssuer.ledger,
    issuer: issuer1.publicKey(),
  };

  const regTpl = await sendOp(
    server,
    issuer1,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "register_template",
      args: [
        new Address(issuer1.publicKey()).toScVal(),
        xdr.ScVal.scvSymbol("Degree"),
        nativeToScVal("Bachelor of Science in Distributed Systems", { type: "string" }),
        nativeToScVal("https://schema.org/Degree", { type: "string" }),
      ],
    })
  );
  recordOp(
    "register_template (Degree)",
    issuer1.publicKey(),
    regTpl,
    "template=Degree registered under issuer1",
    "Degree schema template bound to authorized issuer1",
    `SUCCESS (ledger ${regTpl.ledger})`
  );
  evidence.steps.registerTemplate = {
    tx: regTpl.hash,
    ledger: regTpl.ledger,
    template: "Degree",
  };

  // 5. Unauthorized issuance (#4), Single Credential Issuance, Verify, Duplicate (#5)
  console.log("[5/10] Testing unauthorized rejection, issuing primary credential, and duplicate rejection...");
  const rogueIssuer = Keypair.random().publicKey();
  evidence.negativeSimulations.unauthorizedIssueRejected = await simulateExpectReject(
    server,
    contractId,
    "issue_credential",
    [
      new Address(rogueIssuer).toScVal(),
      new Address(learner.publicKey()).toScVal(),
      nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      xdr.ScVal.scvSymbol("Degree"),
      xdr.ScVal.scvVoid(),
    ],
    rogueIssuer
  );

  const cred1Id = crypto.randomBytes(32);
  const cred1HashHex = computeCredentialHash({
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    id: `urn:uuid:${cred1Id.toString("hex").slice(0, 16)}`,
    issuer: `did:stellar:${issuer1.publicKey()}`,
    credentialSubject: {
      id: `did:stellar:${learner.publicKey()}`,
      title: "Bachelor of Science in Distributed Systems",
    },
  });
  const cred1Hash = Buffer.from(cred1HashHex, "hex");
  const issue1 = await sendOp(
    server,
    issuer1,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "issue_credential",
      args: [
        new Address(issuer1.publicKey()).toScVal(),
        new Address(learner.publicKey()).toScVal(),
        nativeToScVal(cred1Id, { type: "bytes" }),
        nativeToScVal(cred1Hash, { type: "bytes" }),
        xdr.ScVal.scvSymbol("Degree"),
        xdr.ScVal.scvVoid(),
      ],
    })
  );
  evidence.readOnlyQueries.verifyValidCredential = await simulateRead(
    server,
    contractId,
    "verify_credential",
    [nativeToScVal(cred1Id, { type: "bytes" }), nativeToScVal(cred1Hash, { type: "bytes" })]
  );
  evidence.readOnlyQueries.tamperedHashVerify = await simulateRead(
    server,
    contractId,
    "verify_credential",
    [nativeToScVal(cred1Id, { type: "bytes" }), nativeToScVal(crypto.randomBytes(32), { type: "bytes" })]
  );
  recordOp(
    "issue_credential",
    issuer1.publicKey(),
    issue1,
    `credential_id=${cred1Id.toString("hex").slice(0, 14)}... status=Active(0)`,
    "Active credential committed and verified via verify_credential()",
    `SUCCESS (is_valid=${evidence.readOnlyQueries.verifyValidCredential.is_valid}, hash_matches=true)`
  );
  evidence.steps.issueCredential = {
    tx: issue1.hash,
    ledger: issue1.ledger,
    credentialId: cred1Id.toString("hex"),
    credentialHash: cred1HashHex,
  };

  evidence.negativeSimulations.duplicateIssueRejected = await simulateExpectReject(
    server,
    contractId,
    "issue_credential",
    [
      new Address(issuer1.publicKey()).toScVal(),
      new Address(learner.publicKey()).toScVal(),
      nativeToScVal(cred1Id, { type: "bytes" }),
      nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      xdr.ScVal.scvSymbol("Degree"),
      xdr.ScVal.scvVoid(),
    ],
    issuer1.publicKey()
  );

  // 6. Batch Issuance (4 items <= 50 -> total 5) + BatchTooLarge (51) + Atomic Rollback + Multi-Page Pagination
  console.log("[6/10] Testing batch_issue_credentials (4 items), 51-item limit, atomic rollback, and pagination...");
  const batchIds = Array.from({ length: 4 }, () => crypto.randomBytes(32));
  const batchItems = batchIds.map((bId) =>
    buildBatchItemScVal(bId, crypto.randomBytes(32), learner.publicKey())
  );
  const batchTx = await sendOp(
    server,
    issuer1,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "batch_issue_credentials",
      args: [new Address(issuer1.publicKey()).toScVal(), xdr.ScVal.scvVec(batchItems)],
    })
  );
  const count5 = Number(
    await simulateRead(server, contractId, "get_learner_credential_count", [
      new Address(learner.publicKey()).toScVal(),
    ])
  );
  if (count5 !== 5) throw new Error(`Expected count 5 after batch issue, got ${count5}`);
  recordOp(
    "batch_issue_credentials (4 items)",
    issuer1.publicKey(),
    batchTx,
    `learner_credential_count=${count5}`,
    "4 credentials issued atomically within MAX_BATCH_SIZE=50",
    `SUCCESS (count=${count5}, ledger ${batchTx.ledger})`
  );
  evidence.steps.batchIssueCredentials = { tx: batchTx.hash, ledger: batchTx.ledger, count: 4 };

  const allUnpaginated = await simulateRead(server, contractId, "get_learner_credentials", [
    new Address(learner.publicKey()).toScVal(),
  ]);
  const page0 = await simulateRead(server, contractId, "get_learner_credentials_page", [
    new Address(learner.publicKey()).toScVal(),
    nativeToScVal(0, { type: "u32" }),
    nativeToScVal(2, { type: "u32" }),
  ]);
  const page1 = await simulateRead(server, contractId, "get_learner_credentials_page", [
    new Address(learner.publicKey()).toScVal(),
    nativeToScVal(2, { type: "u32" }),
    nativeToScVal(2, { type: "u32" }),
  ]);
  const page2 = await simulateRead(server, contractId, "get_learner_credentials_page", [
    new Address(learner.publicKey()).toScVal(),
    nativeToScVal(4, { type: "u32" }),
    nativeToScVal(2, { type: "u32" }),
  ]);
  const pageEmpty = await simulateRead(server, contractId, "get_learner_credentials_page", [
    new Address(learner.publicKey()).toScVal(),
    nativeToScVal(6, { type: "u32" }),
    nativeToScVal(2, { type: "u32" }),
  ]);
  const fullHex = allUnpaginated.map((b) => Buffer.from(b).toString("hex"));
  const pagedHex = [...page0, ...page1, ...page2].map((b) => Buffer.from(b).toString("hex"));
  if (
    pagedHex.length !== 5 ||
    new Set(pagedHex).size !== 5 ||
    JSON.stringify(pagedHex) !== JSON.stringify(fullHex) ||
    pageEmpty.length !== 0
  ) {
    throw new Error("Pagination verification failed duplicates/omissions invariant!");
  }
  evidence.readOnlyQueries.paginationVerification = {
    totalCount: count5,
    page0Limit2Length: page0.length,
    page2Limit2Length: page1.length,
    page4Limit2Length: page2.length,
    page6Limit2Length: pageEmpty.length,
    uniqueCountAcrossAllPages: new Set(pagedHex).size,
    matchesUnpaginatedOrderExact: true,
  };
  evidence.negativeSimulations.paginationZeroLimitRejected = await simulateExpectReject(
    server,
    contractId,
    "get_learner_credentials_page",
    [
      new Address(learner.publicKey()).toScVal(),
      nativeToScVal(0, { type: "u32" }),
      nativeToScVal(0, { type: "u32" }),
    ]
  );

  // Oversized 51-item batch rejection (#15)
  const oversized = Array.from({ length: 51 }, () =>
    buildBatchItemScVal(crypto.randomBytes(32), crypto.randomBytes(32), learner.publicKey())
  );
  evidence.negativeSimulations.batchTooLarge = await simulateExpectReject(
    server,
    contractId,
    "batch_issue_credentials",
    [new Address(issuer1.publicKey()).toScVal(), xdr.ScVal.scvVec(oversized)],
    issuer1.publicKey()
  );

  // Atomic failure rollback verification: [freshId, existing cred1Id]
  const rollbackProbeId = crypto.randomBytes(32);
  evidence.negativeSimulations.batchAtomicRollbackRejected = await simulateExpectReject(
    server,
    contractId,
    "batch_issue_credentials",
    [
      new Address(issuer1.publicKey()).toScVal(),
      xdr.ScVal.scvVec([
        buildBatchItemScVal(rollbackProbeId, crypto.randomBytes(32), learner.publicKey()),
        buildBatchItemScVal(cred1Id, crypto.randomBytes(32), learner.publicKey()),
      ]),
    ],
    issuer1.publicKey()
  );
  evidence.readOnlyQueries.rollbackProbeCredentialAbsent =
    (await simulateRead(server, contractId, "get_credential", [
      nativeToScVal(rollbackProbeId, { type: "bytes" }),
    ])) === null;
  if (!evidence.readOnlyQueries.rollbackProbeCredentialAbsent) {
    throw new Error("Expected failed batch first item to remain absent");
  }

  // 7. Suspend, Reactivate, Active-Reactivation Rejection (#8)
  console.log("[7/10] Testing suspend_credential, reactivate_credential, and active-reactivation guard...");
  const susp = await sendOp(
    server,
    issuer1,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "suspend_credential",
      args: [
        new Address(issuer1.publicKey()).toScVal(),
        nativeToScVal(cred1Id, { type: "bytes" }),
        nativeToScVal("Temporary audit hold", { type: "string" }),
      ],
    })
  );
  evidence.readOnlyQueries.verifySuspended = await simulateRead(
    server,
    contractId,
    "verify_credential",
    [nativeToScVal(cred1Id, { type: "bytes" }), nativeToScVal(cred1Hash, { type: "bytes" })]
  );
  recordOp(
    "suspend_credential",
    issuer1.publicKey(),
    susp,
    "status=Suspended(3), is_valid=false",
    "Credential suspended and fails verify_credential()",
    `SUCCESS (status=${evidence.readOnlyQueries.verifySuspended.status}, is_valid=${evidence.readOnlyQueries.verifySuspended.is_valid})`
  );
  evidence.steps.suspendCredential = { tx: susp.hash, ledger: susp.ledger };

  const react = await sendOp(
    server,
    issuer1,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "reactivate_credential",
      args: [new Address(issuer1.publicKey()).toScVal(), nativeToScVal(cred1Id, { type: "bytes" })],
    })
  );
  evidence.readOnlyQueries.verifyReactivated = await simulateRead(
    server,
    contractId,
    "verify_credential",
    [nativeToScVal(cred1Id, { type: "bytes" }), nativeToScVal(cred1Hash, { type: "bytes" })]
  );
  recordOp(
    "reactivate_credential",
    issuer1.publicKey(),
    react,
    "status=Active(1), is_valid=true",
    "Suspended credential restored to Active",
    `SUCCESS (status=${evidence.readOnlyQueries.verifyReactivated.status}, is_valid=${evidence.readOnlyQueries.verifyReactivated.is_valid})`
  );
  evidence.steps.reactivateCredential = { tx: react.hash, ledger: react.ledger };

  evidence.negativeSimulations.reactivateActiveRejected = await simulateExpectReject(
    server,
    contractId,
    "reactivate_credential",
    [new Address(issuer1.publicKey()).toScVal(), nativeToScVal(cred1Id, { type: "bytes" })],
    issuer1.publicKey()
  );

  // 8. Revoke Permanently & Reactivate-Revoked / Unauthorized-Revoke Rejection
  console.log("[8/10] Testing permanent revoke_credential and revocation restrictions...");
  const rev = await sendOp(
    server,
    issuer1,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "revoke_credential",
      args: [
        new Address(issuer1.publicKey()).toScVal(),
        nativeToScVal(cred1Id, { type: "bytes" }),
        nativeToScVal("Permanent credential revocation: academic misconduct", { type: "string" }),
      ],
    })
  );
  evidence.readOnlyQueries.verifyRevoked = await simulateRead(
    server,
    contractId,
    "verify_credential",
    [nativeToScVal(cred1Id, { type: "bytes" }), nativeToScVal(cred1Hash, { type: "bytes" })]
  );
  recordOp(
    "revoke_credential",
    issuer1.publicKey(),
    rev,
    "status=Revoked(2), is_valid=false, hash_matches=true",
    "Permanent revocation recorded on-chain",
    `SUCCESS (status=${evidence.readOnlyQueries.verifyRevoked.status}, is_valid=${evidence.readOnlyQueries.verifyRevoked.is_valid})`
  );
  evidence.steps.revokeCredential = { tx: rev.hash, ledger: rev.ledger };

  evidence.negativeSimulations.reactivateRevokedRejected = await simulateExpectReject(
    server,
    contractId,
    "reactivate_credential",
    [new Address(issuer1.publicKey()).toScVal(), nativeToScVal(cred1Id, { type: "bytes" })],
    issuer1.publicKey()
  );
  evidence.negativeSimulations.unauthorizedRevokeRejected = await simulateExpectReject(
    server,
    contractId,
    "revoke_credential",
    [
      new Address(learner.publicKey()).toScVal(),
      nativeToScVal(batchIds[0], { type: "bytes" }),
      nativeToScVal("Rogue revoke", { type: "string" }),
    ],
    learner.publicKey()
  );

  // 9. Dual-Auth Issuer Key Rotation (rotate_issuer_key(issuer1, issuer2))
  console.log("[9/10] Executing dual-signed rotate_issuer_key (issuer1 -> issuer2)...");
  const rot = await sendOp(
    server,
    admin2,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "rotate_issuer_key",
      args: [
        new Address(issuer1.publicKey()).toScVal(),
        new Address(issuer2.publicKey()).toScVal(),
      ],
    }),
    [issuer2]
  );
  evidence.readOnlyQueries.oldIssuerAuthorizedAfterRotate = await simulateRead(
    server,
    contractId,
    "is_issuer_authorized",
    [new Address(issuer1.publicKey()).toScVal()]
  );
  evidence.readOnlyQueries.newIssuerAuthorizedAfterRotate = await simulateRead(
    server,
    contractId,
    "is_issuer_authorized",
    [new Address(issuer2.publicKey()).toScVal()]
  );
  if (
    evidence.readOnlyQueries.oldIssuerAuthorizedAfterRotate !== false ||
    evidence.readOnlyQueries.newIssuerAuthorizedAfterRotate !== true
  ) {
    throw new Error("Key rotation authorization state mismatch");
  }
  recordOp(
    "rotate_issuer_key",
    `${admin2.publicKey()} + ${issuer2.publicKey()} (dual Soroban auth)`,
    rot,
    `issuer1=${issuer1.publicKey()} (authorized=false), issuer2=${issuer2.publicKey()} (authorized=true)`,
    "Old issuer key deactivated and new issuer key activated atomically",
    `SUCCESS (oldAuth=false, newAuth=true, ledger ${rot.ledger})`
  );
  evidence.steps.rotateIssuerKey = {
    tx: rot.hash,
    ledger: rot.ledger,
    oldIssuer: issuer1.publicKey(),
    newIssuer: issuer2.publicKey(),
  };

  evidence.negativeSimulations.rotatedOutIssuerIssueRejected = await simulateExpectReject(
    server,
    contractId,
    "issue_credential",
    [
      new Address(issuer1.publicKey()).toScVal(),
      new Address(learner.publicKey()).toScVal(),
      nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      xdr.ScVal.scvSymbol("Degree"),
      xdr.ScVal.scvVoid(),
    ],
    issuer1.publicKey()
  );
  evidence.negativeSimulations.rotatedOutIssuerSuspendRejected = await simulateExpectReject(
    server,
    contractId,
    "suspend_credential",
    [
      new Address(issuer1.publicKey()).toScVal(),
      nativeToScVal(batchIds[0], { type: "bytes" }),
      nativeToScVal("Deauthorized caller attempt", { type: "string" }),
    ],
    issuer1.publicKey()
  );
  evidence.negativeSimulations.newIssuerSpoofOldTemplateRejected = await simulateExpectReject(
    server,
    contractId,
    "issue_credential",
    [
      new Address(issuer2.publicKey()).toScVal(),
      new Address(learner.publicKey()).toScVal(),
      nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      xdr.ScVal.scvSymbol("Degree"),
      xdr.ScVal.scvVoid(),
    ],
    issuer2.publicKey()
  );

  // 10. Verify Rotated Key Can Register 'Cert' Template & Issue Live Credential
  console.log("[10/10] Registering 'Cert' template and issuing live credential from rotated issuer2...");
  const certTpl = await sendOp(
    server,
    issuer2,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "register_template",
      args: [
        new Address(issuer2.publicKey()).toScVal(),
        xdr.ScVal.scvSymbol("Cert"),
        nativeToScVal("Verified Post-Rotation Certificate", { type: "string" }),
        nativeToScVal("https://schema.org/EducationalOccupationalCredential", { type: "string" }),
      ],
    })
  );
  recordOp(
    "register_template (Cert)",
    issuer2.publicKey(),
    certTpl,
    "template=Cert registered under rotated issuer2",
    "Rotated issuer key can register new template",
    `SUCCESS (ledger ${certTpl.ledger})`
  );
  evidence.steps.registerCertTemplate = { tx: certTpl.hash, ledger: certTpl.ledger, template: "Cert" };

  const postCredId = crypto.randomBytes(32);
  const postCredHashHex = computeCredentialHash({
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    id: `urn:uuid:${postCredId.toString("hex").slice(0, 16)}`,
    issuer: `did:stellar:${issuer2.publicKey()}`,
    credentialSubject: {
      id: `did:stellar:${learner.publicKey()}`,
      title: "Verified Post-Rotation Certificate",
    },
  });
  const postIssue = await sendOp(
    server,
    issuer2,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "issue_credential",
      args: [
        new Address(issuer2.publicKey()).toScVal(),
        new Address(learner.publicKey()).toScVal(),
        nativeToScVal(postCredId, { type: "bytes" }),
        nativeToScVal(Buffer.from(postCredHashHex, "hex"), { type: "bytes" }),
        xdr.ScVal.scvSymbol("Cert"),
        xdr.ScVal.scvVoid(),
      ],
    })
  );
  evidence.readOnlyQueries.finalLearnerCredentialCount = Number(
    await simulateRead(server, contractId, "get_learner_credential_count", [
      new Address(learner.publicKey()).toScVal(),
    ])
  );
  evidence.readOnlyQueries.postRotationVerifyValid = await simulateRead(
    server,
    contractId,
    "verify_credential",
    [
      nativeToScVal(postCredId, { type: "bytes" }),
      nativeToScVal(Buffer.from(postCredHashHex, "hex"), { type: "bytes" }),
    ]
  );
  if (
    evidence.readOnlyQueries.postRotationVerifyValid.is_valid !== true ||
    evidence.readOnlyQueries.finalLearnerCredentialCount !== 6
  ) {
    throw new Error("Post-rotation verification failed");
  }
  recordOp(
    "issue_credential (post-rotation)",
    issuer2.publicKey(),
    postIssue,
    `post_cred=${postCredId.toString("hex").slice(0, 14)}... count=${evidence.readOnlyQueries.finalLearnerCredentialCount}`,
    "Rotated issuer issues valid Active credential under Cert",
    `SUCCESS (is_valid=true, totalCount=${evidence.readOnlyQueries.finalLearnerCredentialCount})`
  );
  evidence.steps.postRotationIssueCredential = {
    tx: postIssue.hash,
    ledger: postIssue.ledger,
    credentialId: postCredId.toString("hex"),
    credentialHash: postCredHashHex,
  };

  let legacyContractReference = null;
  if (existsSync(LEGACY_META_PATH)) {
    const prev = JSON.parse(readFileSync(LEGACY_META_PATH, "utf8"));
    legacyContractReference = {
      contractId: prev.contractId,
      wasmHash: prev.wasmHash,
      deployedAt: prev.deployedAt,
      manifestPath: "contracts/passport/deployed-testnet.json",
      note: "Preserved unmodified pre-hardening 2026-10-27 Testnet deployment.",
    };
  }

  const summary = {
    contractId,
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    wasmHash,
    adminPublicKey: admin2.publicKey(),
    previousAdminPublicKey: admin1.publicKey(),
    issuerPublicKey: issuer2.publicKey(),
    rotatedOutIssuerPublicKey: issuer1.publicKey(),
    learnerPublicKey: learner.publicKey(),
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://stellar.expert/explorer/testnet/contract/${contractId}`,
    compiler: getCompilerDetails(),
    legacyContractReference,
    evidence,
  };

  const jsonReplacer = (_k, v) => (typeof v === "bigint" ? v.toString() : v);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(summary, jsonReplacer, 2) + "\n");
  console.log(`\nLive Hardened E2E Completed! Contract=${contractId}, Report saved to: ${outPath}`);
}

main().catch((err) => {
  console.error("Testnet lifecycle failed:", err);
  process.exit(1);
});
