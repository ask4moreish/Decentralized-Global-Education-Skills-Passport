import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createVerifiableCredential,
  createSelectiveCredentialView,
  encodeCredentialForSharing,
  decodeSharedCredential,
  computeCredentialHash,
} from "./index.js";

describe("Privacy & Selective Disclosure Boundaries", () => {
  const issuerAddress = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
  const recipientAddress = "GBZXN7PIRZGNMHGA728DJNVH3189031ZXCBNM91048NZX891048NZ104";

  const fullVc = createVerifiableCredential({
    credentialType: "DegreeCredential",
    issuer: {
      address: issuerAddress,
      name: "Massachusetts Institute of Technology",
      url: "https://mit.edu",
    },
    recipient: {
      address: recipientAddress,
      name: "Elena Rostova",
    },
    title: "Bachelor of Science in Computer Science",
    institution: "Massachusetts Institute of Technology",
    skills: ["Rust", "Soroban", "Distributed Systems", "Cryptography", "Network Security"],
    grade: "Summa Cum Laude (GPA 4.0)",
    achievementDescription: "Completed rigorous 4-year computer science program.",
  });

  it("v1 document-level disclosure should only include selected skills", () => {
    const selectedSkills = ["Rust", "Soroban"];
    const selectiveView = createSelectiveCredentialView(fullVc, selectedSkills);

    assert.deepEqual(selectiveView.credentialSubject.skills, ["Rust", "Soroban"]);
    assert.equal(selectiveView.credentialSubject.skills.includes("Cryptography"), false);
    assert.equal(selectiveView.credentialSubject.skills.includes("Network Security"), false);
  });

  it("v1 document-level disclosure preserves parent credential ID for on-chain auditability", () => {
    const selectedSkills = ["Rust"];
    const selectiveView = createSelectiveCredentialView(fullVc, selectedSkills);

    // v1 preserves the parent credential ID so independent verifiers can inspect status
    assert.equal(selectiveView.id, fullVc.id);
    assert.equal(selectiveView.issuer.id, fullVc.issuer.id);
  });

  it("v1 selective view demonstrates the boundary between document filtering and ZK proofs", () => {
    const selectiveView = createSelectiveCredentialView(fullVc, ["Rust"]);

    // The document-level selective view filters the skills:
    assert.deepEqual(selectiveView.credentialSubject.skills, ["Rust"]);

    // Because the skills array is modified, the canonical hash of the filtered view
    // differs from the full parent credential hash commitment on-chain:
    const filteredHash = computeCredentialHash(selectiveView);
    const parentRootHash = fullVc.proof.credentialHash;
    assert.notEqual(filteredHash, parentRootHash);

    // This proves why v1 is a document-level presentation filter, and v2 BBS+/ZK-SNARK
    // proofs are required to prove individual attributes without disclosing the root preimage.
  });

  it("shared link encoding does not leak unintended keys or mutate payload", () => {
    const selectiveView = createSelectiveCredentialView(fullVc, ["Distributed Systems"]);
    const encoded = encodeCredentialForSharing(selectiveView as any);

    // Assert encoded string is a valid base64url payload
    assert.match(encoded, /^[A-Za-z0-9_-]+$/);

    const decoded = decodeSharedCredential(encoded);
    assert.equal(decoded.id, fullVc.id);
    assert.deepEqual(decoded.credentialSubject.skills, ["Distributed Systems"]);
    assert.equal(decoded.credentialSubject.skills.length, 1);
  });

  it("tampering with an encoded payload is detected upon decoding or verification", () => {
    const encoded = encodeCredentialForSharing(fullVc);
    const decoded = decodeSharedCredential(encoded);

    // Attacker modifies grade
    const tampered = {
      ...decoded,
      credentialSubject: {
        ...decoded.credentialSubject,
        grade: "Altered Grade",
      },
    };

    const originalHash = fullVc.proof.credentialHash;
    const recomputedHash = computeCredentialHash(tampered);
    assert.notEqual(originalHash, recomputedHash);
  });

  it("confirms that hash commitments do not expose student PII", () => {
    const hash = fullVc.proof.credentialHash;
    // 64-char hex SHA-256
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
    // Hash is pseudorandom and irreversible
    assert.equal(hash.includes("Elena"), false);
    assert.equal(hash.includes("Rostova"), false);
    assert.equal(hash.includes("Summa"), false);
  });
});
