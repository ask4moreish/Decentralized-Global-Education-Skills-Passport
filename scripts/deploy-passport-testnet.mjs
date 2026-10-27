#!/usr/bin/env node
/**
 * Deploy Decentralized Global Education & Skills Passport Contract to Stellar Testnet.
 * 
 * Flow:
 * 1. Provision / fund admin keypair on Testnet.
 * 2. Upload skills_passport_core.wasm bytecode to Soroban RPC.
 * 3. Deploy custom contract instance.
 * 4. Call initialize(admin) to set contract administration.
 * 5. Verify contract state (get_admin query).
 * 6. Register a demo accredited issuer for immediate verification testing.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sdk from "../packages/sdk/node_modules/@stellar/stellar-sdk/lib/index.js";

const { Keypair, Address, Operation, TransactionBuilder, Networks, rpc, scValToNative, nativeToScVal } = sdk;

const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
const WASM_PATH = resolve("target/wasm32v1-none/release/skills_passport_core.wasm");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTx(server, hash, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await server.getTransaction(hash);
    if (res.status === "SUCCESS") {
      return res;
    }
    if (res.status === "FAILED") {
      throw new Error(`Transaction failed: ${JSON.stringify(res.resultXdr)}`);
    }
    await sleep(2000);
  }
  throw new Error(`Transaction ${hash} timed out waiting for inclusion`);
}

async function main() {
  console.log("==================================================================");
  console.log("  Decentralized Global Education & Skills Passport Deployment");
  console.log("  Target Network: Stellar Soroban Testnet");
  console.log("==================================================================\n");

  const server = new rpc.Server(RPC_URL);

  // 1. Provision Keypair
  let keypair;
  if (process.env.OPERATOR_SECRET) {
    keypair = Keypair.fromSecret(process.env.OPERATOR_SECRET);
    console.log(`[1/5] Using provided operator secret: ${keypair.publicKey()}`);
  } else {
    keypair = Keypair.random();
    console.log(`[1/5] Generated fresh operator/admin keypair: ${keypair.publicKey()}`);
    console.log("      Funding account via Friendbot...");
    const friendbotRes = await fetch(`https://friendbot.stellar.org/?addr=${keypair.publicKey()}`);
    if (!friendbotRes.ok) {
      throw new Error(`Friendbot failed: ${friendbotRes.statusText}`);
    }
    console.log("      Account successfully funded with testnet XLM.");
  }

  // 2. Read WASM bytecode
  const wasm = readFileSync(WASM_PATH);
  console.log(`\n[2/5] Read contract WASM: ${WASM_PATH} (${wasm.length} bytes)`);

  // 3. Upload WASM
  console.log("\n[3/5] Uploading WASM bytecode to Stellar Testnet...");
  let account = await server.getAccount(keypair.publicKey());
  const uploadTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(60)
    .build();

  const preparedUpload = await server.prepareTransaction(uploadTx);
  preparedUpload.sign(keypair);
  const uploadSend = await server.sendTransaction(preparedUpload);
  console.log(`      Upload submitted (tx: ${uploadSend.hash})`);
  const uploadReceipt = await waitForTx(server, uploadSend.hash);
  const wasmHashBuffer = uploadReceipt.returnValue.bytes();
  const wasmHash = wasmHashBuffer.toString("hex");
  console.log(`      WASM installed! Code Hash: ${wasmHash}`);

  // 4. Deploy Contract Instance
  console.log("\n[4/5] Deploying contract instance...");
  account = await server.getAccount(keypair.publicKey());
  const deployOp = Operation.createCustomContract({
    address: new Address(keypair.publicKey()),
    wasmHash: wasmHashBuffer,
  });

  const deployTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(deployOp)
    .setTimeout(60)
    .build();

  const preparedDeploy = await server.prepareTransaction(deployTx);
  preparedDeploy.sign(keypair);
  const deploySend = await server.sendTransaction(preparedDeploy);
  console.log(`      Deploy submitted (tx: ${deploySend.hash})`);
  const deployReceipt = await waitForTx(server, deploySend.hash);
  const contractId = Address.fromScAddress(deployReceipt.returnValue.address()).toString();
  console.log(`      Contract deployed! Contract ID: ${contractId}`);
  console.log(`      Stellar Expert: https://stellar.expert/explorer/testnet/contract/${contractId}`);

  // 5. Initialize Contract with Admin
  console.log("\n[5/5] Initializing contract with admin address...");
  account = await server.getAccount(keypair.publicKey());
  const initTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "initialize",
        args: [new Address(keypair.publicKey()).toScVal()],
      })
    )
    .setTimeout(60)
    .build();

  const preparedInit = await server.prepareTransaction(initTx);
  preparedInit.sign(keypair);
  const initSend = await server.sendTransaction(preparedInit);
  console.log(`      Initialize submitted (tx: ${initSend.hash})`);
  await waitForTx(server, initSend.hash);
  console.log("      Contract successfully initialized!");

  // 6. Verify Contract via Read Query (get_admin)
  console.log("\n[+] Verifying deployment: querying get_admin...");
  account = await server.getAccount(keypair.publicKey());
  const queryTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "get_admin",
        args: [],
      })
    )
    .setTimeout(60)
    .build();

  const simResult = await server.simulateTransaction(queryTx);
  const verifiedAdmin = Address.fromScVal(simResult.result.retval).toString();
  console.log(`    On-chain verified admin: ${verifiedAdmin}`);
  if (verifiedAdmin !== keypair.publicKey()) {
    throw new Error(`Admin mismatch: expected ${keypair.publicKey()}, got ${verifiedAdmin}`);
  }

  // 7. Save Deployment Summary
  const deploymentSummary = {
    contractId,
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    wasmHash,
    adminPublicKey: keypair.publicKey(),
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://stellar.expert/explorer/testnet/contract/${contractId}`,
  };

  writeFileSync("contracts/passport/deployed-testnet.json", JSON.stringify(deploymentSummary, null, 2));
  console.log("\n==================================================================");
  console.log("  DEPLOYMENT COMPLETE & VERIFIED ON STELLAR TESTNET!");
  console.log("==================================================================");
  console.log(`Contract ID:       ${contractId}`);
  console.log(`WASM Hash:         ${wasmHash}`);
  console.log(`Admin Public Key:  ${keypair.publicKey()}`);
  console.log(`Explorer Link:     https://stellar.expert/explorer/testnet/contract/${contractId}`);
  console.log(`Artifact saved to: contracts/passport/deployed-testnet.json\n`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
