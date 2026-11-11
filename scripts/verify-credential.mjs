#!/usr/bin/env node
/**
 * CLI Verification Tool for Decentralized Global Education & Skills Passport
 *
 * Usage:
 *   pnpm passport:verify --demo
 *   pnpm passport:verify <path-to-credential.json> [--testnet] [--contract-id <C...>]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EducationPassportClient,
  createVerifiableCredential,
  credentialIdToBytes32Hex,
  validateVerifiableCredentialStructure,
  verifyEducationCredential,
} from "../packages/sdk/src/index.js";

const DEFAULT_CONTRACT_ID = "CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5";
const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";

function printBanner() {
  console.log("==================================================================");
  console.log("  Decentralized Global Education & Skills Passport Verifier");
  console.log("  W3C VC Data Model / Salted Commitments + Soroban Ledger Registry");
  console.log("==================================================================\n");
}

function parseCliArgs(argv) {
  const flags = {
    demo: false,
    testnet: false,
    strictW3c: false,
    contractId: DEFAULT_CONTRACT_ID,
    rpcUrl: DEFAULT_RPC_URL,
    filePath: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--demo") flags.demo = true;
    else if (arg === "--testnet") flags.testnet = true;
    else if (arg === "--strict-w3c") flags.strictW3c = true;
    else if (arg === "--contract-id" && argv[i + 1]) flags.contractId = argv[++i];
    else if (arg === "--rpc-url" && argv[i + 1]) flags.rpcUrl = argv[++i];
    else if (!arg.startsWith("-")) flags.filePath = arg;
  }
  return flags;
}

async function verifyFromFile(flags) {
  const fullPath = resolve(process.cwd(), flags.filePath);
  console.log(`Verifying Credential: ${fullPath}\n`);

  let rawJson;
  try {
    rawJson = readFileSync(fullPath, "utf-8");
  } catch (err) {
    console.error(`[-] Error: Could not read file: ${err.message}`);
    process.exit(1);
  }

  let vc;
  try {
    vc = JSON.parse(rawJson);
  } catch (err) {
    console.error(`[-] Error: File does not contain valid JSON: ${err.message}`);
    process.exit(1);
  }

  let onChainRecord = undefined;
  if (flags.testnet) {
    const targetContract = vc.proof?.contractId || flags.contractId;
    const credIdHex = credentialIdToBytes32Hex(vc.id);
    console.log(`Querying live Soroban Testnet RPC (${flags.rpcUrl}) contract ${targetContract}...`);
    const client = new EducationPassportClient({
      contractId: targetContract,
      rpcUrl: flags.rpcUrl,
    });
    onChainRecord = await client.fetchOnChainRecord(credIdHex);
  }

  return runVerification(vc, onChainRecord, {
    strictW3cSchema: flags.strictW3c,
  });
}

function runVerification(vc, onChainRecord = undefined, options = {}) {
  const schema = validateVerifiableCredentialStructure(vc);
  const diag = verifyEducationCredential(vc, onChainRecord, undefined, options);

  const proofs = Array.isArray(vc.proof) ? vc.proof : [vc.proof].filter(Boolean);
  const primaryHash =
    proofs.find((p) => typeof p?.credentialHash === "string")?.credentialHash || "None";

  console.log("Credential Metadata:");
  console.log(`  ID:          ${vc.id || "N/A"}`);
  console.log(`  Type:        ${Array.isArray(vc.type) ? vc.type.join(", ") : vc.type}`);
  console.log(`  Issuer:      ${vc.issuer?.name || "Unknown"} (${vc.issuer?.id || "N/A"})`);
  console.log(
    `  Recipient:   ${vc.credentialSubject?.recipientName || vc.credentialSubject?.name || "Anonymous"} (${vc.credentialSubject?.id || "N/A"})`
  );
  console.log(`  Title:       ${vc.credentialSubject?.title || "N/A"}`);
  console.log(`  Institution: ${vc.credentialSubject?.institution || "N/A"}`);
  if (vc.credentialSubject?.skills?.length) {
    console.log(`  Skills:      ${vc.credentialSubject.skills.join(", ")}`);
  }
  if (vc.credentialSubject?.grade) {
    console.log(`  Grade:       ${vc.credentialSubject.grade}`);
  }
  console.log(`  Issued At:   ${vc.issuanceDate || "N/A"}`);
  console.log(`  Expires At:  ${vc.expirationDate || "Never"}`);
  console.log(`  Hash Proof:  ${primaryHash}\n`);

  console.log("Verification Diagnostics:");
  console.log(`  W3C VC DM v1.1 Valid:   ${schema.valid ? "YES" : "NO"}`);
  console.log(`  Canonical Hash Matched: ${diag.evidence.hashMatched ? "YES" : "NO"}`);
  if (diag.evidence.dataIntegrityVerified !== undefined) {
    console.log(
      `  Data Integrity Signature:${diag.evidence.dataIntegrityVerified ? " YES (eddsa-jcs-2022)" : " NO"}`
    );
  }
  console.log(`  Computed Hash:          ${diag.calculatedHash}`);
  console.log(`  Claimed Hash:           ${diag.claimedHash}`);
  console.log(`  Issuer Authorized:      ${diag.evidence.issuerAuthorized ? "YES" : "NO / UNKNOWN"}`);
  console.log(`  Status:                 ${diag.status.toUpperCase()}`);
  console.log(
    `  Result:                 ${diag.isValid ? "[PASS] VALID CREDENTIAL" : "[FAIL] INVALID / UNTRUSTED"}\n`
  );

  if (diag.warnings?.length) {
    console.log("Warnings:");
    for (const w of diag.warnings) {
      console.log(`  [!] ${w}`);
    }
    console.log();
  }

  if (diag.errors.length > 0) {
    console.log("Defects & Issues Detected:");
    for (const err of diag.errors) {
      console.log(`  [-] ${err}`);
    }
    console.log();
  }

  return diag.isValid ? 0 : 2;
}

function runDemo() {
  console.log("[*] Generating demonstration verifiable credential...\n");
  const demoVc = createVerifiableCredential({
    credentialType: "DegreeCredential",
    issuer: {
      address: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      name: "MIT Digital Credentials Institute",
      url: "https://mit.edu/credentials",
    },
    recipient: {
      address: "GDFJHLAXAUMHA4OWPOB4P7YO72AQR2HMIUYFOXLXE2DZGM633K7HZDQP",
      name: "Elena Rostova",
    },
    title: "Bachelor of Science in Computer Science & Distributed Systems",
    institution: "Massachusetts Institute of Technology",
    skills: ["Algorithms", "Distributed Systems", "Rust", "Network Protocols", "Applied Cryptography"],
    grade: "Summa Cum Laude (GPA 4.0)",
    achievementDescription: "Conferred with highest departmental honors.",
    contractId: DEFAULT_CONTRACT_ID,
    selectiveDisclosure: true,
  });

  const simulatedOnChain = {
    credentialId: credentialIdToBytes32Hex(demoVc.id),
    issuer: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
    recipient: "GDFJHLAXAUMHA4OWPOB4P7YO72AQR2HMIUYFOXLXE2DZGM633K7HZDQP",
    credentialHash: demoVc.proof.credentialHash,
    templateId: "Degree",
    issuedAt: Math.floor(Date.now() / 1000) - 86400,
    status: "Active",
    issuerAuthorized: true,
  };

  return runVerification(demoVc, simulatedOnChain, {
    strictCredentialIdMatch: true,
    strictW3cSchema: true,
  });
}

// Main execution
printBanner();
const flags = parseCliArgs(process.argv.slice(2));

if (flags.demo || !flags.filePath) {
  const code = runDemo();
  process.exit(code);
} else {
  verifyFromFile(flags)
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error("[-] Verification error:", err);
      process.exit(1);
    });
}
