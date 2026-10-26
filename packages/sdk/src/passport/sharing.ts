import type {
  CredentialSharePackage,
  VerifiableEducationCredential,
} from "./types.js";

/**
 * Encode a credential into a compact URL-safe base64 string for QR codes and verification links.
 */
export function encodeCredentialForSharing(
  credential: VerifiableEducationCredential
): string {
  const json = JSON.stringify(credential);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  // Browser fallback
  return btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a shareable base64url string back into a VerifiableCredential object.
 */
export function decodeSharedCredential(
  encoded: string
): VerifiableEducationCredential {
  let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }

  let json = "";
  if (typeof Buffer !== "undefined") {
    json = Buffer.from(base64, "base64").toString("utf8");
  } else {
    json = atob(base64);
  }

  return JSON.parse(json) as VerifiableEducationCredential;
}

/**
 * Generate a complete sharing package with QR payload and verification link.
 */
export function createCredentialSharePackage(
  credential: VerifiableEducationCredential,
  baseUrl: string = "https://ask4moreish.github.io/Decentralized-Global-Education-Skills-Passport/#/verify"
): CredentialSharePackage {
  const encoded = encodeCredentialForSharing(credential);
  const separator = baseUrl.includes("?") ? "&" : "?";
  const verificationUrl = `${baseUrl}${separator}data=${encoded}`;

  return {
    version: 1,
    sharedAt: new Date().toISOString(),
    credential,
    verificationUrl,
    qrPayload: verificationUrl,
  };
}

/**
 * Selective disclosure: export only chosen skills or credentials without leaking unrelated learner records.
 */
export function createSelectiveCredentialView(
  credential: VerifiableEducationCredential,
  selectedSkills?: string[]
): VerifiableEducationCredential {
  if (!selectedSkills || selectedSkills.length === 0) {
    return credential;
  }

  // Filter skills while keeping core credential metadata
  return {
    ...credential,
    credentialSubject: {
      ...credential.credentialSubject,
      skills: credential.credentialSubject.skills.filter((s) =>
        selectedSkills.includes(s)
      ),
    },
  };
}
