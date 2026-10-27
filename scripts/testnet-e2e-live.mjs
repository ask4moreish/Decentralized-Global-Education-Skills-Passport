#!/usr/bin/env node
/**
 * Live Stellar Testnet Education & Skills Passport Lifecycle Verification
 * 
 * Executes the complete real-world credential lifecycle against Stellar Testnet:
 * 1. Provisions / funds test admin, issuer, and learner keypairs via Friendbot.
 * 2. Uploads skills_passport_core.wasm and deploys contract instance.
 * 3. Initializes contract with admin authority.
 * 4. Admin registers and authorizes an educational institution (issuer).
 * 5. Authorized issuer registers a credential template schema.
 * 6. Issuer issues a cryptographic W3C Verifiable Credential on-chain.
 * 7. Verifier queries on-chain status and validates credential integrity and authorization.
 * 8. Issuer suspends the credential and verifier detects the suspension.
 * 9. Issuer reactivates the credential.
 * 10. Issuer revokes the credential with audit reason; verifier detects revocation.
 * 11. Records transaction hashes, contract ID, WASM hash, and verification diagnostics.
 */

import crypto from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sdk from "../packages/sdk/node_modules/@stellar/stellar-sdk/lib/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Keypair, Address, Operation, TransactionBuilder, Networks, rpc, nativeToScVal, xdr, scValToNative } = sdk;

const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
const WASM_PATH = resolve(__dirname, "../target/wasm32v1-none/release/skills_passport_core.wasm");

function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ":" + canonicalizeJson(obj[k]));
  return "{" + pairs.join(",") + "}";
}

function computeCredentialHash(unsigned) {
  const canonical = canonicalizeJson(unsigned);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fundAccount(keypair, label) {
  console.log(`[*] Funding ${label} (${keypair.publicKey()}) via Friendbot...`);
  const res = await fetch(`https://friendbot.stellar.org/?addr=${keypair.publicKey()}`);
  if (!res.ok) {
    throw new Error(`Friendbot failed for ${label}: ${res.statusText}`);
  }
  console.log(`    ${label} funded successfully.`);
}

async function waitForTx(server, hash, maxAttempts = 35) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await server.getTransaction(hash);
    if (res.status === "SUCCESS") {
      return res;
    }
    if (res.status === "FAILED") {
      throw new Error(`Transaction ${hash} failed: ${JSON.stringify(res.resultXdr)}`);
    }
    await sleep(2000);
  }
  throw new Error(`Transaction ${hash} timed out waiting for inclusion`);
}

async function sendOp(server, sourceKeypair, operation, signers = [sourceKeypair]) {
  const account = await server.getAccount(sourceKeypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(tx);
  for (const signer of signers) {
    prepared.sign(signer);
  }
  const sendRes = await server.sendTransaction(prepared);
  if (sendRes.status === "ERROR") {
    throw new Error(`Send transaction error: ${JSON.stringify(sendRes)}`);
  }
  const receipt = await waitForTx(server, sendRes.hash);
  return { hash: sendRes.hash, receipt };
}

async function main() {
  console.log("==================================================================");
  console.log("  Live Stellar Testnet Education & Skills Passport Verification");
  console.log(`  RPC:     ${RPC_URL}`);
  console.log(`  Network: ${NETWORK_PASSPHRASE}`);
  console.log("==================================================================\n");

  const server = new rpc.Server(RPC_URL);
  const evidence = {
    network: "testnet",
    rpcUrl: RPC_URL,
    steps: {},
  };

  // 1. Provision Keypairs
  console.log("--- STEP 1: PROVISIONING TESTNET KEYPAIRS ---");
  const adminKeypair = Keypair.random();
  const issuerKeypair = Keypair.random();
  const learnerKeypair = Keypair.random();

  await fundAccount(adminKeypair, "Admin");
  await fundAccount(issuerKeypair, "Issuer");
  evidence.admin = adminKeypair.publicKey();
  evidence.issuer = issuerKeypair.publicKey();
  evidence.learner = learnerKeypair.publicKey();

  // 2. Read Contract WASM
  console.log("\n--- STEP 2: WASM BYTECODE VERIFICATION ---");
  const wasm = readFileSync(WASM_PATH);
  const computedHash = crypto.createHash("sha256").update(wasm).digest();
  const wasmHash = computedHash.toString("hex");
  console.log(`Read contract WASM: ${WASM_PATH} (${wasm.length} bytes)`);
  console.log(`SHA-256 Code Hash: ${wasmHash}`);

  // Upload WASM
  let wasmHashBuffer = computedHash;
  try {
    const uploadRes = await sendOp(
      server,
      adminKeypair,
      Operation.uploadContractWasm({ wasm })
    );
    wasmHashBuffer = uploadRes.receipt.returnValue.bytes();
    console.log(`WASM uploaded! Code Hash: ${wasmHashBuffer.toString("hex")} (tx: ${uploadRes.hash})`);
    evidence.steps.uploadWasm = { hash: uploadRes.hash, wasmHash: wasmHashBuffer.toString("hex") };
  } catch (err) {
    console.log("WASM upload note (code already installed):", err.message);
    evidence.steps.uploadWasm = { wasmHash };
  }

  // 3. Deploy Contract Instance
  console.log("\n--- STEP 3: DEPLOY CONTRACT INSTANCE ---");
  const deployRes = await sendOp(
    server,
    adminKeypair,
    Operation.createCustomContract({
      address: new Address(adminKeypair.publicKey()),
      wasmHash: wasmHashBuffer,
    })
  );
  const contractId = Address.fromScAddress(deployRes.receipt.returnValue.address()).toString();
  console.log(`Contract deployed! Address: ${contractId}`);
  console.log(`Deploy tx: ${deployRes.hash}`);
  evidence.contractId = contractId;
  evidence.explorerUrl = `https://stellar.expert/explorer/testnet/contract/${contractId}`;
  evidence.steps.deploy = { contractId, tx: deployRes.hash };

  // 4. Initialize Contract
  console.log("\n--- STEP 4: INITIALIZE WITH ADMIN ---");
  const initRes = await sendOp(
    server,
    adminKeypair,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "initialize",
      args: [new Address(adminKeypair.publicKey()).toScVal()],
    })
  );
  console.log(`Contract initialized with admin (tx: ${initRes.hash})`);
  evidence.steps.initialize = { tx: initRes.hash };

  // Query get_admin to verify initialization
  const adminAccount = await server.getAccount(adminKeypair.publicKey());
  const getAdminTx = new TransactionBuilder(adminAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "get_admin",
        args: [],
      })
    )
    .setTimeout(30)
    .build();
  const simAdmin = await server.simulateTransaction(getAdminTx);
  const verifiedAdmin = Address.fromScVal(simAdmin.result.retval).toString();
  console.log(`Verified on-chain admin: ${verifiedAdmin}`);
  if (verifiedAdmin !== adminKeypair.publicKey()) {
    throw new Error(`Admin mismatch: expected ${adminKeypair.publicKey()}, got ${verifiedAdmin}`);
  }

  // 5. Register Authorized Issuer
  console.log("\n--- STEP 5: REGISTER AUTHORIZED ISSUER ---");
  const regIssuerRes = await sendOp(
    server,
    adminKeypair,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "register_issuer",
      args: [
        new Address(issuerKeypair.publicKey()).toScVal(),
        nativeToScVal("MIT Digital Credentials Institute", { type: "string" }),
        nativeToScVal("https://credentials.mit.edu", { type: "string" }),
      ],
    })
  );
  console.log(`Issuer registered & authorized on-chain (tx: ${regIssuerRes.hash})`);
  evidence.steps.registerIssuer = { tx: regIssuerRes.hash, issuer: issuerKeypair.publicKey() };

  // 6. Register Template Schema
  console.log("\n--- STEP 6: REGISTER CREDENTIAL TEMPLATE ---");
  const regTemplateRes = await sendOp(
    server,
    issuerKeypair,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "register_template",
      args: [
        new Address(issuerKeypair.publicKey()).toScVal(),
        xdr.ScVal.scvSymbol("Degree"),
        nativeToScVal("Bachelor of Science in Distributed Systems", { type: "string" }),
        nativeToScVal("https://schema.org/Degree", { type: "string" }),
      ],
    })
  );
  console.log(`Template 'Degree' registered on-chain (tx: ${regTemplateRes.hash})`);
  evidence.steps.registerTemplate = { tx: regTemplateRes.hash, template: "Degree" };

  // 7. Create and Issue Verifiable Credential
  console.log("\n--- STEP 7: CREATE & ISSUE VERIFIABLE CREDENTIAL ---");
  const unsignedVc = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/skills-passport/v1",
    ],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ["VerifiableCredential", "DegreeCredential"],
    issuer: {
      id: `did:stellar:${issuerKeypair.publicKey()}`,
      name: "MIT Digital Credentials Institute",
      url: "https://credentials.mit.edu",
    },
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: `did:stellar:${learnerKeypair.publicKey()}`,
      recipientAddress: learnerKeypair.publicKey(),
      recipientName: "Elena Rostova",
      title: "Bachelor of Science in Distributed Systems",
      institution: "MIT Digital Credentials Institute",
      skills: ["Rust", "Soroban", "Cryptography", "Consensus Algorithms"],
      grade: "Summa Cum Laude (GPA 4.0)",
      achievementDescription: "Graduated top of class with core contributions to Soroban ecosystem.",
    },
  };

  const credHashHex = computeCredentialHash(unsignedVc);
  const credHashBytes = Buffer.from(credHashHex, "hex");
  const credIdBytes = crypto.randomBytes(32);
  const credIdHex = credIdBytes.toString("hex");

  const issueRes = await sendOp(
    server,
    issuerKeypair,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "issue_credential",
      args: [
        new Address(issuerKeypair.publicKey()).toScVal(),
        new Address(learnerKeypair.publicKey()).toScVal(),
        nativeToScVal(credIdBytes, { type: "bytes" }),
        nativeToScVal(credHashBytes, { type: "bytes" }),
        xdr.ScVal.scvSymbol("Degree"),
        xdr.ScVal.scvVoid(), // no expiry
      ],
    })
  );
  console.log(`Credential issued on-chain! (tx: ${issueRes.hash})`);
  console.log(`  Credential ID:   ${credIdHex}`);
  console.log(`  Credential Hash: ${credHashHex}`);
  evidence.steps.issueCredential = {
    tx: issueRes.hash,
    credentialId: credIdHex,
    credentialHash: credHashHex,
  };

  // 8. Independent Verifier Query (Verify On-Chain Status)
  console.log("\n--- STEP 8: INDEPENDENT VERIFIER ON-CHAIN CHECK ---");
  const verifierAccount = await server.getAccount(adminKeypair.publicKey());
  const verifyTx = new TransactionBuilder(verifierAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "verify_credential",
        args: [
          nativeToScVal(credIdBytes, { type: "bytes" }),
          nativeToScVal(credHashBytes, { type: "bytes" }),
        ],
      })
    )
    .setTimeout(30)
    .build();

  const simVerify = await server.simulateTransaction(verifyTx);
  const verifyNative = scValToNative(simVerify.result.retval);
  console.log("On-chain verification result:", verifyNative);
  if (!verifyNative.is_valid || !verifyNative.hash_matches || !verifyNative.issuer_authorized) {
    throw new Error("On-chain verification failed unexpectedly!");
  }
  console.log("  [PASS] Credential integrity and issuer authorization VERIFIED on Testnet!");

  // 9. Suspend Credential
  console.log("\n--- STEP 9: SUSPEND CREDENTIAL ---");
  const suspendRes = await sendOp(
    server,
    issuerKeypair,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "suspend_credential",
      args: [
        new Address(issuerKeypair.publicKey()).toScVal(),
        nativeToScVal(credIdBytes, { type: "bytes" }),
        nativeToScVal("Temporary academic audit review", { type: "string" }),
      ],
    })
  );
  console.log(`Credential suspended on-chain (tx: ${suspendRes.hash})`);
  evidence.steps.suspendCredential = { tx: suspendRes.hash };

  // Query verify_credential after suspension
  const simVerifySuspended = await server.simulateTransaction(verifyTx);
  const suspendedResult = scValToNative(simVerifySuspended.result.retval);
  console.log("Verification status after suspension:", suspendedResult.status);
  if (suspendedResult.is_valid !== false) {
    throw new Error("Suspended credential should not be valid!");
  }
  console.log("  [PASS] Suspended credential correctly REJECTED on Testnet!");

  // 10. Reactivate Credential
  console.log("\n--- STEP 10: REACTIVATE CREDENTIAL ---");
  const reactivateRes = await sendOp(
    server,
    issuerKeypair,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "reactivate_credential",
      args: [
        new Address(issuerKeypair.publicKey()).toScVal(),
        nativeToScVal(credIdBytes, { type: "bytes" }),
      ],
    })
  );
  console.log(`Credential reactivated on-chain (tx: ${reactivateRes.hash})`);
  evidence.steps.reactivateCredential = { tx: reactivateRes.hash };

  // 11. Revoke Credential
  console.log("\n--- STEP 11: REVOKE CREDENTIAL ---");
  const revokeRes = await sendOp(
    server,
    issuerKeypair,
    Operation.invokeContractFunction({
      contract: contractId,
      function: "revoke_credential",
      args: [
        new Address(issuerKeypair.publicKey()).toScVal(),
        nativeToScVal(credIdBytes, { type: "bytes" }),
        nativeToScVal("Permanent credential revocation: academic misconduct", { type: "string" }),
      ],
    })
  );
  console.log(`Credential revoked on-chain (tx: ${revokeRes.hash})`);
  evidence.steps.revokeCredential = { tx: revokeRes.hash };

  // Query verify_credential after revocation
  const simVerifyRevoked = await server.simulateTransaction(verifyTx);
  const revokedResult = scValToNative(simVerifyRevoked.result.retval);
  console.log("Verification status after revocation:", revokedResult.status);
  if (revokedResult.is_valid !== false) {
    throw new Error("Revoked credential should not be valid!");
  }
  console.log("  [PASS] Revoked credential permanently REJECTED on Testnet!");

  // 12. Negative & Unauthorized Transaction Tests
  console.log("\n--- STEP 12: NEGATIVE & UNAUTHORIZED TRANSACTION REJECTION TESTS ---");
  evidence.steps.negativeTests = {};

  // 12a. Unauthorized issuer attempts to issue credential
  console.log("  [12a] Testing unauthorized issuer attempting issue_credential...");
  const learnerAccount = await server.getAccount(learnerKeypair.publicKey());
  const unauthIssueTx = new TransactionBuilder(learnerAccount, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "issue_credential",
        args: [
          new Address(learnerKeypair.publicKey()).toScVal(),
          new Address(learnerKeypair.publicKey()).toScVal(),
          nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
          nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
          xdr.ScVal.scvSymbol("Degree"),
          xdr.ScVal.scvVoid(),
        ],
      })
    )
    .setTimeout(30)
    .build();

  const simUnauth = await server.simulateTransaction(unauthIssueTx);
  const unauthRejected = Boolean(simUnauth.error || (simUnauth.result && simUnauth.result.error));
  if (!unauthRejected) {
    throw new Error("Security failure: Unauthorized issuer issuance was NOT rejected by contract!");
  }
  console.log("    [PASS] Unauthorized issuance rejected as expected.");
  evidence.steps.negativeTests.unauthorizedIssuanceRejected = true;

  // 12b. Duplicate credential ID issuance attempt
  console.log("  [12b] Testing duplicate credential ID issuance...");
  const issuerAccountForDup = await server.getAccount(issuerKeypair.publicKey());
  const dupIssueTx = new TransactionBuilder(issuerAccountForDup, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "issue_credential",
        args: [
          new Address(issuerKeypair.publicKey()).toScVal(),
          new Address(learnerKeypair.publicKey()).toScVal(),
          nativeToScVal(credIdBytes, { type: "bytes" }), // already used!
          nativeToScVal(crypto.randomBytes(32), { type: "bytes" }),
          xdr.ScVal.scvSymbol("Degree"),
          xdr.ScVal.scvVoid(),
        ],
      })
    )
    .setTimeout(30)
    .build();

  const simDup = await server.simulateTransaction(dupIssueTx);
  const dupRejected = Boolean(simDup.error || (simDup.result && simDup.result.error));
  if (!dupRejected) {
    throw new Error("Integrity failure: Duplicate credential ID was NOT rejected by contract!");
  }
  console.log("    [PASS] Duplicate credential ID rejected as expected.");
  evidence.steps.negativeTests.duplicateCredentialIdRejected = true;

  // 12c. Reactivating already revoked credential attempt
  console.log("  [12c] Testing reactivation of already revoked credential...");
  const issuerAccountForReactivate = await server.getAccount(issuerKeypair.publicKey());
  const reactivateRevokedTx = new TransactionBuilder(issuerAccountForReactivate, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "reactivate_credential",
        args: [
          new Address(issuerKeypair.publicKey()).toScVal(),
          nativeToScVal(credIdBytes, { type: "bytes" }),
        ],
      })
    )
    .setTimeout(30)
    .build();

  const simReactivateRevoked = await server.simulateTransaction(reactivateRevokedTx);
  const reactivateRevokedRejected = Boolean(simReactivateRevoked.error || (simReactivateRevoked.result && simReactivateRevoked.result.error));
  if (!reactivateRevokedRejected) {
    throw new Error("State transition failure: Reactivating revoked credential was NOT rejected!");
  }
  console.log("    [PASS] Reactivating revoked credential rejected as expected.");
  evidence.steps.negativeTests.reactivateRevokedRejected = true;

  // 12d. Unauthorized revocation attempt
  console.log("  [12d] Testing unauthorized revocation attempt...");
  const learnerAccountForRevoke = await server.getAccount(learnerKeypair.publicKey());
  const unauthRevokeTx = new TransactionBuilder(learnerAccountForRevoke, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "revoke_credential",
        args: [
          new Address(learnerKeypair.publicKey()).toScVal(), // learner is NOT the issuer!
          nativeToScVal(credIdBytes, { type: "bytes" }),
          nativeToScVal("Unauthorized revocation", { type: "string" }),
        ],
      })
    )
    .setTimeout(30)
    .build();

  const simUnauthRevoke = await server.simulateTransaction(unauthRevokeTx);
  const unauthRevokeRejected = Boolean(simUnauthRevoke.error || (simUnauthRevoke.result && simUnauthRevoke.result.error));
  if (!unauthRevokeRejected) {
    throw new Error("Authorization failure: Unauthorized revocation was NOT rejected!");
  }
  console.log("    [PASS] Unauthorized revocation rejected as expected.");
  evidence.steps.negativeTests.unauthorizedRevocationRejected = true;

  // Save evidence to contracts/passport/deployed-testnet.json
  const finalSummary = {
    contractId,
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    wasmHash,
    adminPublicKey: adminKeypair.publicKey(),
    issuerPublicKey: issuerKeypair.publicKey(),
    learnerPublicKey: learnerKeypair.publicKey(),
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://stellar.expert/explorer/testnet/contract/${contractId}`,
    evidence,
  };
  writeFileSync(resolve(__dirname, "../contracts/passport/deployed-testnet.json"), JSON.stringify(finalSummary, null, 2));

  console.log("\n==================================================================");
  console.log("  COMPLETE TESTNET CREDENTIAL LIFECYCLE VERIFIED!");
  console.log("==================================================================");
  console.log(`Contract ID:       ${contractId}`);
  console.log(`WASM Hash:         ${wasmHash}`);
  console.log(`Admin Address:     ${adminKeypair.publicKey()}`);
  console.log(`Issuer Address:    ${issuerKeypair.publicKey()}`);
  console.log(`Learner Address:   ${learnerKeypair.publicKey()}`);
  console.log(`Explorer Link:     https://stellar.expert/explorer/testnet/contract/${contractId}`);
  console.log(`Summary saved to:  contracts/passport/deployed-testnet.json\n`);
}

main().catch((err) => {
  console.error("Testnet lifecycle failed:", err);
  process.exit(1);
});
