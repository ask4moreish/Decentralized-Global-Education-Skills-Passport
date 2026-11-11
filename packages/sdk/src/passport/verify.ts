import {
  canonicalizeJson,
  computeCredentialHash,
  computeSaltedClaimDigest,
  credentialIdToBytes32Hex,
} from "./hasher.js";
import {
  validateVerifiableCredentialStructure,
  verifyDocumentEddsaJcs2022,
  type W3CDataIntegrityProof,
  type W3CDualProofCredential,
} from "./w3c.js";
import type {
  CredentialProof,
  OnChainCredentialRecord,
  VerifiableEducationCredential,
  VerificationDiagnostic,
} from "./types.js";

export interface VerifyEducationOptions {
  /** Enforce that credential.id deterministically maps to onChainRecord.credentialId */
  strictCredentialIdMatch?: boolean;
  /** Optional expected Soroban contract ID to cross-check against credential.proof.contractId */
  expectedContractId?: string;
  /** Enforce full W3C VC Data Model v1.1 schema + valid Stellar StrKey validation */
  strictW3cSchema?: boolean;
}

function emptyFailureDiagnostic(
  errors: string[],
  claimedHash = "",
  calculatedHash = ""
): VerificationDiagnostic {
  return {
    isValid: false,
    tampered: true,
    expired: false,
    revoked: false,
    suspended: false,
    untrustedIssuer: false,
    status: "tampered",
    calculatedHash,
    claimedHash,
    errors,
    evidence: {
      hashMatched: false,
      issuerAuthorized: false,
      statusActive: false,
      notExpired: false,
      issuerAddress: "",
      recipientAddress: "",
      issuedAt: "",
    },
  };
}

function verifySaltedSelectiveClaims(
  credential: VerifiableEducationCredential,
  errors: string[]
): {
  claimsValid: boolean;
  disclosedClaims: string[];
  hiddenClaimsCount: number;
} {
  const sd = credential.proof.selectiveDisclosure;
  if (
    !sd ||
    sd.version !== 1 ||
    sd.algorithm !== "sha256-jcs-salted-v1" ||
    !sd.commitments ||
    typeof sd.commitments !== "object" ||
    !sd.disclosed ||
    typeof sd.disclosed !== "object"
  ) {
    errors.push("Malformed selectiveDisclosure commitment bundle");
    return { claimsValid: false, disclosedClaims: [], hiddenClaimsCount: 0 };
  }

  let claimsValid = true;
  const disclosedClaims: string[] = [];
  const usedSkillKeys = new Set<string>();

  // 1. Verify every disclosed entry against its committed salted digest
  for (const [key, entry] of Object.entries(sd.disclosed)) {
    const expectedDigest = sd.commitments[key];
    if (!expectedDigest || typeof expectedDigest !== "string") {
      claimsValid = false;
      errors.push(`Disclosed claim "${key}" has no matching root commitment`);
      continue;
    }
    if (!entry || typeof entry.salt !== "string") {
      claimsValid = false;
      errors.push(`Disclosed claim "${key}" is missing a valid salt`);
      continue;
    }
    try {
      const actualDigest = computeSaltedClaimDigest(key, entry.salt, entry.value);
      if (actualDigest.toLowerCase() !== expectedDigest.toLowerCase()) {
        claimsValid = false;
        errors.push(`Salted claim commitment mismatch for "${key}"`);
      } else {
        disclosedClaims.push(key);
      }
    } catch (err: any) {
      claimsValid = false;
      errors.push(`Invalid salted claim "${key}": ${err?.message || "hash error"}`);
    }
  }

  // 2. Ensure every presented field in credentialSubject is backed by a verified disclosed entry
  const subject = credential.credentialSubject;
  const checkScalar = (
    field: keyof typeof subject,
    redactedSentinel?: string[]
  ) => {
    const val = subject[field];
    if (val === undefined) return;
    if (typeof val === "string" && redactedSentinel?.includes(val)) return;
    const entry = sd.disclosed[field];
    if (!entry) {
      claimsValid = false;
      errors.push(`Presented field "${String(field)}" lacks a disclosed salted commitment`);
      return;
    }
    if (canonicalizeJson(val) !== canonicalizeJson(entry.value)) {
      claimsValid = false;
      errors.push(`Presented field "${String(field)}" does not match disclosed commitment value`);
    }
  };

  checkScalar("id", ["did:stellar:redacted"]);
  checkScalar("recipientAddress");
  checkScalar("recipientName");
  checkScalar("title", ["Redacted credential title"]);
  checkScalar("institution");
  checkScalar("grade");
  checkScalar("achievementDescription", [
    "Omitted by holder",
    "Description omitted by learner for privacy.",
  ]);
  checkScalar("evidenceUri");
  checkScalar("customFields");

  if (Array.isArray(subject.skills)) {
    for (const skill of subject.skills) {
      const matchedEntry = Object.entries(sd.disclosed).find(
        ([k, entry]) =>
          k.startsWith("skill:") &&
          !usedSkillKeys.has(k) &&
          entry.value === skill
      );
      if (!matchedEntry) {
        claimsValid = false;
        errors.push(`Presented skill "${skill}" lacks a unique verified salted commitment`);
      } else {
        usedSkillKeys.add(matchedEntry[0]);
      }
    }
  }

  const totalCommitments = Object.keys(sd.commitments).length;
  const hiddenClaimsCount = Math.max(0, totalCommitments - disclosedClaims.length);

  return { claimsValid, disclosedClaims, hiddenClaimsCount };
}

/**
 * Perform full independent verification of a Verifiable Credential against optional on-chain state.
 */
export function verifyEducationCredential(
  credential: VerifiableEducationCredential | W3CDualProofCredential,
  onChainRecord?: OnChainCredentialRecord | null,
  currentTimestampSecs: number = Math.floor(Date.now() / 1000),
  options?: VerifyEducationOptions
): VerificationDiagnostic {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Structural check & proof extraction
  if (
    !credential ||
    typeof credential !== "object" ||
    !credential.proof ||
    !credential.issuer ||
    !credential.credentialSubject
  ) {
    return emptyFailureDiagnostic([
      "Missing credential structure or cryptographic proof",
    ]);
  }

  const proofsList = Array.isArray(credential.proof)
    ? credential.proof
    : [credential.proof];

  const schemaResult = validateVerifiableCredentialStructure(credential);
  const w3cSchemaValid = schemaResult.valid;
  if (schemaResult.warnings.length > 0) {
    warnings.push(...schemaResult.warnings);
  }
  if (schemaResult.unsupportedProofTypes.length > 0) {
    return emptyFailureDiagnostic(schemaResult.errors);
  }

  const sorobanProof = proofsList.find(
    (p): p is CredentialProof =>
      Boolean(p) &&
      typeof p === "object" &&
      (p.type === "StellarSorobanHashCommitment2026" ||
        p.type === "StellarSorobanSaltedClaims2026")
  );
  const diProofs = proofsList.filter(
    (p): p is W3CDataIntegrityProof =>
      Boolean(p) && typeof p === "object" && p.type === "DataIntegrityProof"
  );

  if (!sorobanProof && diProofs.length === 0) {
    return emptyFailureDiagnostic([
      "Missing supported cryptographic proof (expected StellarSoroban* or DataIntegrityProof)",
    ]);
  }

  let calculatedHash = "";
  let claimedHash = "";
  let hashMatched = true;

  if (sorobanProof) {
    if (typeof sorobanProof.credentialHash !== "string") {
      return emptyFailureDiagnostic([
        "Missing credentialHash in Soroban commitment proof",
      ]);
    }
    const claimedHashRaw = sorobanProof.credentialHash.trim();
    if (!/^[0-9a-fA-F]{64}$/.test(claimedHashRaw)) {
      return emptyFailureDiagnostic(
        ["Malformed credentialHash in proof (expected 64-character hex SHA-256)"],
        claimedHashRaw
      );
    }
    claimedHash = claimedHashRaw.toLowerCase();

    // Off-chain Soroban commitment check
    const normalizedForHash: VerifiableEducationCredential = {
      ...(credential as VerifiableEducationCredential),
      proof: sorobanProof,
    };
    try {
      calculatedHash = computeCredentialHash(normalizedForHash);
    } catch (err: any) {
      return emptyFailureDiagnostic(
        [`Canonicalization error: ${err?.message || "invalid credential JSON"}`],
        claimedHash
      );
    }

    hashMatched = calculatedHash.toLowerCase() === claimedHash;
    if (!hashMatched) {
      errors.push(
        `Credential hash mismatch: claimed ${claimedHash}, computed ${calculatedHash}`
      );
    }
  } else {
    // Pure DataIntegrityProof VC without explicit Soroban commitment proof: compute canonical hash from unsigned doc
    try {
      const { proof: _p, ...unsignedDoc } = credential;
      calculatedHash = computeCredentialHash(unsignedDoc);
      claimedHash = calculatedHash;
    } catch (err: any) {
      return emptyFailureDiagnostic([
        `Canonicalization error: ${err?.message || "invalid credential JSON"}`,
      ]);
    }
  }

  let disclosedClaims: string[] | undefined;
  let hiddenClaimsCount: number | undefined;
  if (sorobanProof?.type === "StellarSorobanSaltedClaims2026") {
    const normalizedForSalted: VerifiableEducationCredential = {
      ...(credential as VerifiableEducationCredential),
      proof: sorobanProof,
    };
    const saltedResult = verifySaltedSelectiveClaims(normalizedForSalted, errors);
    disclosedClaims = saltedResult.disclosedClaims;
    hiddenClaimsCount = saltedResult.hiddenClaimsCount;
    if (!saltedResult.claimsValid) {
      hashMatched = false;
    }
  }

  // 2b. W3C Data Integrity proof checks (eddsa-jcs-2022) — verify EVERY DataIntegrityProof present
  let dataIntegrityVerified: boolean | undefined;
  if (diProofs.length > 0) {
    dataIntegrityVerified = true;
    for (const diProof of diProofs) {
      const diRes = verifyDocumentEddsaJcs2022(
        credential as unknown as Record<string, unknown>,
        diProof as unknown as Record<string, unknown>,
        { expectedProofPurpose: "assertionMethod" }
      );
      if (!diRes.verified) {
        dataIntegrityVerified = false;
        hashMatched = false;
        errors.push(...diRes.errors);
      } else if (
        credential.issuer.id?.startsWith("did:stellar:") &&
        diRes.resolvedStellarPublicKey &&
        diRes.resolvedStellarPublicKey !==
          credential.issuer.id.slice("did:stellar:".length)
      ) {
        dataIntegrityVerified = false;
        hashMatched = false;
        errors.push(
          `DataIntegrityProof verificationMethod key (${diRes.resolvedStellarPublicKey}) does not match issuer DID (${credential.issuer.id})`
        );
      }
    }
  }

  // Enforce strict W3C VC Data Model validation when requested, and always enforce core @context/type structure
  if (!schemaResult.valid) {
    const coreStructuralErrors = schemaResult.errors.filter(
      (msg) =>
        msg.startsWith("@context") ||
        msg.startsWith("type must") ||
        msg.startsWith("Every entry in type") ||
        msg.startsWith("credentialSubject must")
    );
    if (options?.strictW3cSchema) {
      hashMatched = false;
      errors.push(...schemaResult.errors);
    } else if (coreStructuralErrors.length > 0) {
      hashMatched = false;
      errors.push(...coreStructuralErrors);
    }
  }

  // 3. Issuance & expiration timestamps
  let docExpired = false;
  let malformedDate = false;
  if (!credential.issuanceDate || Number.isNaN(Date.parse(credential.issuanceDate))) {
    malformedDate = true;
    errors.push("Malformed or missing credential issuanceDate timestamp");
  }
  if (credential.expirationDate !== undefined) {
    const expMs = Date.parse(credential.expirationDate);
    if (Number.isNaN(expMs)) {
      malformedDate = true;
      errors.push(`Malformed expirationDate timestamp: ${credential.expirationDate}`);
    } else if (expMs <= currentTimestampSecs * 1000) {
      docExpired = true;
      errors.push(`Credential expired on ${credential.expirationDate}`);
    }
  }

  // 4. Contract ID cross-check if caller specified expectedContractId
  if (
    options?.expectedContractId &&
    sorobanProof?.contractId &&
    sorobanProof.contractId !== options.expectedContractId
  ) {
    hashMatched = false;
    errors.push(
      `Proof contractId (${sorobanProof.contractId}) does not match expected contract (${options.expectedContractId})`
    );
  }

  // 5. On-chain validation & cross-binding checks
  let onChainExpired = false;
  let onChainHashMatched = true;
  let statusActive = true;
  let isRevoked = false;
  let isSuspended = false;
  let issuerAuthorized = true;

  if (onChainRecord === null) {
    statusActive = false;
    errors.push("No on-chain registration record found on Stellar Soroban ledger");
  } else if (onChainRecord) {
    if (onChainRecord.status === "Revoked") {
      isRevoked = true;
      statusActive = false;
      errors.push(
        `Credential is revoked on-chain: ${
          onChainRecord.revocationReason || "No reason specified"
        }`
      );
    } else if (onChainRecord.status === "Suspended") {
      isSuspended = true;
      statusActive = false;
      errors.push(
        `Credential is suspended on-chain: ${
          onChainRecord.revocationReason || "Under review"
        }`
      );
    }

    if (
      onChainRecord.credentialHash.toLowerCase() !== claimedHash ||
      onChainRecord.credentialHash.toLowerCase() !== calculatedHash.toLowerCase()
    ) {
      onChainHashMatched = false;
      errors.push("On-chain credential hash does not match document hash");
    }

    // Issuer identity binding check
    const docIssuerAddress = credential.issuer.id.startsWith("did:stellar:")
      ? credential.issuer.id.slice("did:stellar:".length)
      : credential.issuer.id;
    if (
      onChainRecord.issuer &&
      docIssuerAddress &&
      docIssuerAddress !== onChainRecord.issuer
    ) {
      onChainHashMatched = false;
      errors.push(
        `Issuer DID (${credential.issuer.id}) does not match on-chain issuer (${onChainRecord.issuer})`
      );
    }

    // Recipient identity binding check (skip only when explicitly redacted in salted selective presentation)
    const subjectDid = credential.credentialSubject.id;
    if (subjectDid && subjectDid !== "did:stellar:redacted") {
      const docRecipientAddress = subjectDid.startsWith("did:stellar:")
        ? subjectDid.slice("did:stellar:".length)
        : subjectDid;
      if (
        onChainRecord.recipient &&
        docRecipientAddress !== onChainRecord.recipient
      ) {
        onChainHashMatched = false;
        errors.push(
          `Recipient DID (${subjectDid}) does not match on-chain recipient (${onChainRecord.recipient})`
        );
      }
    }

    // Optional strict credential ID binding check
    if (options?.strictCredentialIdMatch && onChainRecord.credentialId && credential.id) {
      try {
        const expectedHex = credentialIdToBytes32Hex(credential.id);
        if (expectedHex !== onChainRecord.credentialId.toLowerCase()) {
          onChainHashMatched = false;
          errors.push(
            `Credential ID (${credential.id}) does not match on-chain credentialId (${onChainRecord.credentialId})`
          );
        }
      } catch (err: any) {
        onChainHashMatched = false;
        errors.push(`Invalid credential ID: ${err?.message || "format error"}`);
      }
    }

    if (onChainRecord.expiresAt !== undefined && currentTimestampSecs >= onChainRecord.expiresAt) {
      onChainExpired = true;
      errors.push(
        `Credential expired on-chain at timestamp ${onChainRecord.expiresAt}`
      );
    }

    if (onChainRecord.issuerAuthorized === false) {
      issuerAuthorized = false;
      errors.push("Issuing institution is deauthorized or unverified on-chain");
    }
  }

  const isExpired = docExpired || onChainExpired;
  const isTampered = !hashMatched || !onChainHashMatched || malformedDate;
  const isUntrusted = !issuerAuthorized;
  const isUnregistered = onChainRecord === null;

  let status: VerificationDiagnostic["status"] = "valid";
  if (isTampered) {
    status = "tampered";
  } else if (isUnregistered) {
    status = "unverifiable";
  } else if (isRevoked) {
    status = "revoked";
  } else if (isSuspended) {
    status = "suspended";
  } else if (isExpired) {
    status = "expired";
  } else if (isUntrusted) {
    status = "untrusted";
  }

  const isValid =
    hashMatched &&
    onChainHashMatched &&
    !malformedDate &&
    !isUnregistered &&
    !isExpired &&
    !isRevoked &&
    !isSuspended &&
    issuerAuthorized;

  return {
    isValid,
    tampered: isTampered,
    expired: isExpired,
    revoked: isRevoked,
    suspended: isSuspended,
    untrustedIssuer: isUntrusted,
    status,
    calculatedHash,
    claimedHash,
    errors,
    ...(warnings.length > 0 ? { warnings } : {}),
    evidence: {
      hashMatched: hashMatched && onChainHashMatched && !malformedDate,
      issuerAuthorized,
      statusActive,
      notExpired: !isExpired,
      issuerAddress:
        credential.issuer.id.replace("did:stellar:", "") ||
        (onChainRecord ? onChainRecord.issuer : ""),
      recipientAddress:
        credential.credentialSubject.recipientAddress ||
        (credential.credentialSubject.id === "did:stellar:redacted"
          ? "Redacted"
          : credential.credentialSubject.id.replace("did:stellar:", "")) ||
        (onChainRecord ? onChainRecord.recipient : ""),
      issuedAt: credential.issuanceDate,
      expiresAt: credential.expirationDate,
      ...(disclosedClaims !== undefined ? { disclosedClaims } : {}),
      ...(hiddenClaimsCount !== undefined ? { hiddenClaimsCount } : {}),
      w3cSchemaValid,
      ...(dataIntegrityVerified !== undefined ? { dataIntegrityVerified } : {}),
    },
  };
}
