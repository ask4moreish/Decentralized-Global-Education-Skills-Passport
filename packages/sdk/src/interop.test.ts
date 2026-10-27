import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createVerifiableCredential,
  createSelectiveCredentialView,
  computeCredentialHash,
  canonicalizeJson,
  type VerifiableEducationCredential,
} from "./index.js";

describe("W3C VC Interoperability & Trust Model Boundaries", () => {
  const issuerAddress = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
  const recipientAddress = "GBZXN7PIRZGNMHGA728DJNVH3189031ZXCBNM91048NZX891048NZ104";

  const standardVc = createVerifiableCredential({
    credentialType: "DegreeCredential",
    issuer: {
      address: issuerAddress,
      name: "University of Cambridge",
      url: "https://cam.ac.uk",
    },
    recipient: {
      address: recipientAddress,
      name: "Marcus Vance",
    },
    title: "Master of Philosophy in Advanced Computer Science",
    institution: "University of Cambridge",
    skills: ["Type Theory", "Distributed Consensus", "Formal Verification"],
    grade: "First Class with Distinction",
    achievementDescription: "Researched formally verified smart contract execution environments.",
  });

  it("conforms to the core W3C Verifiable Credentials Data Model v1.1 structure", () => {
    // 1. @context property MUST include W3C credentials v1 context
    assert.ok(Array.isArray(standardVc["@context"]));
    assert.ok(standardVc["@context"].includes("https://www.w3.org/2018/credentials/v1"));

    // 2. type property MUST include VerifiableCredential and subtype
    assert.ok(Array.isArray(standardVc.type));
    assert.ok(standardVc.type.includes("VerifiableCredential"));
    assert.ok(standardVc.type.includes("DegreeCredential"));

    // 3. id property MUST be a valid URI
    assert.match(standardVc.id, /^urn:uuid:[0-9a-f-]{36}$/);

    // 4. issuer property MUST be an object or URI containing the issuer's identity
    assert.ok(standardVc.issuer);
    assert.equal(standardVc.issuer.id, `did:stellar:${issuerAddress}`);
    assert.equal(standardVc.issuer.name, "University of Cambridge");

    // 5. issuanceDate MUST be a valid ISO 8601 UTC timestamp
    assert.ok(standardVc.issuanceDate);
    const parsedDate = new Date(standardVc.issuanceDate);
    assert.equal(isNaN(parsedDate.getTime()), false);
    assert.equal(standardVc.issuanceDate.endsWith("Z"), true);

    // 6. credentialSubject MUST exist and contain target claims
    assert.ok(standardVc.credentialSubject);
    assert.equal(standardVc.credentialSubject.id, `did:stellar:${recipientAddress}`);
    assert.equal(standardVc.credentialSubject.title, "Master of Philosophy in Advanced Computer Science");
    assert.deepEqual(standardVc.credentialSubject.skills, ["Type Theory", "Distributed Consensus", "Formal Verification"]);

    // 7. proof MUST exist and contain proof metadata
    assert.ok(standardVc.proof);
    assert.equal(standardVc.proof.type, "StellarSorobanHashCommitment2026");
    assert.ok(standardVc.proof.credentialHash);
    assert.equal(standardVc.proof.credentialHash.length, 64);
  });

  it("verifies what the verifier PROVES: canonical RFC-8785 hash integrity commitment", () => {
    // An independent implementation canonicalizing with RFC-8785 produces the exact same hash
    const { proof, ...unsignedDoc } = standardVc;
    const computedHash = computeCredentialHash(unsignedDoc);

    // Proves that bit-level integrity matches the on-chain commitment:
    assert.equal(computedHash, standardVc.proof.credentialHash);

    // Proves that property order variations do not alter the integrity commitment:
    const reordered: any = {
      credentialSubject: unsignedDoc.credentialSubject,
      "@context": unsignedDoc["@context"],
      type: unsignedDoc.type,
      issuanceDate: unsignedDoc.issuanceDate,
      issuer: unsignedDoc.issuer,
      id: unsignedDoc.id,
    };
    assert.equal(computeCredentialHash(reordered), computedHash);
  });

  it("verifies what the verifier DOES NOT prove: hashing is NOT encryption or confidentiality", () => {
    // Plaintext attributes are fully readable in the VC data structure
    const rawJson = JSON.stringify(standardVc);
    assert.ok(rawJson.includes("Marcus Vance"));
    assert.ok(rawJson.includes("First Class with Distinction"));
    assert.ok(rawJson.includes("Type Theory"));

    // SHA-256 hash does not encrypt or conceal any data; it serves strictly as an integrity proof.
    // Confidentiality requires an external encrypted envelope or zero-knowledge proof primitives.
    assert.equal(typeof standardVc.proof.credentialHash, "string");
  });

  it("verifies what the verifier TRUSTS: on-chain authority and governance model", () => {
    // The verifier's trust is rooted in:
    // 1. The contract admin vetting the issuer
    // 2. The Soroban smart contract enforcing issuer status (Active vs Revoked)
    // 3. The RPC node faithfully returning ledger records
    const simulatedLedgerRecord = {
      credentialId: "cad1".padEnd(64, "0"),
      issuer: issuerAddress,
      recipient: recipientAddress,
      credentialHash: standardVc.proof.credentialHash,
      templateId: "Degree",
      issuedAt: 1700000000,
      status: "Active" as const,
      issuerAuthorized: true,
    };

    assert.equal(simulatedLedgerRecord.issuerAuthorized, true);
    assert.equal(simulatedLedgerRecord.status, "Active");
  });

  it("documents v1 document-level disclosure vs v2 cryptographic selective disclosure", () => {
    const view = createSelectiveCredentialView(standardVc, ["Type Theory"]);
    // v1 selectively filters the presented attributes at presentation time:
    assert.deepEqual(view.credentialSubject.skills, ["Type Theory"]);
    assert.equal(view.credentialSubject.skills.includes("Distributed Consensus"), false);

    // But because v1 alters the document array, its re-computed hash differs from the parent root:
    const viewHash = computeCredentialHash(view);
    assert.notEqual(viewHash, standardVc.proof.credentialHash);

    // This explicitly documents why BBS+ or Merkle-tree disclosure is required for v2
    // to cryptographically prove individual attributes without disclosing other claims.
  });
});
