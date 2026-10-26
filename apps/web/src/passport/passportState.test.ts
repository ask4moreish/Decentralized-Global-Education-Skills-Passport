import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_ISSUERS,
  DEMO_LEARNERS,
  loadStoredCredentials,
  saveStoredCredentials,
  loadStoredIssuers,
  saveStoredIssuers,
  type StoredCredentialItem,
} from "./passportState.js";
import { verifyEducationCredential } from "skills-passport-sdk";

describe("Passport State & Credential Persistence", () => {
  // Mock localStorage for test environment
  const mockStorage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = val;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(mockStorage)) {
        delete mockStorage[k];
      }
    },
  };

  beforeEach(() => {
    (globalThis as any).localStorage = mockLocalStorage;
    mockLocalStorage.clear();
  });

  it("should initialize default seed credentials when storage is empty", () => {
    const creds = loadStoredCredentials();
    assert.ok(creds.length >= 5, "Expected at least 5 seed credentials");

    // Check seed credential types
    const types = creds.map((c) => c.vc.type[1]);
    assert.ok(types.includes("DegreeCredential"));
    assert.ok(types.includes("CertificateCredential"));
    assert.ok(types.includes("CourseCompletionCredential"));

    // Verify degree credential verifies cleanly against its on-chain record
    const degree = creds.find((c) => c.vc.type[1] === "DegreeCredential");
    assert.ok(degree);
    const diag = verifyEducationCredential(degree.vc, degree.onChain);
    assert.equal(diag.isValid, true);
    assert.equal(diag.status, "valid");
  });

  it("should persist and reload custom credential items", () => {
    const initial = loadStoredCredentials();
    const customItem: StoredCredentialItem = {
      vc: {
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "https://w3id.org/security/suites/ed25519-2020/v1",
        ],
        id: "urn:uuid:test-credential-custom-id",
        type: ["VerifiableCredential", "SkillBadgeCredential"],
        issuer: {
          id: `did:stellar:${DEMO_ISSUERS[0].address}`,
          name: "Test University",
        },
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: `did:stellar:${DEMO_LEARNERS[0].address}`,
          title: "Full Stack Engineer",
          institution: "Test University",
          skills: ["TypeScript", "Rust"],
          achievementDescription: "Mastered full stack engineering.",
        },
        proof: {
          type: "StellarSorobanHashCommitment2026",
          created: new Date().toISOString(),
          verificationMethod: `did:stellar:${DEMO_ISSUERS[0].address}#stellar-key`,
          proofPurpose: "assertionMethod",
          credentialHash: "e".repeat(64),
        },
      },
      onChain: {
        credentialId: "f".repeat(64),
        issuer: DEMO_ISSUERS[0].address,
        recipient: DEMO_LEARNERS[0].address,
        credentialHash: "e".repeat(64),
        templateId: "SkillBadge",
        issuedAt: Math.floor(Date.now() / 1000),
        status: "Active",
        issuerAuthorized: true,
      },
    };

    saveStoredCredentials([...initial, customItem]);

    const reloaded = loadStoredCredentials();
    assert.equal(reloaded.length, initial.length + 1);
    const found = reloaded.find((c) => c.vc.id === "urn:uuid:test-credential-custom-id");
    assert.ok(found);
    assert.equal(found.vc.credentialSubject.title, "Full Stack Engineer");
  });

  it("should handle issuer management and persistence", () => {
    const issuers = loadStoredIssuers();
    assert.ok(issuers.length >= 4);

    const newIssuer = {
      address: "GBNEWISSUER99999999999999999999999999999999999999999999999",
      name: "Oxford Blockchain Institute",
      metadataUri: "https://oxford.example.edu/meta.json",
      isAuthorized: true,
      registeredAt: Math.floor(Date.now() / 1000),
    };

    saveStoredIssuers([...issuers, newIssuer]);
    const reloaded = loadStoredIssuers();
    assert.equal(reloaded.length, issuers.length + 1);
    const found = reloaded.find((i) => i.address === newIssuer.address);
    assert.ok(found);
    assert.equal(found.name, "Oxford Blockchain Institute");
  });

  it("should identify seed revoked and expired credentials properly", () => {
    const creds = loadStoredCredentials();
    const revoked = creds.find((c) => c.onChain.status === "Revoked");
    assert.ok(revoked, "Should have a seed revoked credential");
    const revokedDiag = verifyEducationCredential(revoked.vc, revoked.onChain);
    assert.equal(revokedDiag.isValid, false);
    assert.equal(revokedDiag.revoked, true);
    assert.equal(revokedDiag.status, "revoked");

    const expired = creds.find(
      (c) => c.vc.expirationDate && Date.parse(c.vc.expirationDate) < Date.now()
    );
    assert.ok(expired, "Should have a seed expired credential");
    const expiredDiag = verifyEducationCredential(expired.vc, expired.onChain);
    assert.equal(expiredDiag.isValid, false);
    assert.equal(expiredDiag.expired, true);
    assert.equal(expiredDiag.status, "expired");
  });
});
