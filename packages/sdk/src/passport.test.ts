import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";
import {
  canonicalizeJson,
  computeCredentialHash,
  createCredentialSharePackage,
  createSelectiveCredentialView,
  createVerifiableCredential,
  decodeSharedCredential,
  EducationPassportClient,
  encodeCredentialForSharing,
  hexToBytes32,
  verifyEducationCredential,
} from "./index.js";

describe("Education & Skills Passport SDK", () => {
  const issuerKeypair = Keypair.random();
  const recipientKeypair = Keypair.random();
  const issuerAddress = issuerKeypair.publicKey();
  const recipientAddress = recipientKeypair.publicKey();

  it("should create a valid W3C Verifiable Credential", () => {
    const vc = createVerifiableCredential({
      credentialType: "DegreeCredential",
      issuer: {
        address: issuerAddress,
        name: "Stellar University",
        url: "https://stellar.org/edu",
      },
      recipient: {
        address: recipientAddress,
        name: "Jane Doe",
      },
      title: "Bachelor of Science in Distributed Systems",
      institution: "Stellar University",
      skills: ["Rust", "Soroban", "Cryptography", "Smart Contracts"],
      grade: "Summa Cum Laude",
      achievementDescription:
        "Completed 4-year rigorous curriculum in distributed systems and blockchain engineering.",
    });

    assert.equal(vc.type[0], "VerifiableCredential");
    assert.equal(vc.type[1], "DegreeCredential");
    assert.equal(vc.issuer.id, `did:stellar:${issuerAddress}`);
    assert.equal(vc.credentialSubject.id, `did:stellar:${recipientAddress}`);
    assert.equal(vc.proof.type, "StellarSorobanHashCommitment2026");
    assert.equal(vc.proof.credentialHash.length, 64);
  });

  it("should canonically hash credentials regardless of key order", () => {
    const obj1 = { b: 2, a: 1, nested: { y: 20, x: 10 } };
    const obj2 = { nested: { x: 10, y: 20 }, a: 1, b: 2 };

    const canon1 = canonicalizeJson(obj1);
    const canon2 = canonicalizeJson(obj2);

    assert.equal(canon1, canon2);
    assert.equal(canon1, '{"a":1,"b":2,"nested":{"x":10,"y":20}}');
  });

  it("should encode and decode credential sharing packages", () => {
    const vc = createVerifiableCredential({
      credentialType: "CertificateCredential",
      issuer: {
        address: issuerAddress,
        name: "Global Tech Academy",
      },
      recipient: {
        address: recipientAddress,
        name: "Alex Smith",
      },
      title: "Soroban Smart Contract Developer",
      institution: "Global Tech Academy",
      skills: ["Rust", "Soroban"],
      achievementDescription: "Demonstrated production contract architecture.",
    });

    const sharePackage = createCredentialSharePackage(vc);
    assert.ok(sharePackage.verificationUrl);
    assert.ok(sharePackage.qrPayload);

    const encoded = encodeCredentialForSharing(vc);
    const decoded = decodeSharedCredential(encoded);

    assert.equal(decoded.id, vc.id);
    assert.equal(decoded.proof.credentialHash, vc.proof.credentialHash);
    assert.deepEqual(decoded.credentialSubject.skills, vc.credentialSubject.skills);
  });

  it("should support selective disclosure of skills without breaking structure", () => {
    const vc = createVerifiableCredential({
      credentialType: "SkillBadgeCredential",
      issuer: {
        address: issuerAddress,
        name: "Global Skills Authority",
      },
      recipient: {
        address: recipientAddress,
      },
      title: "Senior Full Stack Blockchain Engineer",
      institution: "Global Skills Authority",
      skills: ["Rust", "TypeScript", "Solidity", "Go", "Docker"],
      achievementDescription: "Verified senior polyglot competencies.",
    });

    const filtered = createSelectiveCredentialView(vc, ["Rust", "TypeScript"]);
    assert.deepEqual(filtered.credentialSubject.skills, ["Rust", "TypeScript"]);
  });

  it("should verify a pristine credential successfully", () => {
    const vc = createVerifiableCredential({
      credentialType: "CourseCompletionCredential",
      issuer: {
        address: issuerAddress,
        name: "Open Education Consortium",
      },
      recipient: {
        address: recipientAddress,
      },
      title: "Cryptography in Practice",
      institution: "Open Education Consortium",
      skills: ["BLS12-381", "SHA-256", "Zero-Knowledge"],
      achievementDescription: "Applied cryptographic primitives in Web3 systems.",
    });

    const onChainRecord = {
      credentialId: "a".repeat(64),
      issuer: issuerAddress,
      recipient: recipientAddress,
      credentialHash: vc.proof.credentialHash,
      templateId: "CourseCompletion",
      issuedAt: Math.floor(Date.now() / 1000) - 100,
      status: "Active" as const,
      issuerAuthorized: true,
    };

    const diag = verifyEducationCredential(vc, onChainRecord);
    assert.equal(diag.isValid, true);
    assert.equal(diag.status, "valid");
    assert.equal(diag.tampered, false);
    assert.equal(diag.expired, false);
    assert.equal(diag.revoked, false);
    assert.equal(diag.evidence.hashMatched, true);
    assert.equal(diag.evidence.issuerAuthorized, true);
  });

  it("should detect tampered credentials where title or grade was modified", () => {
    const vc = createVerifiableCredential({
      credentialType: "DegreeCredential",
      issuer: {
        address: issuerAddress,
        name: "Harvard University",
      },
      recipient: {
        address: recipientAddress,
      },
      title: "Bachelor of Arts in Economics",
      institution: "Harvard University",
      skills: ["Microeconomics"],
      grade: "3.5 GPA",
      achievementDescription: "Degree conferred.",
    });

    // Malicious attacker attempts to change title to "Master of Science in Computer Science"
    const tamperedVc = {
      ...vc,
      credentialSubject: {
        ...vc.credentialSubject,
        title: "Master of Science in Computer Science",
      },
    };

    const diag = verifyEducationCredential(tamperedVc);
    assert.equal(diag.isValid, false);
    assert.equal(diag.tampered, true);
    assert.equal(diag.status, "tampered");
    assert.ok(diag.errors.some((e) => e.includes("hash mismatch")));
  });

  it("should detect on-chain revoked credentials", () => {
    const vc = createVerifiableCredential({
      credentialType: "CertificateCredential",
      issuer: {
        address: issuerAddress,
        name: "Accreditation Board",
      },
      recipient: {
        address: recipientAddress,
      },
      title: "Certified Public Accountant",
      institution: "Accreditation Board",
      skills: ["Audit"],
      achievementDescription: "Certification.",
    });

    const revokedOnChain = {
      credentialId: "b".repeat(64),
      issuer: issuerAddress,
      recipient: recipientAddress,
      credentialHash: vc.proof.credentialHash,
      templateId: "Certificate",
      issuedAt: 1000,
      status: "Revoked" as const,
      revocationReason: "License suspended for ethical violation",
      issuerAuthorized: true,
    };

    const diag = verifyEducationCredential(vc, revokedOnChain);
    assert.equal(diag.isValid, false);
    assert.equal(diag.revoked, true);
    assert.equal(diag.status, "revoked");
    assert.ok(diag.errors.some((e) => e.includes("revoked on-chain")));
  });

  it("should detect expired credentials based on timestamp", () => {
    const pastDate = new Date(Date.now() - 100000).toISOString();
    const vc = createVerifiableCredential({
      credentialType: "CertificateCredential",
      issuer: {
        address: issuerAddress,
        name: "Emergency Medical Authority",
      },
      recipient: {
        address: recipientAddress,
      },
      title: "CPR & First Aid Certification",
      institution: "Emergency Medical Authority",
      skills: ["CPR"],
      achievementDescription: "2-year certification.",
      expirationDate: pastDate,
    });

    const diag = verifyEducationCredential(vc);
    assert.equal(diag.isValid, false);
    assert.equal(diag.expired, true);
    assert.equal(diag.status, "expired");
  });

  it("should detect deauthorized or untrusted issuers", () => {
    const vc = createVerifiableCredential({
      credentialType: "DegreeCredential",
      issuer: {
        address: issuerAddress,
        name: "Unaccredited Institution",
      },
      recipient: {
        address: recipientAddress,
      },
      title: "Honorary Degree",
      institution: "Unaccredited Institution",
      skills: [],
      achievementDescription: "Issued.",
    });

    const unaccreditedOnChain = {
      credentialId: "c".repeat(64),
      issuer: issuerAddress,
      recipient: recipientAddress,
      credentialHash: vc.proof.credentialHash,
      templateId: "Degree",
      issuedAt: 1000,
      status: "Active" as const,
      issuerAuthorized: false, // Issuer was deauthorized!
    };

    const diag = verifyEducationCredential(vc, unaccreditedOnChain);
    assert.equal(diag.isValid, false);
    assert.equal(diag.untrustedIssuer, true);
    assert.equal(diag.status, "untrusted");
  });

  it("EducationPassportClient should generate valid invocation argument structures", () => {
    const client = new EducationPassportClient({
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });

    const args = client.buildIssueCredentialArgs({
      issuerAddress,
      recipientAddress,
      credentialIdHex: "1".repeat(64),
      credentialHashHex: "2".repeat(64),
      templateIdSymbol: "Degree",
      expiresAtTimestamp: 1800000000,
    });

    assert.equal(args.length, 6);

    const revokeArgs = client.buildRevokeCredentialArgs({
      callerAddress: issuerAddress,
      credentialIdHex: "1".repeat(64),
      reason: "Correction",
    });

    assert.equal(revokeArgs.length, 3);
  });
});
