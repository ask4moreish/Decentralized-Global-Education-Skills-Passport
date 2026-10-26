#!/usr/bin/env node
/**
 * CLI Verification Tool for Decentralized Global Education & Skills Passport
 * 
 * Usage:
 *   node scripts/verify-credential.mjs <path-to-credential.json>
 *   node scripts/verify-credential.mjs --demo
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeCredentialHash,
  createVerifiableCredential,
  verifyEducationCredential,
} from "../packages/sdk/src/index.js";

function printBanner() {
  console.log("==================================================================");
  console.log("  Decentralized Global Education & Skills Passport Verifier");
  console.log("  Zero-Knowledge / Off-Chain PII + Soroban Cryptographic Registry");
  console.log("==================================================================\n");
}

function verifyFromFile(filePath) {
  const fullPath = resolve(process.cwd(), filePath);
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

  return runVerification(vc);
}

function runVerification(vc, onChainRecord = null) {
  const diag = verifyEducationCredential(vc, onChainRecord);

  console.log("Credential Metadata:");
  console.log(`  ID:          ${vc.id || "N/A"}`);
  console.log(`  Type:        ${Array.isArray(vc.type) ? vc.type.join(", ") : vc.type}`);
  console.log(`  Issuer:      ${vc.issuer?.name || "Unknown"} (${vc.issuer?.id || "N/A"})`);
  console.log(`  Recipient:   ${vc.credentialSubject?.name || "Anonymous"} (${vc.credentialSubject?.id || "N/A"})`);
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
  console.log(`  Hash Proof:  ${vc.proof?.credentialHash || "None"}\n`);

  console.log("Verification Diagnostics:");
  console.log(`  Canonical Hash Matched: ${diag.evidence.hashMatched ? "YES" : "NO"}`);
  console.log(`  Computed Hash:          ${diag.calculatedHash}`);
  console.log(`  Claimed Hash:           ${diag.claimedHash}`);
  console.log(`  Issuer Authorized:      ${diag.evidence.issuerAuthorized ? "YES" : "NO / UNKNOWN"}`);
  console.log(`  Status:                 ${diag.status.toUpperCase()}`);
  console.log(`  Result:                 ${diag.isValid ? "[PASS] VALID CREDENTIAL" : "[FAIL] INVALID / UNTRUSTED"}\n`);

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
      address: "GBZXN7PIRZGNMHGA728DJNVH3189031ZXCBNM91048NZX891048NZ104",
      name: "Elena Rostova",
    },
    title: "Bachelor of Science in Computer Science & Distributed Systems",
    institution: "Massachusetts Institute of Technology",
    skills: ["Algorithms", "Distributed Systems", "Rust", "Network Protocols", "Applied Cryptography"],
    grade: "Summa Cum Laude (GPA 4.0)",
    achievementDescription: "Conferred with highest departmental honors.",
    contractId: "CDSPASSPORTREGISTRY2026STELLARGLOBALTESTNETKEY",
  });

  const simulatedOnChain = {
    credentialId: "01".repeat(32),
    issuer: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
    recipient: "GBZXN7PIRZGNMHGA728DJNVH3189031ZXCBNM91048NZX891048NZ104",
    credentialHash: demoVc.proof.credentialHash,
    templateId: "Degree",
    issuedAt: Math.floor(Date.now() / 1000) - 86400,
    status: "Active",
    issuerAuthorized: true,
  };

  return runVerification(demoVc, simulatedOnChain);
}

// Main execution
printBanner();
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--demo") {
  const code = runDemo();
  process.exit(code);
} else {
  const code = verifyFromFile(args[0]);
  process.exit(code);
}
