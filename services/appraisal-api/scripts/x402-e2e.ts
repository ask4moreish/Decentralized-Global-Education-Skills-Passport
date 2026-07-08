// Live x402 e2e on testnet.
//
// Starts the appraisal API in-process (self-facilitating over real Soroban RPC),
// then an agent calls it: the first call returns HTTP 402, the agent signs a
// USDC (SEP-41) auth entry and retries, the server settles the transfer on-chain
// and returns the appraisal. We assert the agent was charged exactly the price,
// the resource server received exactly the price, the settlement carries a real
// transaction hash, and the appraisal equals the deterministic model output.

import { AddressInfo } from "node:net";

import {
  Account,
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";

import { appraise, parseAppraisalRequest } from "../src/appraisal.js";
import { buildAppraisalServer } from "../src/server.js";
import { createPaidFetch } from "../src/client.js";

const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK = process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const X402_NETWORK = process.env.X402_NETWORK ?? "stellar:testnet";

const reqEnv = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env var ${n}`);
  return v;
};
const fail = (m: string): never => {
  throw new Error(`x402 e2e assertion failed: ${m}`);
};
const usdc = (stroops: bigint) => (Number(stroops) / 1e7).toFixed(7);

async function main() {
  const facilitatorSecret = reqEnv("FACILITATOR_SECRET");
  const clientSecret = reqEnv("CLIENT_SECRET");
  const serverSecret = reqEnv("SERVER_SECRET");
  const usdcSac = reqEnv("USDC_SAC");
  const price = Number(process.env.PRICE ?? "0.10");

  const clientPub = Keypair.fromSecret(clientSecret).publicKey();
  const serverPub = Keypair.fromSecret(serverSecret).publicKey();
  console.log("· payer (agent):", clientPub);
  console.log("· resource server:", serverPub);
  console.log("· facilitator:", Keypair.fromSecret(facilitatorSecret).publicKey());
  console.log("· token:", usdcSac, "price:", price, "USDC/call");

  // USDC balance reader (read-only SAC `balance(id)` simulation).
  const server = new rpc.Server(RPC_URL);
  const sac = new Contract(usdcSac);
  const balanceOf = async (addr: string): Promise<bigint> => {
    const src = new Account(clientPub, "0");
    const tx = new TransactionBuilder(src, { fee: "100", networkPassphrase: NETWORK })
      .addOperation(sac.call("balance", new Address(addr).toScVal()))
      .setTimeout(30)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`balance sim failed: ${sim.error}`);
    return sim.result ? (scValToNative(sim.result.retval) as bigint) : 0n;
  };

  // ── 1. Start the x402-gated appraisal API in-process ───────────────────
  console.log("\n[1/5] starting appraisal API (self-facilitating on testnet)…");
  const api = await buildAppraisalServer({
    facilitatorSecret,
    payTo: serverPub,
    asset: usdcSac,
    price,
    network: X402_NETWORK as `${string}:${string}`,
    rpcUrl: RPC_URL,
    port: 0,
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", () => resolve()));
  const port = (api.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/appraise`;
  console.log("    ✔ listening on", url);

  try {
    const item = {
      itemRef: "skills-passport://rfp/spectrum-block-7",
      basePrice: 500,
      category: "spectrum",
      attributes: { quality: 82, demand: 74, scarcity: 91, risk: 18 },
    };

    // ── 2. Unpaid call must be rejected with 402 ─────────────────────────
    console.log("\n[2/5] unpaid call → expect HTTP 402…");
    const unpaid = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item),
    });
    if (unpaid.status !== 402) fail(`expected 402, got ${unpaid.status}`);
    const offer = await unpaid.json();
    console.log("    ✔ 402 with accepts:", JSON.stringify(offer.accepts ?? offer));

    // ── 3. Record balances, then pay ─────────────────────────────────────
    const before = { client: await balanceOf(clientPub), server: await balanceOf(serverPub) };
    console.log("\n[3/5] initial USDC:", { agent: usdc(before.client), server: usdc(before.server) });

    console.log("\n[4/5] paid call → sign auth entry, settle on-chain, get appraisal…");
    const paidFetch = createPaidFetch({ secret: clientSecret, network: X402_NETWORK as `${string}:${string}`, rpcUrl: RPC_URL });
    const result = await paidFetch<{ appraisal: ReturnType<typeof appraise>; payment: { transaction: string; payer: string } }>(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item),
      },
    );
    if (result.status !== 200) fail(`paid call status ${result.status}`);
    const settlement = result.settlement;
    if (!settlement || !settlement.success) {
      throw new Error(`x402 e2e: settlement not successful: ${JSON.stringify(settlement)}`);
    }
    if (!settlement.transaction) fail("settlement missing transaction hash");
    console.log("    ✔ settled on-chain, tx:", settlement.transaction);
    console.log("    ✔ payer:", settlement.payer);

    // Appraisal must equal the deterministic model output for these inputs.
    const expected = appraise(parseAppraisalRequest(item));
    if (JSON.stringify(result.body.appraisal) !== JSON.stringify(expected)) {
      fail(`appraisal mismatch:\n got ${JSON.stringify(result.body.appraisal)}\n exp ${JSON.stringify(expected)}`);
    }
    console.log("    ✔ appraisal matches model: fairValue", expected.fairValue, "suggestedMaxBid", expected.suggestedMaxBid);

    // ── 5. Balance checks — exact price moved agent → server ─────────────
    console.log("\n[5/5] verifying on-chain transfer…");
    const after = { client: await balanceOf(clientPub), server: await balanceOf(serverPub) };
    console.log("    final USDC:", { agent: usdc(after.client), server: usdc(after.server) });
    const priceStroops = BigInt(Math.round(price * 1e7));
    if (before.client - after.client !== priceStroops) {
      fail(`agent debit ${before.client - after.client} != price ${priceStroops}`);
    }
    if (after.server - before.server !== priceStroops) {
      fail(`server credit ${after.server - before.server} != price ${priceStroops}`);
    }
    console.log(`    ✔ exactly ${price} USDC moved agent → resource server on-chain`);

    console.log("\n✅ x402 E2E PASSED — 402 → signed USDC payment → on-chain settle → appraisal.");
  } finally {
    await new Promise<void>((resolve) => api.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error("\n❌ x402 E2E FAILED");
  console.error(err);
  process.exit(1);
});
