import { computeCredentialHash } from "./hasher.js";
import type {
  OnChainCredentialRecord,
  VerifiableEducationCredential,
  VerificationDiagnostic,
} from "./types.js";

/**
 * Perform full independent verification of a Verifiable Credential against optional on-chain state.
 */
export function verifyEducationCredential(
  credential: VerifiableEducationCredential,
  onChainRecord?: OnChainCredentialRecord | null,
  currentTimestampSecs: number = Math.floor(Date.now() / 1000)
): VerificationDiagnostic {
  const errors: string[] = [];

  // 1. Structural check
  if (!credential || !credential.proof) {
    return {
      isValid: false,
      tampered: true,
      expired: false,
      revoked: false,
      suspended: false,
      untrustedIssuer: false,
      status: "tampered",
      calculatedHash: "",
      claimedHash: "",
      errors: ["Missing credential structure or cryptographic proof"],
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

  // 2. Off-chain cryptographic integrity check
  const calculatedHash = computeCredentialHash(credential);
  const claimedHash = credential.proof.credentialHash.toLowerCase();
  const hashMatched = calculatedHash.toLowerCase() === claimedHash;

  if (!hashMatched) {
    errors.push(
      `Credential hash mismatch: claimed ${claimedHash}, computed ${calculatedHash}`
    );
  }

  // 3. Expiration check from credential document
  let docExpired = false;
  if (credential.expirationDate) {
    const expMs = Date.parse(credential.expirationDate);
    if (!isNaN(expMs) && expMs <= currentTimestampSecs * 1000) {
      docExpired = true;
      errors.push(`Credential expired on ${credential.expirationDate}`);
    }
  }

  // 4. On-chain validation
  let onChainExpired = false;
  let statusActive = true;
  let isRevoked = false;
  let isSuspended = false;
  let issuerAuthorized = true;

  if (onChainRecord) {
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
      errors.push("On-chain credential hash does not match document hash");
    }

    if (onChainRecord.expiresAt && currentTimestampSecs >= onChainRecord.expiresAt) {
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
  const isTampered = !hashMatched;
  const isUntrusted = !issuerAuthorized;

  let status: VerificationDiagnostic["status"] = "valid";
  if (isTampered) {
    status = "tampered";
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
    evidence: {
      hashMatched,
      issuerAuthorized,
      statusActive,
      notExpired: !isExpired,
      issuerAddress:
        credential.issuer.id.replace("did:stellar:", "") ||
        (onChainRecord ? onChainRecord.issuer : ""),
      recipientAddress:
        credential.credentialSubject.recipientAddress ||
        (onChainRecord ? onChainRecord.recipient : ""),
      issuedAt: credential.issuanceDate,
      expiresAt: credential.expirationDate,
    },
  };
}
