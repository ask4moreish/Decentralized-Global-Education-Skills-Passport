import type {
  CredentialSharePackage,
  VerifiableEducationCredential,
} from "./types.js";

export interface SharePrivacyOptions {
  /** If true, redacts the recipient's personal name from the shareable payload */
  redactRecipientName?: boolean;
  /** If true, redacts numeric grades/evaluations from the shareable payload */
  redactGrade?: boolean;
  /** If true, redacts detailed achievement descriptions */
  redactDescription?: boolean;
  /** Skills to selectively disclose (if omitted or empty, all skills included) */
  selectedSkills?: string[];
  /** Mode: "payload" (embeds sanitized VC in hash fragment) or "anchor" (only passes contractId, credentialId, hash - ZERO PII) */
  mode?: "payload" | "anchor";
  /** Optional contract address to link directly to on-chain ledger record */
  contractId?: string;
}

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
 * Format a privacy-safe URL ensuring parameters are placed in the URL hash fragment
 * so that browsers never transmit them to servers in HTTP request lines or Referer headers.
 */
export function formatFragmentUrl(
  baseUrl: string,
  params: Record<string, string>
): string {
  const hashIdx = baseUrl.indexOf("#");
  const base = hashIdx >= 0 ? baseUrl : `${baseUrl}#`;
  const queryString = Object.entries(params)
    .filter(([_, v]) => Boolean(v))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  if (!queryString) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${queryString}`;
}

/**
 * Generate a complete sharing package with QR payload and verification link.
 * Supports privacy-preserving anchor mode (zero PII in URL) or sanitized payload mode.
 */
export function createCredentialSharePackage(
  credential: VerifiableEducationCredential,
  baseUrl: string = "https://ask4moreish.github.io/Decentralized-Global-Education-Skills-Passport/#/verify",
  options?: SharePrivacyOptions
): CredentialSharePackage {
  const mode = options?.mode || "payload";

  if (mode === "anchor") {
    const idKey = credential.id
      .replace("urn:uuid:", "")
      .replace(/-/g, "")
      .padEnd(64, "0")
      .slice(0, 64);
    const contractId =
      options?.contractId || credential.proof.contractId || "";
    const verificationUrl = formatFragmentUrl(baseUrl, {
      cid: contractId,
      id: idKey,
      h: credential.proof.credentialHash,
    });

    return {
      version: 1,
      sharedAt: new Date().toISOString(),
      credential,
      verificationUrl,
      qrPayload: verificationUrl,
    };
  }

  // Payload mode with privacy sanitization
  let sanitized = { ...credential };
  if (options?.selectedSkills && options.selectedSkills.length > 0) {
    sanitized = createSelectiveCredentialView(sanitized, options.selectedSkills);
  }

  if (
    options?.redactRecipientName ||
    options?.redactGrade ||
    options?.redactDescription
  ) {
    const subject = { ...sanitized.credentialSubject };
    if (options.redactRecipientName) {
      delete subject.recipientName;
    }
    if (options.redactGrade) {
      delete subject.grade;
    }
    if (options.redactDescription) {
      subject.achievementDescription =
        "Description omitted by learner for privacy.";
    }
    sanitized = {
      ...sanitized,
      credentialSubject: subject,
    };
  }

  const encoded = encodeCredentialForSharing(sanitized);
  const verificationUrl = formatFragmentUrl(baseUrl, { data: encoded });

  return {
    version: 1,
    sharedAt: new Date().toISOString(),
    credential: sanitized,
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

export interface ParsedVerificationInput {
  type: "payload" | "anchor" | "unknown";
  credential?: VerifiableEducationCredential;
  payload?: VerifiableEducationCredential;
  anchor?: {
    contractId?: string;
    credentialId?: string;
    credentialHash?: string;
  };
  error?: string;
}

export type ParsedVerificationUrl = ParsedVerificationInput;
export type AnchorPayload = NonNullable<ParsedVerificationInput["anchor"]>;

/**
 * Parse a verification input string (URL, base64 data, or raw JSON)
 * cleanly distinguishing between full/sanitized payload links and anchor-only links.
 */
export function parseVerificationUrl(urlOrText: string): ParsedVerificationInput {
  try {
    const text = urlOrText.trim();
    if (!text) {
      return { type: "unknown", error: "Empty input" };
    }

    // Check if it's raw JSON
    if (text.startsWith("{")) {
      const parsed = JSON.parse(text) as VerifiableEducationCredential;
      return { type: "payload", credential: parsed, payload: parsed };
    }

    // Check for anchor parameters (cid, id, h)
    const cidMatch = text.match(/[?&#]cid=([^&#]+)/);
    const idMatch = text.match(/[?&#]id=([^&#]+)/);
    const hMatch = text.match(/[?&#]h=([^&#]+)/);
    if (idMatch || hMatch) {
      return {
        type: "anchor",
        anchor: {
          contractId: cidMatch ? decodeURIComponent(cidMatch[1]) : undefined,
          credentialId: idMatch ? decodeURIComponent(idMatch[1]) : undefined,
          credentialHash: hMatch ? decodeURIComponent(hMatch[1]) : undefined,
        },
      };
    }

    // Check for base64url data parameter
    const dataMatch = text.match(/[?&#]data=([^&#]+)/);
    const rawData = dataMatch ? decodeURIComponent(dataMatch[1]) : text;
    const decoded = decodeSharedCredential(rawData);
    return { type: "payload", credential: decoded, payload: decoded };
  } catch (err: any) {
    return { type: "unknown", error: err.message };
  }
}
