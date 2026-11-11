import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createVerifiableCredential,
  createSelectiveCredentialView,
  createCredentialSharePackage,
  credentialIdToBytes32Hex,
  encodeCredentialForSharing,
  decodeSharedCredential,
  computeCredentialHash,
  inspectShareUrlPrivacy,
  parseVerificationUrl,
  verifyEducationCredential,
  formatFragmentUrl,
  DEFAULT_PASSPORT_VERIFY_URL,
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

  it("anchor mode share package generates a URL with ZERO student PII routed to #/passport/verify", () => {
    const pkg = createCredentialSharePackage(
      fullVc,
      DEFAULT_PASSPORT_VERIFY_URL,
      {
        mode: "anchor",
        contractId: "CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5",
      }
    );

    const url = pkg.verificationUrl;
    assert.ok(url);
    assert.ok(url.includes("#/passport/verify?"));
    // URL contains contractId, credentialId, and hash only
    assert.ok(url.includes("cid=CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5"));
    assert.ok(url.includes("h=" + fullVc.proof.credentialHash));

    // Zero student personal data in URL:
    assert.equal(url.includes("Elena"), false);
    assert.equal(url.includes("Rostova"), false);
    assert.equal(url.includes("Summa"), false);
    assert.equal(url.includes("Computer"), false);

    // Privacy inspection confirms no PII in URL and fragment-only encoding
    assert.equal(pkg.privacyReport?.mode, "anchor");
    assert.equal(pkg.privacyReport?.containsPiiInUrl, false);
    assert.equal(pkg.privacyReport?.usesFragmentOnly, true);

    // Parse the anchor URL back
    const parsed = parseVerificationUrl(url);
    assert.equal(parsed.type, "anchor");
    assert.equal(parsed.anchor?.contractId, "CAP3J5ZOKBQOMPWEBD42C7SEAK736JQLWVW4Y2MGQHSBYRFJWDNTOKE5");
    assert.equal(parsed.anchor?.credentialHash, fullVc.proof.credentialHash);
  });

  it("payload mode supports explicit privacy redaction (name and grade)", () => {
    const pkg = createCredentialSharePackage(
      fullVc,
      DEFAULT_PASSPORT_VERIFY_URL,
      {
        mode: "payload",
        redactRecipientName: true,
        redactGrade: true,
        selectedSkills: ["Rust"],
      }
    );

    assert.equal(pkg.credential.credentialSubject.recipientName, undefined);
    assert.equal(pkg.credential.credentialSubject.grade, undefined);
    assert.deepEqual(pkg.credential.credentialSubject.skills, ["Rust"]);

    // Raw JSON stringified payload check:
    const jsonStr = JSON.stringify(pkg.credential);
    assert.equal(jsonStr.includes("Elena"), false);
    assert.equal(jsonStr.includes("Summa"), false);
  });

  it("verifies that URL parameters are strictly in the hash fragment (#) to prevent HTTP request-line leakage", () => {
    const url = formatFragmentUrl("https://example.com/app/#/passport/verify", {
      cid: "CAP3",
      id: "cad1",
    });

    const hashPart = url.split("#")[1];
    assert.ok(hashPart);
    assert.ok(hashPart.includes("cid=CAP3"));
    assert.ok(hashPart.includes("id=cad1"));

    // Server-bound path before # has no query parameters
    const pathPart = url.split("#")[0];
    assert.equal(pathPart.includes("?"), false);
  });

  it("salted selective disclosure allows redacting PII and unchosen skills while remaining cryptographically verifiable on-chain", () => {
    const saltedVc = createVerifiableCredential({
      credentialType: "DegreeCredential",
      issuer: {
        address: issuerAddress,
        name: "Massachusetts Institute of Technology",
      },
      recipient: {
        address: recipientAddress,
        name: "Elena Rostova",
      },
      title: "Bachelor of Science in Computer Science",
      institution: "Massachusetts Institute of Technology",
      skills: ["Rust", "Soroban", "Cryptography", "Network Security"],
      grade: "Summa Cum Laude (GPA 4.0)",
      achievementDescription: "Completed rigorous 4-year computer science program.",
      selectiveDisclosure: true,
    });

    assert.equal(saltedVc.proof.type, "StellarSorobanSaltedClaims2026");

    const pkg = createCredentialSharePackage(
      saltedVc,
      DEFAULT_PASSPORT_VERIFY_URL,
      {
        mode: "payload",
        redactRecipientName: true,
        redactRecipientAddress: true,
        redactGrade: true,
        redactDescription: true,
        selectedSkills: ["Rust", "Soroban"],
      }
    );

    const sharedJson = JSON.stringify(pkg.credential);
    // Redacted plaintexts and their salts must NOT appear in shared payload
    assert.equal(sharedJson.includes("Elena"), false);
    assert.equal(sharedJson.includes("Summa"), false);
    assert.equal(sharedJson.includes("Cryptography"), false);
    assert.equal(sharedJson.includes("Network Security"), false);
    assert.equal(sharedJson.includes(recipientAddress), false);
    assert.equal(pkg.credential.proof.selectiveDisclosure?.disclosed.recipientName, undefined);
    assert.equal(pkg.credential.proof.selectiveDisclosure?.disclosed.grade, undefined);
    assert.equal(pkg.credential.proof.selectiveDisclosure?.disclosed["skill:2"], undefined);

    const onChain = {
      credentialId: credentialIdToBytes32Hex(saltedVc.id),
      issuer: issuerAddress,
      recipient: recipientAddress,
      credentialHash: saltedVc.proof.credentialHash,
      templateId: "Degree",
      issuedAt: Math.floor(Date.now() / 1000),
      status: "Active" as const,
      issuerAuthorized: true,
    };

    const diag = verifyEducationCredential(pkg.credential, onChain, undefined, {
      strictCredentialIdMatch: true,
    });
    assert.equal(diag.isValid, true);
    assert.equal(diag.tampered, false);
    assert.equal(diag.status, "valid");
    assert.ok((diag.evidence.hiddenClaimsCount || 0) >= 6);
  });

  it("salted selective disclosure rejects injected claims or tampered salts", () => {
    const saltedVc = createVerifiableCredential({
      credentialType: "SkillBadgeCredential",
      issuer: { address: issuerAddress, name: "MIT" },
      recipient: { address: recipientAddress, name: "Elena" },
      title: "Rust Engineer",
      institution: "MIT",
      skills: ["Rust", "Soroban"],
      achievementDescription: "Verified engineering skills.",
      selectiveDisclosure: true,
    });

    const pkg = createCredentialSharePackage(saltedVc, DEFAULT_PASSPORT_VERIFY_URL, {
      mode: "payload",
      selectedSkills: ["Rust"],
      redactRecipientName: true,
    });

    // Attacker tries to inject undisclosed skill "Soroban" without its salt
    const forged = {
      ...pkg.credential,
      credentialSubject: {
        ...pkg.credential.credentialSubject,
        skills: ["Rust", "Soroban"],
      },
    };
    const diagForged = verifyEducationCredential(forged);
    assert.equal(diagForged.isValid, false);
    assert.equal(diagForged.tampered, true);
    assert.ok(diagForged.errors.some((e) => e.includes("lacks a unique verified salted commitment")));

    // Attacker modifies salt of disclosed title
    const badSalt = structuredClone(pkg.credential);
    badSalt.proof.selectiveDisclosure!.disclosed.title.salt = "0".repeat(32);
    const diagSalt = verifyEducationCredential(badSalt);
    assert.equal(diagSalt.isValid, false);
    assert.equal(diagSalt.tampered, true);
  });

  it("salted claim commitments for identical values use unique salts and remain unlinkable by digest", () => {
    const vcA = createVerifiableCredential({
      credentialType: "CertificateCredential",
      issuer: { address: issuerAddress, name: "Academy" },
      recipient: { address: recipientAddress, name: "Same Name" },
      title: "Same Title",
      institution: "Academy",
      skills: ["Rust"],
      grade: "4.0",
      achievementDescription: "Same",
      selectiveDisclosure: true,
    });
    const vcB = createVerifiableCredential({
      credentialType: "CertificateCredential",
      issuer: { address: issuerAddress, name: "Academy" },
      recipient: { address: recipientAddress, name: "Same Name" },
      title: "Same Title",
      institution: "Academy",
      skills: ["Rust"],
      grade: "4.0",
      achievementDescription: "Same",
      selectiveDisclosure: true,
    });

    assert.notEqual(
      vcA.proof.selectiveDisclosure?.commitments.grade,
      vcB.proof.selectiveDisclosure?.commitments.grade
    );
    assert.notEqual(
      vcA.proof.selectiveDisclosure?.commitments.recipientName,
      vcB.proof.selectiveDisclosure?.commitments.recipientName
    );
  });

  it("inspectShareUrlPrivacy flags non-fragment query parameters and PII exposure", () => {
    const unsafeQueryUrl = "https://example.com/verify?cid=CAP3&id=" + "a".repeat(64) + "&h=" + "b".repeat(64);
    const report = inspectShareUrlPrivacy(unsafeQueryUrl);
    assert.equal(report.usesFragmentOnly, false);
    assert.ok(report.warnings.some((w) => w.includes("before '#'")));

    const payloadUrl = createCredentialSharePackage(fullVc, DEFAULT_PASSPORT_VERIFY_URL, {
      mode: "payload",
    }).verificationUrl!;
    const payloadReport = inspectShareUrlPrivacy(payloadUrl);
    assert.equal(payloadReport.mode, "payload");
    assert.equal(payloadReport.containsPiiInUrl, true);
    assert.ok(payloadReport.exposedUrlFields.includes("recipientName"));
    assert.ok(payloadReport.exposedUrlFields.includes("grade"));
  });

  it("supports UTF-8 non-ASCII learner names in base64url sharing payloads and rejects invalid anchor hex", () => {
    const unicodeVc = createVerifiableCredential({
      credentialType: "DegreeCredential",
      issuer: { address: issuerAddress, name: "École Polytechnique 🎓" },
      recipient: { address: recipientAddress, name: "Joséphine Müller-Łódź" },
      title: "Maîtrise en Cryptographie",
      institution: "École Polytechnique",
      skills: ["Cryptographie", "Soroban"],
      achievementDescription: "Mention Très Bien — 日本語テスト",
    });

    const encoded = encodeCredentialForSharing(unicodeVc);
    const decoded = decodeSharedCredential(encoded);
    assert.equal(decoded.credentialSubject.recipientName, "Joséphine Müller-Łódź");
    assert.equal(computeCredentialHash(decoded), unicodeVc.proof.credentialHash);

    const badAnchor = parseVerificationUrl("https://example.com/#/passport/verify?id=not-hex&h=1234");
    assert.equal(badAnchor.type, "unknown");
    assert.ok(badAnchor.error?.includes("Invalid anchor"));
  });
});
