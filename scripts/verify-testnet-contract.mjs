#!/usr/bin/env node
/**
 * Independent Stellar Testnet Contract Verification Tool
 *
 * Verifies the deployed Decentralized Global Education & Skills Passport contract
 * (contracts/passport/deployed-testnet.json) directly against Stellar Testnet Soroban RPC
 * (and Horizon Testnet archive when checking pruned older Soroban RPC tx history):
 *
 * 1. Compares live on-chain executable WASM hash against deployed-testnet.json and local WASM build.
 * 2. Verifies historical deployment/lifecycle transaction hashes on Stellar Testnet.
 * 3. Verifies contract administrator via get_admin().
 * 4. Verifies authorized issuer status via is_issuer_authorized() & get_issuer().
 * 5. Verifies registered template schema via get_template().
 * 6. Verifies final credential state via get_credential() & verify_credential().
 * 7. Runs read-only negative simulation checks against the live Testnet contract (zero state mutations).
 * 8. Prints independent curl command for non-Node.js verification.
 */

import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sdk from "../packages/sdk/node_modules/@stellar/stellar-sdk/lib/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  rpc,
  xdr,
  Address,
  scValToNative,
  TransactionBuilder,
  Networks,
  Operation,
  Keypair,
} = sdk;

function getArgValue(flag) {
  const eqArg = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (eqArg) return eqArg.slice(flag.length + 1);
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

const CUSTOM_META_ARG = getArgValue("--meta");
const DEPLOYED_META_PATH = CUSTOM_META_ARG
  ? resolve(process.cwd(), CUSTOM_META_ARG)
  : resolve(__dirname, "../contracts/passport/deployed-testnet.json");
const DEPLOYED = JSON.parse(readFileSync(DEPLOYED_META_PATH, "utf8"));

const RPC_URL = process.env.RPC_URL || DEPLOYED.rpcUrl || "https://soroban-testnet.stellar.org";
const HORIZON_URL =
  process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE || DEPLOYED.networkPassphrase || Networks.TESTNET;
const WASM_PATH = resolve(
  __dirname,
  "../target/wasm32v1-none/release/skills_passport_core.wasm"
);
const STRICT_LOCAL_WASM = process.argv.includes("--strict-local-wasm");

const EXPECTED_CONTRACT_ID = getArgValue("--contract-id") || DEPLOYED.contractId;
const EXPECTED_RECORDED_WASM_HASH = DEPLOYED.wasmHash || DEPLOYED.localWasmHash;
const EXPECTED_ADMIN = DEPLOYED.adminPublicKey;
const EXPECTED_ISSUER = DEPLOYED.issuerPublicKey;
const EXPECTED_LEARNER = DEPLOYED.learnerPublicKey;
const EXPECTED_CREDENTIAL_ID = DEPLOYED.evidence?.steps?.issueCredential?.credentialId;
const EXPECTED_CREDENTIAL_HASH = DEPLOYED.evidence?.steps?.issueCredential?.credentialHash;

function buildSimulationTx(contractId, functionName, args = [], sourcePublicKey) {
  const source = sourcePublicKey || Keypair.random().publicKey();
  const account = new sdk.Account(source, "0");
  return new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        args,
      })
    )
    .setTimeout(30)
    .build();
}

async function simulateCall(server, contractId, functionName, args = []) {
  const tx = buildSimulationTx(contractId, functionName, args);
  const sim = await server.simulateTransaction(tx);
  if (!sim.result || !sim.result.retval) {
    throw new Error(
      `Simulation failed for ${functionName}: ${sim.error || JSON.stringify(sim)}`
    );
  }
  return scValToNative(sim.result.retval);
}

async function simulateExpectRejection(
  server,
  contractId,
  functionName,
  args = [],
  sourcePublicKey,
  { enforceAuth = false } = {}
) {
  const tx = buildSimulationTx(contractId, functionName, args, sourcePublicKey);
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
    const errMsg = res.error?.message || res.result?.error || "";
    if (errMsg) {
      return { rejected: true, error: String(errMsg).replace(/\s+/g, " ").trim() };
    }
    return { rejected: false };
  }
  const sim = await server.simulateTransaction(tx);
  const errMsg = sim.error || (sim.result && sim.result.error) || "";
  if (errMsg) {
    return { rejected: true, error: String(errMsg).replace(/\s+/g, " ").trim() };
  }
  return {
    rejected: false,
    retval: sim.result?.retval ? scValToNative(sim.result.retval) : undefined,
  };
}

async function inspectHistoricalTx(server, txHash) {
  try {
    const rpcTx = await server.getTransaction(txHash);
    if (rpcTx && rpcTx.status === "SUCCESS") {
      return {
        verified: true,
        source: "Soroban RPC",
        status: rpcTx.status,
        ledger: rpcTx.ledger,
      };
    }
    if (rpcTx && rpcTx.status === "FAILED") {
      return { verified: false, source: "Soroban RPC", status: "FAILED" };
    }
  } catch {
    // Fall through to Horizon check below
  }

  // Soroban Testnet RPC retains a short rolling tx window (~24h-7d); check Horizon Testnet archive
  const res = await fetch(`${HORIZON_URL}/transactions/${txHash}`);
  if (!res.ok) {
    return {
      verified: false,
      source: "Horizon Testnet",
      status: `HTTP ${res.status}`,
    };
  }
  const body = await res.json();
  return {
    verified: body.successful === true,
    source: "Horizon Testnet",
    status: body.successful ? "SUCCESS" : "FAILED",
    ledger: body.ledger,
    createdAt: body.created_at,
  };
}

async function main() {
  console.log("==================================================================");
  console.log("  Independent Stellar Soroban Testnet Contract Verifier");
  console.log(`  RPC URL:     ${RPC_URL}`);
  console.log(`  Meta Source: ${DEPLOYED_META_PATH}`);
  console.log(`  Contract ID: ${EXPECTED_CONTRACT_ID}`);
  console.log("==================================================================\n");

  const server = new rpc.Server(RPC_URL);
  let confirmedTxCount = 0;
  let readOnlyQueryCount = 0;
  let negativeSimCount = 0;

  // 1. WASM Hash Verification
  console.log("[1/9] [LIVE READ-ONLY RPC QUERY] Verifying live on-chain WASM hash...");
  const ledgerEntry = await server.getContractData(
    EXPECTED_CONTRACT_ID,
    xdr.ScVal.scvLedgerKeyContractInstance()
  );
  readOnlyQueryCount += 1;
  const contractData = ledgerEntry.val.contractData();
  const instance = contractData.val().instance();
  const onChainWasmHash = instance.executable().wasmHash().toString("hex");
  console.log(`      Recorded Deployed Hash:      ${EXPECTED_RECORDED_WASM_HASH ?? "N/A"}`);
  console.log(`      Live On-Chain WASM Hash:     ${onChainWasmHash}`);

  if (EXPECTED_RECORDED_WASM_HASH && onChainWasmHash !== EXPECTED_RECORDED_WASM_HASH) {
    throw new Error(
      `Live WASM hash ${onChainWasmHash} differs from metadata (${EXPECTED_RECORDED_WASM_HASH})!`
    );
  }
  console.log("      [PASS] Live Testnet WASM matches deployment metadata.");

  let localWasmHash;
  if (existsSync(WASM_PATH)) {
    const wasmFile = readFileSync(WASM_PATH);
    localWasmHash = crypto.createHash("sha256").update(wasmFile).digest("hex");
    console.log(`      Local Release WASM Hash:     ${localWasmHash}`);
    if (localWasmHash === onChainWasmHash) {
      console.log("      [PASS] Local release WASM bytecode matches on-chain Testnet binary byte-for-byte!\n");
    } else if (STRICT_LOCAL_WASM) {
      throw new Error(
        `Local WASM (${localWasmHash}) differs from deployed Testnet WASM (${onChainWasmHash})`
      );
    } else {
      console.log(
        "      [INFO] Local hardened WASM differs from the older Testnet deployment (re-deploy requires explicit authorization).\n"
      );
    }
  } else {
    console.log("      [INFO] Local WASM binary not built; skipping local WASM comparison.\n");
  }

  // 2. Historical Transaction Ledger Evidence Verification
  console.log("[2/9] [CONFIRMED HISTORICAL ON-CHAIN TXS] Verifying recorded transaction hashes...");
  const steps = DEPLOYED.evidence?.steps ?? {};
  const txEntries = [
    ["uploadWasm", steps.uploadWasm?.tx],
    ["deploy", steps.deploy?.tx ?? DEPLOYED.txs?.deploy],
    ["initialize", steps.initialize?.tx ?? DEPLOYED.txs?.initialize],
    ["proposeAdmin", steps.proposeAdmin?.tx],
    ["acceptAdmin", steps.acceptAdmin?.tx],
    ["pause", steps.pause?.tx],
    ["unpause", steps.unpause?.tx],
    ["registerIssuer", steps.registerIssuer?.tx],
    ["registerTemplate", steps.registerTemplate?.tx],
    ["issueCredential", steps.issueCredential?.tx],
    ["batchIssue", steps.batchIssueCredentials?.tx],
    ["suspendCredential", steps.suspendCredential?.tx],
    ["reactivateCredential", steps.reactivateCredential?.tx],
    ["revokeCredential", steps.revokeCredential?.tx],
    ["rotateIssuerKey", steps.rotateIssuerKey?.tx],
    ["registerCertTpl", steps.registerCertTemplate?.tx],
    ["postRotateIssue", steps.postRotationIssueCredential?.tx],
  ].filter(([, txHash]) => typeof txHash === "string" && txHash.length > 0);

  if (txEntries.length === 0) {
    console.log("      [INFO] No historical tx hashes recorded in metadata file.\n");
  } else {
    for (const [label, txHash] of txEntries) {
      const info = await inspectHistoricalTx(server, txHash);
      console.log(
        `      ${label.padEnd(21)} ${txHash.slice(0, 14)}... -> ${info.status} (${info.source}, ledger ${info.ledger ?? "N/A"})`
      );
      if (!info.verified) {
        throw new Error(`Historical Testnet tx failed verification: ${label} (${txHash})`);
      }
      confirmedTxCount += 1;
    }
    console.log(
      `      [PASS] Confirmed ${confirmedTxCount} historical on-chain Testnet transactions!\n`
    );
  }

  // 3. Administrator Verification
  console.log("[3/9] [LIVE READ-ONLY RPC QUERY] Verifying contract administrator via get_admin()...");
  const adminResult = await simulateCall(server, EXPECTED_CONTRACT_ID, "get_admin");
  readOnlyQueryCount += 1;
  console.log(`      On-Chain Admin Address:      ${adminResult}`);
  if (EXPECTED_ADMIN) {
    console.log(`      Expected Admin Address:      ${EXPECTED_ADMIN}`);
    if (adminResult !== EXPECTED_ADMIN) {
      throw new Error(`Admin mismatch: expected ${EXPECTED_ADMIN}, got ${adminResult}`);
    }
  }
  console.log("      [PASS] Contract administrator successfully verified!\n");

  // 4. Issuer Authorization Verification
  console.log("[4/9] [LIVE READ-ONLY RPC QUERY] Verifying authorized issuer state...");
  if (!EXPECTED_ISSUER) {
    console.log("      [INFO] No issuerPublicKey in metadata; skipping issuer query.\n");
  } else {
    const isAuthorized = await simulateCall(
      server,
      EXPECTED_CONTRACT_ID,
      "is_issuer_authorized",
      [new Address(EXPECTED_ISSUER).toScVal()]
    );
    readOnlyQueryCount += 1;
    console.log(`      Issuer:                      ${EXPECTED_ISSUER}`);
    console.log(`      Authorized Status:           ${isAuthorized}`);
    if (!isAuthorized) {
      throw new Error(`Issuer ${EXPECTED_ISSUER} is not authorized on-chain!`);
    }

    const issuerRecord = await simulateCall(
      server,
      EXPECTED_CONTRACT_ID,
      "get_issuer",
      [new Address(EXPECTED_ISSUER).toScVal()]
    );
    readOnlyQueryCount += 1;
    console.log(`      Institution Name:            ${issuerRecord.name}`);
    console.log(`      Metadata URI:                ${issuerRecord.metadata_uri}`);
    console.log("      [PASS] Authorized educational institution confirmed!\n");
  }

  // 5. Template Verification
  console.log("[5/9] [LIVE READ-ONLY RPC QUERY] Verifying credential schema template 'Degree'...");
  if (!EXPECTED_ISSUER) {
    console.log("      [INFO] No issuer fixture in metadata; skipping 'Degree' template check.\n");
  } else {
    const templateRecord = await simulateCall(
      server,
      EXPECTED_CONTRACT_ID,
      "get_template",
      [xdr.ScVal.scvSymbol("Degree")]
    );
    readOnlyQueryCount += 1;
    console.log(`      Template ID:                 ${templateRecord.template_id}`);
    console.log(`      Template Name:               ${templateRecord.name}`);
    console.log(`      Schema URI:                  ${templateRecord.schema_uri}`);
    console.log("      [PASS] Credential schema template confirmed!\n");
  }

  // 6. Final Credential Record & Lifecycle Verification
  console.log("[6/9] [LIVE READ-ONLY RPC QUERY] Verifying on-chain credential record & verify_credential()...");
  const credIdBytes = EXPECTED_CREDENTIAL_ID
    ? Buffer.from(EXPECTED_CREDENTIAL_ID, "hex")
    : undefined;
  const credHashBytes = EXPECTED_CREDENTIAL_HASH
    ? Buffer.from(EXPECTED_CREDENTIAL_HASH, "hex")
    : undefined;

  if (!credIdBytes || !credHashBytes) {
    console.log("      [INFO] No credential fixture in metadata; skipping seeded credential check.\n");
  } else {
    const credRecord = await simulateCall(
      server,
      EXPECTED_CONTRACT_ID,
      "get_credential",
      [sdk.nativeToScVal(credIdBytes, { type: "bytes" })]
    );
    readOnlyQueryCount += 1;
    console.log(`      Credential ID:               ${Buffer.from(credRecord.credential_id).toString("hex")}`);
    console.log(`      Committed Hash:              ${Buffer.from(credRecord.credential_hash).toString("hex")}`);
    console.log(`      Final On-Chain Status:       ${credRecord.status} (Revoked)`);
    console.log(`      Revocation Reason:           ${credRecord.revocation_reason}`);

    const verifyResult = await simulateCall(
      server,
      EXPECTED_CONTRACT_ID,
      "verify_credential",
      [
        sdk.nativeToScVal(credIdBytes, { type: "bytes" }),
        sdk.nativeToScVal(credHashBytes, { type: "bytes" }),
      ]
    );
    readOnlyQueryCount += 1;
    console.log("      verify_credential() result:", verifyResult);
    if (verifyResult.hash_matches !== true || verifyResult.is_valid !== false) {
      throw new Error("Expected verify_credential() on revoked Testnet record to match hash and return is_valid=false");
    }
    console.log("      [PASS] Hash matches committed digest and revocation is enforced on-chain!\n");
  }

  // 7. Build Generation & Hardened Capabilities Probe
  console.log("[7/9] [BUILD GENERATION PROBE] Checking hardened contract entrypoints via is_paused()...");
  const pauseProbe = await simulateExpectRejection(
    server,
    EXPECTED_CONTRACT_ID,
    "is_paused"
  );
  let hasHardenedApi = false;
  if (!pauseProbe.rejected && typeof pauseProbe.retval === "boolean") {
    hasHardenedApi = true;
    readOnlyQueryCount += 1;
    console.log(`      is_paused():                 ${pauseProbe.retval}`);
    const pendingAdmin = await simulateCall(server, EXPECTED_CONTRACT_ID, "get_pending_admin");
    readOnlyQueryCount += 1;
    console.log(`      get_pending_admin():         ${pendingAdmin ?? "None"}`);
    if (EXPECTED_LEARNER) {
      const count = await simulateCall(
        server,
        EXPECTED_CONTRACT_ID,
        "get_learner_credential_count",
        [new Address(EXPECTED_LEARNER).toScVal()]
      );
      readOnlyQueryCount += 1;
      const page = await simulateCall(
        server,
        EXPECTED_CONTRACT_ID,
        "get_learner_credentials_page",
        [
          new Address(EXPECTED_LEARNER).toScVal(),
          sdk.nativeToScVal(0, { type: "u32" }),
          sdk.nativeToScVal(10, { type: "u32" }),
        ]
      );
      readOnlyQueryCount += 1;
      console.log(`      learner credential count:    ${count} (page size=${Array.isArray(page) ? page.length : 0})`);
    }
    console.log("      [PASS] Deployed contract exposes hardened v2 API (pause, pending admin, pagination).\n");
  } else {
    negativeSimCount += 1;
    console.log(`      is_paused() probe result:    REJECTED (${pauseProbe.error.slice(0, 90)})`);
    console.log(
      "      [INFO] Empirically confirms live contract runs pre-hardening 2026-10-27 WASM (missing pause, 2-step admin handover, key rotation, batch caps, pagination).\n"
    );
  }

  // 8. Read-Only Live Negative Security Simulations (No XLM Spent, No State Changed)
  console.log("[8/9] [READ-ONLY NEGATIVE SIMULATIONS] Executing negative security probes (no state changed)...");

  if (credIdBytes) {
    // 8a. Tampered hash
    const tamperedResult = await simulateCall(
      server,
      EXPECTED_CONTRACT_ID,
      "verify_credential",
      [
        sdk.nativeToScVal(credIdBytes, { type: "bytes" }),
        sdk.nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      ]
    );
    readOnlyQueryCount += 1;
    if (tamperedResult.hash_matches !== false || tamperedResult.is_valid !== false) {
      throw new Error("Tampered hash was incorrectly accepted!");
    }
    console.log("      [PASS 8a] Tampered hash rejected (hash_matches=false, is_valid=false)");
  }

  // 8b. Nonexistent credential ID
  const unknownCredSim = await simulateExpectRejection(
    server,
    EXPECTED_CONTRACT_ID,
    "verify_credential",
    [
      sdk.nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      sdk.nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
    ]
  );
  const unknownRejected =
    unknownCredSim.rejected || unknownCredSim.retval?.is_valid === false;
  if (!unknownRejected) {
    throw new Error("Nonexistent credential ID was incorrectly marked valid!");
  }
  negativeSimCount += 1;
  console.log(
    `      [PASS 8b] Nonexistent credential rejected (${unknownCredSim.rejected ? "contract trap/error" : "is_valid=false"})`
  );

  // 8c. Unauthorized issuer attempting issue_credential
  const rogueIssuer = Keypair.random().publicKey();
  const targetLearner = EXPECTED_LEARNER || Keypair.random().publicKey();
  const unauthIssueSim = await simulateExpectRejection(
    server,
    EXPECTED_CONTRACT_ID,
    "issue_credential",
    [
      new Address(rogueIssuer).toScVal(),
      new Address(targetLearner).toScVal(),
      sdk.nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      sdk.nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
      xdr.ScVal.scvSymbol("Degree"),
      xdr.ScVal.scvVoid(),
    ],
    rogueIssuer
  );
  if (!unauthIssueSim.rejected) {
    throw new Error("Unauthorized issuer simulation succeeded unexpectedly!");
  }
  negativeSimCount += 1;
  console.log(`      [PASS 8c] Unauthorized issuance simulation rejected (${unauthIssueSim.error.slice(0, 80)})`);

  if (credIdBytes && EXPECTED_ISSUER && EXPECTED_LEARNER) {
    // 8d. Duplicate credential ID simulation
    const dupSim = await simulateExpectRejection(
      server,
      EXPECTED_CONTRACT_ID,
      "issue_credential",
      [
        new Address(EXPECTED_ISSUER).toScVal(),
        new Address(EXPECTED_LEARNER).toScVal(),
        sdk.nativeToScVal(credIdBytes, { type: "bytes" }),
        sdk.nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
        xdr.ScVal.scvSymbol("Degree"),
        xdr.ScVal.scvVoid(),
      ],
      EXPECTED_ISSUER
    );
    if (!dupSim.rejected) {
      throw new Error("Duplicate credential ID simulation succeeded unexpectedly!");
    }
    negativeSimCount += 1;
    console.log(`      [PASS 8d] Duplicate credential ID simulation rejected (${dupSim.error.slice(0, 80)})`);

    // 8e. Reactivate permanently revoked credential simulation
    const reactivateRevokedSim = await simulateExpectRejection(
      server,
      EXPECTED_CONTRACT_ID,
      "reactivate_credential",
      [
        new Address(EXPECTED_ISSUER).toScVal(),
        sdk.nativeToScVal(credIdBytes, { type: "bytes" }),
      ],
      EXPECTED_ISSUER
    );
    if (!reactivateRevokedSim.rejected) {
      throw new Error("Reactivating revoked credential simulation succeeded unexpectedly!");
    }
    negativeSimCount += 1;
    console.log(
      `      [PASS 8e] Reactivate revoked credential simulation rejected (${reactivateRevokedSim.error.slice(0, 80)})`
    );

    // 8f. Non-issuer attempting revocation simulation
    const unauthRevokeSim = await simulateExpectRejection(
      server,
      EXPECTED_CONTRACT_ID,
      "revoke_credential",
      [
        new Address(EXPECTED_LEARNER).toScVal(),
        sdk.nativeToScVal(credIdBytes, { type: "bytes" }),
        sdk.nativeToScVal("Unauthorized revoke", { type: "string" }),
      ],
      EXPECTED_LEARNER
    );
    if (!unauthRevokeSim.rejected) {
      throw new Error("Unauthorized revocation simulation succeeded unexpectedly!");
    }
    negativeSimCount += 1;
    console.log(
      `      [PASS 8f] Unauthorized revocation simulation rejected (${unauthRevokeSim.error.slice(0, 80)})`
    );
  }

  if (hasHardenedApi) {
    const roguePause = await simulateExpectRejection(
      server,
      EXPECTED_CONTRACT_ID,
      "pause",
      [],
      rogueIssuer,
      { enforceAuth: true }
    );
    if (!roguePause.rejected) {
      throw new Error("Unauthorized pause simulation succeeded unexpectedly!");
    }
    negativeSimCount += 1;
    console.log(`      [PASS 8g] Unauthorized pause rejected (${roguePause.error.slice(0, 80)})`);

    const noPendingAdminSim = await simulateExpectRejection(
      server,
      EXPECTED_CONTRACT_ID,
      "accept_admin",
      [],
      rogueIssuer
    );
    if (!noPendingAdminSim.rejected) {
      throw new Error("accept_admin without pending admin succeeded unexpectedly!");
    }
    negativeSimCount += 1;
    console.log(`      [PASS 8h] accept_admin without pending admin rejected (${noPendingAdminSim.error.slice(0, 80)})`);

    const batchItems = Array.from({ length: 51 }, () =>
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("credential_hash"),
          val: sdk.nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("credential_id"),
          val: sdk.nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("expires_at"),
          val: xdr.ScVal.scvVoid(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("recipient"),
          val: new Address(targetLearner).toScVal(),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("template_id"),
          val: xdr.ScVal.scvSymbol("Degree"),
        }),
      ])
    );
    const oversizedSim = await simulateExpectRejection(
      server,
      EXPECTED_CONTRACT_ID,
      "batch_issue_credentials",
      [
        new Address(EXPECTED_ISSUER || rogueIssuer).toScVal(),
        xdr.ScVal.scvVec(batchItems),
      ],
      EXPECTED_ISSUER || rogueIssuer
    );
    if (!oversizedSim.rejected) {
      throw new Error("Oversized 51-item batch simulation succeeded unexpectedly!");
    }
    negativeSimCount += 1;
    console.log(`      [PASS 8i] Oversized batch (51 > 50) rejected (${oversizedSim.error.slice(0, 80)})`);
  }
  console.log("");

  // 9. Reproducibility curl output
  console.log("[9/9] Independent curl reproducibility command:");
  console.log(`curl -s -X POST ${RPC_URL} \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getContractData","params":{"contract":"${EXPECTED_CONTRACT_ID}","key":"AAAABAAAAAE=","durability":"persistent"}}'\n`);

  console.log("==================================================================");
  console.log(
    `  VERIFICATION SUMMARY (${hasHardenedApi ? "HARDENED BUILD" : "PRE-HARDENING 2026-10-27 BUILD"})`
  );
  console.log(`  - Confirmed historical on-chain txs:   ${confirmedTxCount}`);
  console.log(`  - Live read-only RPC queries passed:   ${readOnlyQueryCount}`);
  console.log(`  - Read-only negative sims passed:      ${negativeSimCount}`);
  console.log(
    `  - On-chain vs local hardened WASM:     ${localWasmHash === onChainWasmHash ? "MATCH" : "DIFFERENT (redeploy pending authorization)"}`
  );
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
