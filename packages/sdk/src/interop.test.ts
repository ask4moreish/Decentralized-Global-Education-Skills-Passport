import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, createPublicKey, verify as nodeCryptoVerify } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import {
  attachW3CDataIntegrityProof,
  canonicalizeJson,
  computeCredentialHash,
  createSelectiveCredentialView,
  createVerifiableCredential,
  decodeBase58Btc,
  resolveEd25519PublicKeyFromVerificationMethod,
  signDocumentEddsaJcs2022,
  stellarPublicKeyToDidKey,
  validateVerifiableCredentialStructure,
  verifyDocumentEddsaJcs2022,
  verifyEducationCredential,
  type W3CDualProofCredential,
} from "./index.js";

describe("W3C VC Interoperability & Trust Model Boundaries", () => {
  const issuerKeypair = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0x11));
  const recipientKeypair = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0x22));
  const issuerAddress = issuerKeypair.publicKey();
  const recipientAddress = recipientKeypair.publicKey();

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
    const schema = validateVerifiableCredentialStructure(standardVc);
    assert.equal(schema.valid, true, `Schema errors: ${schema.errors.join("; ")}`);
    assert.deepEqual(schema.supportedProofTypes, ["StellarSorobanHashCommitment2026"]);
    assert.deepEqual(schema.unsupportedProofTypes, []);

    assert.ok(Array.isArray(standardVc["@context"]));
    assert.equal(standardVc["@context"][0], "https://www.w3.org/2018/credentials/v1");
    assert.ok(standardVc.type.includes("VerifiableCredential"));
    assert.ok(standardVc.type.includes("DegreeCredential"));
    assert.match(standardVc.id, /^urn:uuid:[0-9a-f-]{36}$/);
    assert.equal(standardVc.issuer.id, `did:stellar:${issuerAddress}`);
    assert.equal(standardVc.issuanceDate.endsWith("Z"), true);
    assert.equal(standardVc.credentialSubject.id, `did:stellar:${recipientAddress}`);
  });

  it("matches RFC 8785 JSON Canonicalization Scheme (JCS) edge vectors", () => {
    // 1. UTF-16 code unit ordering: surrogate high code unit 0xD83D sorts BEFORE U+F000 (0xF000)
    // whereas raw UTF-8 byte order would put U+F000 (EF 80 80) before U+1F600 (F0 9F 98 80).
    const jcsOrdering = canonicalizeJson({
      "\uf000": "bmp-high",
      "😀": "astral-emoji",
      b: 2,
      a: 1,
      "\r": "cr",
    });
    assert.equal(
      jcsOrdering,
      '{"\\r":"cr","a":1,"b":2,"😀":"astral-emoji","\uf000":"bmp-high"}'
    );

    // 2. Numeric normalization (-0 -> 0) and non-finite rejection
    assert.equal(canonicalizeJson({ negZero: -0, zero: 0 }), '{"negZero":0,"zero":0}');
    assert.throws(() => canonicalizeJson({ bad: Number.NaN }), /non-finite/);
    assert.throws(() => canonicalizeJson({ bad: Number.POSITIVE_INFINITY }), /non-finite/);
  });

  it("verifies what the verifier PROVES: canonical RFC-8785 hash integrity commitment", () => {
    const { proof, ...unsignedDoc } = standardVc;
    const computedHash = computeCredentialHash(unsignedDoc);
    assert.equal(computedHash, proof.credentialHash);

    const reordered = {
      credentialSubject: unsignedDoc.credentialSubject,
      "@context": unsignedDoc["@context"],
      type: unsignedDoc.type,
      issuanceDate: unsignedDoc.issuanceDate,
      issuer: unsignedDoc.issuer,
      id: unsignedDoc.id,
    };
    assert.equal(computeCredentialHash(reordered), computedHash);
  });

  it("creates and verifies W3C Data Integrity eddsa-jcs-2022 proofs independently with Node crypto Ed25519 SPKI", () => {
    const dualSigned: W3CDualProofCredential = attachW3CDataIntegrityProof(
      standardVc,
      issuerKeypair.secret(),
      { verificationMethodFormat: "did:key" }
    );

    const schema = validateVerifiableCredentialStructure(dualSigned);
    assert.equal(schema.valid, true, `Errors: ${schema.errors.join("; ")}`);
    assert.deepEqual(schema.supportedProofTypes, [
      "StellarSorobanHashCommitment2026",
      "DataIntegrityProof:eddsa-jcs-2022",
    ]);

    // 1. SDK verifier validates both Soroban hash commitment AND W3C Data Integrity signature
    const diag = verifyEducationCredential(
      dualSigned,
      {
        credentialId: "a".repeat(64),
        issuer: issuerAddress,
        recipient: recipientAddress,
        credentialHash: standardVc.proof.credentialHash,
        templateId: "Degree",
        issuedAt: 1700000000,
        status: "Active",
        issuerAuthorized: true,
      },
      undefined,
      { strictW3cSchema: true }
    );
    assert.equal(diag.isValid, true);
    assert.equal(diag.evidence.w3cSchemaValid, true);
    assert.equal(diag.evidence.dataIntegrityVerified, true);

    // 2. Independent verification using raw node:crypto SPKI Ed25519 verifier
    // following W3C vc-di-eddsa Section 3.3 without any Stellar SDK helpers.
    const proofs = dualSigned.proof as unknown as Array<Record<string, unknown>>;
    const diProof = proofs[1];
    assert.equal(diProof.type, "DataIntegrityProof");
    assert.equal(diProof.cryptosuite, "eddsa-jcs-2022");
    assert.ok(String(diProof.verificationMethod).startsWith("did:key:z6Mk"));

    const { rawPublicKey } = resolveEd25519PublicKeyFromVerificationMethod(
      String(diProof.verificationMethod)
    );
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const nodePublicKey = createPublicKey({
      key: Buffer.concat([spkiPrefix, Buffer.from(rawPublicKey)]),
      format: "der",
      type: "spki",
    });

    const { proof: _ignored, ...unsecured } = dualSigned as unknown as Record<string, unknown>;
    const { proofValue, ...proofConfig } = diProof;
    const proofConfigHash = createHash("sha256")
      .update(canonicalizeJson(proofConfig), "utf8")
      .digest();
    const docHash = createHash("sha256")
      .update(canonicalizeJson(unsecured), "utf8")
      .digest();
    const expectedHashData = Buffer.concat([proofConfigHash, docHash]);
    const sigBytes = decodeBase58Btc(String(proofValue).slice(1));

    const independentVerified = nodeCryptoVerify(
      null,
      expectedHashData,
      nodePublicKey,
      Buffer.from(sigBytes)
    );
    assert.equal(independentVerified, true);

    // Confirm did:key round-trip resolves back to Stellar G... address
    const didKey = stellarPublicKeyToDidKey(issuerAddress);
    assert.equal(
      resolveEd25519PublicKeyFromVerificationMethod(didKey).stellarPublicKey,
      issuerAddress
    );
  });

  it("supports standalone W3C eddsa-jcs-2022 with did:stellar verificationMethod and rejects forged signatures", () => {
    const { proof: _p, ...unsigned } = standardVc;
    const proof = signDocumentEddsaJcs2022(
      unsigned as unknown as Record<string, unknown>,
      issuerKeypair.secret(),
      { verificationMethodFormat: "did:stellar" }
    );
    const standaloneW3cVc = { ...unsigned, proof } as unknown as W3CDualProofCredential;

    const ok = verifyDocumentEddsaJcs2022(
      standaloneW3cVc as unknown as Record<string, unknown>
    );
    assert.equal(ok.verified, true);
    assert.equal(ok.resolvedStellarPublicKey, issuerAddress);

    // Attacker mutates credentialSubject claim
    const tampered = {
      ...standaloneW3cVc,
      credentialSubject: {
        ...standaloneW3cVc.credentialSubject,
        grade: "Summa Cum Laude",
      },
    };
    const tamperedResult = verifyDocumentEddsaJcs2022(
      tampered as unknown as Record<string, unknown>
    );
    assert.equal(tamperedResult.verified, false);

    // Verify via verifyEducationCredential against on-chain commitment fails cleanly when tampered
    const diag = verifyEducationCredential(tampered);
    assert.equal(diag.isValid, false);
    assert.equal(diag.tampered, true);
    assert.equal(diag.evidence.dataIntegrityVerified, false);

    // Signer mismatch between issuer DID and DataIntegrityProof key fails verification
    const rogueKeypair = Keypair.random();
    const mismatchedDual = attachW3CDataIntegrityProof(
      standardVc,
      rogueKeypair.secret()
    );
    const mismatchDiag = verifyEducationCredential(mismatchedDual);
    assert.equal(mismatchDiag.isValid, false);
    assert.equal(mismatchDiag.tampered, true);
    assert.ok(mismatchDiag.errors.some((e) => e.includes("does not match issuer DID")));

    // Wrong proofPurpose (authentication instead of assertionMethod) is rejected
    const { proof: _p2, ...unsigned2 } = standardVc;
    const authProof = signDocumentEddsaJcs2022(
      unsigned2 as unknown as Record<string, unknown>,
      issuerKeypair.secret(),
      { proofPurpose: "authentication" }
    );
    const wrongPurposeVc = { ...unsigned2, proof: authProof } as unknown as W3CDualProofCredential;
    const purposeDiag = verifyEducationCredential(wrongPurposeVc);
    assert.equal(purposeDiag.isValid, false);
    assert.equal(purposeDiag.tampered, true);
    assert.ok(purposeDiag.errors.some((e) => e.includes("proofPurpose")));

    // Multi-proof array containing one valid DI proof and one forged DI proof MUST fail
    const validDual = attachW3CDataIntegrityProof(standardVc, issuerKeypair.secret());
    const validDi = (validDual.proof as unknown as Array<Record<string, unknown>>)[1];
    const forgedSecondDi = {
      ...validDi,
      proofValue: "z1111111111111111111111111111111111111111111111111111111111111111",
    };
    const multiForged = {
      ...validDual,
      proof: [...(validDual.proof as unknown as Array<unknown>), forgedSecondDi],
    } as unknown as W3CDualProofCredential;
    const multiDiag = verifyEducationCredential(multiForged);
    assert.equal(multiDiag.isValid, false);
    assert.equal(multiDiag.evidence.dataIntegrityVerified, false);
  });

  it("validates W3C VC schema negative cases and rejects unsupported suites (RDFC, BBS+, JWS)", () => {
    // Missing W3C v1 @context first entry
    const badContext = validateVerifiableCredentialStructure({
      ...standardVc,
      "@context": ["https://example.org/custom"],
    });
    assert.equal(badContext.valid, false);
    assert.ok(badContext.errors.some((e) => e.includes("credentials/v1")));

    // Missing VerifiableCredential type
    const badType = validateVerifiableCredentialStructure({
      ...standardVc,
      type: ["DegreeCredential"],
    });
    assert.equal(badType.valid, false);

    // Invalid Stellar public key inside did:stellar DID
    const badIssuerDid = validateVerifiableCredentialStructure({
      ...standardVc,
      issuer: { ...standardVc.issuer, id: "did:stellar:GINVALID0000000000" },
    });
    assert.equal(badIssuerDid.valid, false);

    // Malformed issuanceDate (missing timezone / non-RFC3339)
    const badDate = validateVerifiableCredentialStructure({
      ...standardVc,
      issuanceDate: "2026-01-01",
    });
    assert.equal(badDate.valid, false);

    // Unsafe javascript: evidence URI
    const badUri = validateVerifiableCredentialStructure({
      ...standardVc,
      credentialSubject: {
        ...standardVc.credentialSubject,
        evidenceUri: "javascript:alert(1)",
      },
    });
    assert.equal(badUri.valid, false);

    // Unsupported W3C suites are explicitly flagged and rejected during verification
    for (const suiteCase of [
      { type: "Ed25519Signature2020", proofPurpose: "assertionMethod", proofValue: "z123" },
      { type: "DataIntegrityProof", cryptosuite: "eddsa-rdfc-2022", verificationMethod: "did:key:z1", proofPurpose: "assertionMethod", proofValue: "z123" },
      { type: "DataIntegrityProof", cryptosuite: "bbs-2023", verificationMethod: "did:key:z1", proofPurpose: "assertionMethod", proofValue: "z123" },
    ]) {
      const unsupportedVc = { ...standardVc, proof: suiteCase } as unknown as W3CDualProofCredential;
      const schema = validateVerifiableCredentialStructure(unsupportedVc);
      assert.equal(schema.valid, false);
      assert.ok(schema.unsupportedProofTypes.length > 0);

      const verifyRes = verifyEducationCredential(unsupportedVc);
      assert.equal(verifyRes.isValid, false);
      assert.equal(verifyRes.tampered, true);
    }
  });

  it("verifies what hashing DOES NOT prove and contrasts v1 views vs salted selective disclosure", () => {
    const rawJson = JSON.stringify(standardVc);
    assert.ok(rawJson.includes("Marcus Vance"));
    assert.ok(rawJson.includes("First Class with Distinction"));

    const view = createSelectiveCredentialView(standardVc, ["Type Theory"]);
    assert.deepEqual(view.credentialSubject.skills, ["Type Theory"]);
    assert.notEqual(computeCredentialHash(view), standardVc.proof.credentialHash);
  });
});
