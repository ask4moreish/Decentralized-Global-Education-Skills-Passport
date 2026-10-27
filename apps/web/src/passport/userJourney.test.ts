import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createVerifiableCredential,
  createSelectiveCredentialView,
  createCredentialSharePackage,
  decodeSharedCredential,
  verifyEducationCredential,
  computeCredentialHash,
} from "skills-passport-sdk";
import {
  loadStoredCredentials,
  saveStoredCredentials,
  loadStoredIssuers,
  saveStoredIssuers,
  type StoredCredentialItem,
  type IssuerProfile,
} from "./passportState.js";

describe("Complete End-to-End User Journey", () => {
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

  it("executes the complete multi-party lifecycle from issuance to revocation and recovery", () => {
    // -------------------------------------------------------------
    // STAGE 1: Educational Institution Registration & Authorization
    // -------------------------------------------------------------
    const institutionAddress = "GACREDENTIALINSTITUTE2026STELLARGLOBALTESTNETKEY01";
    const newIssuer: IssuerProfile = {
      address: institutionAddress,
      name: "Global Institute of Blockchain Technology",
      metadataUri: "https://gibt.edu/accreditation.json",
      isAuthorized: true,
      registeredAt: Math.floor(Date.now() / 1000),
    };

    saveStoredIssuers([newIssuer]);
    const storedIssuers = loadStoredIssuers();
    const authorized = storedIssuers.find((i) => i.address === institutionAddress);
    assert.ok(authorized);
    assert.equal(authorized.isAuthorized, true);

    // -------------------------------------------------------------
    // STAGE 2: Institution Issues Verifiable Credential to Learner
    // -------------------------------------------------------------
    const learnerAddress = "GBLEARNER2026STELLARGLOBALTESTNETKEYPASS0000000002";
    const vc = createVerifiableCredential({
      credentialType: "DegreeCredential",
      issuer: {
        address: institutionAddress,
        name: "Global Institute of Blockchain Technology",
        url: "https://gibt.edu",
      },
      recipient: {
        address: learnerAddress,
        name: "Elena Rostova",
      },
      title: "Master of Science in Distributed Systems",
      institution: "Global Institute of Blockchain Technology",
      skills: ["Rust", "Soroban", "Distributed Consensus", "Zero-Knowledge Proofs"],
      grade: "Summa Cum Laude (GPA 4.0)",
      achievementDescription: "Graduated top of cohort with distinction in consensus protocols.",
    });

    assert.ok(vc.id.startsWith("urn:uuid:"));
    assert.equal(vc.credentialSubject.recipientAddress, learnerAddress);
    assert.equal(vc.proof.credentialHash.length, 64);

    // Commit credential record to on-chain state
    const idKey = vc.id.replace("urn:uuid:", "").replace(/-/g, "").padEnd(64, "0").slice(0, 64);
    const item: StoredCredentialItem = {
      vc,
      onChain: {
        credentialId: idKey,
        issuer: institutionAddress,
        recipient: learnerAddress,
        credentialHash: vc.proof.credentialHash,
        templateId: "Degree",
        issuedAt: Math.floor(Date.now() / 1000),
        status: "Active",
        issuerAuthorized: true,
      },
    };

    saveStoredCredentials([item]);

    // -------------------------------------------------------------
    // STAGE 3: Learner Ingests Credential and Generates Share Link
    // -------------------------------------------------------------
    const learnerVault = loadStoredCredentials();
    const learnerCred = learnerVault.find((c) => c.vc.credentialSubject.recipientAddress === learnerAddress);
    assert.ok(learnerCred);
    assert.equal(learnerCred.vc.credentialSubject.title, "Master of Science in Distributed Systems");

    // Learner selectively discloses skills ("Rust", "Soroban")
    const selectiveView = createSelectiveCredentialView(learnerCred.vc, ["Rust", "Soroban"]);
    assert.deepEqual(selectiveView.credentialSubject.skills, ["Rust", "Soroban"]);

    // Learner generates share package with QR code payload
    const sharePkg = createCredentialSharePackage(learnerCred.vc);
    assert.ok(sharePkg.verificationUrl);
    assert.ok(sharePkg.verificationUrl.includes("data="));

    // -------------------------------------------------------------
    // STAGE 4: Independent Employer Verifier Validates Credential
    // -------------------------------------------------------------
    const urlMatch = sharePkg.verificationUrl!.match(/[?&]data=([^&#]+)/);
    assert.ok(urlMatch);
    const decodedVc = decodeSharedCredential(decodeURIComponent(urlMatch[1]));
    assert.equal(decodedVc.id, vc.id);

    // Verifier checks credential against on-chain record
    const verifierDiag = verifyEducationCredential(decodedVc, item.onChain);
    assert.equal(verifierDiag.isValid, true);
    assert.equal(verifierDiag.tampered, false);
    assert.equal(verifierDiag.status, "valid");
    assert.equal(verifierDiag.untrustedIssuer, false);

    // -------------------------------------------------------------
    // STAGE 5: Institution Suspends Credential (Academic Audit)
    // -------------------------------------------------------------
    const suspendedItem: StoredCredentialItem = {
      ...item,
      onChain: {
        ...item.onChain,
        status: "Suspended",
        revocationReason: "Pending academic integrity review",
      },
    };
    saveStoredCredentials([suspendedItem]);

    const suspendedDiag = verifyEducationCredential(decodedVc, suspendedItem.onChain);
    assert.equal(suspendedDiag.isValid, false);
    assert.equal(suspendedDiag.suspended, true);
    assert.equal(suspendedDiag.status, "suspended");

    // -------------------------------------------------------------
    // STAGE 6: Institution Reactivates Credential
    // -------------------------------------------------------------
    const reactivatedItem: StoredCredentialItem = {
      ...item,
      onChain: {
        ...item.onChain,
        status: "Active",
        revocationReason: undefined,
      },
    };
    saveStoredCredentials([reactivatedItem]);

    const reactivatedDiag = verifyEducationCredential(decodedVc, reactivatedItem.onChain);
    assert.equal(reactivatedDiag.isValid, true);
    assert.equal(reactivatedDiag.status, "valid");

    // -------------------------------------------------------------
    // STAGE 7: Institution Revokes Credential (Permanent)
    // -------------------------------------------------------------
    const revokedItem: StoredCredentialItem = {
      ...item,
      onChain: {
        ...item.onChain,
        status: "Revoked",
        revocationReason: "Permanent revocation: academic credential forgery",
      },
    };
    saveStoredCredentials([revokedItem]);

    const revokedDiag = verifyEducationCredential(decodedVc, revokedItem.onChain);
    assert.equal(revokedDiag.isValid, false);
    assert.equal(revokedDiag.revoked, true);
    assert.equal(revokedDiag.status, "revoked");

    // -------------------------------------------------------------
    // STAGE 8: Tampering Detection (Forged Grade)
    // -------------------------------------------------------------
    const tamperedVc = {
      ...decodedVc,
      credentialSubject: {
        ...decodedVc.credentialSubject,
        grade: "Failing Grade Overwritten to Perfect GPA",
      },
    };
    const tamperedDiag = verifyEducationCredential(tamperedVc, reactivatedItem.onChain);
    assert.equal(tamperedDiag.isValid, false);
    assert.equal(tamperedDiag.tampered, true);
    assert.equal(tamperedDiag.status, "tampered");

    // -------------------------------------------------------------
    // STAGE 9: Unregistered / Unavailable On-Chain State
    // -------------------------------------------------------------
    // When on-chain record is null (ledger lookup missing or offline)
    const unverifiableDiag = verifyEducationCredential(decodedVc, null);
    assert.equal(unverifiableDiag.isValid, false);
    assert.equal(unverifiableDiag.status, "unverifiable");
    assert.ok(unverifiableDiag.errors.some((e) => e.includes("No on-chain registration record")));
  });
});
