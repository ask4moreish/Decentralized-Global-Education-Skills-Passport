import { credentialIdToBytes32Hex } from "./hasher.js";
import type {
  CredentialSharePackage,
  SaltedDisclosureData,
  SharePrivacyReport,
  VerifiableEducationCredential,
} from "./types.js";

export const DEFAULT_PASSPORT_VERIFY_URL =
  "https://ask4moreish.github.io/Decentralized-Global-Education-Skills-Passport/#/passport/verify";

export interface SharePrivacyOptions {
  /** If true, redacts the recipient's personal name from the shareable payload */
  redactRecipientName?: boolean;
  /** If true, redacts the recipient's Stellar address / DID from the shareable payload */
  redactRecipientAddress?: boolean;
  /** If true, redacts numeric grades/evaluations from the shareable payload */
  redactGrade?: boolean;
  /** If true, redacts detailed achievement descriptions */
  redactDescription?: boolean;
  /** If true, redacts the qualification title (supported verifiably with StellarSorobanSaltedClaims2026) */
  redactTitle?: boolean;
  /** If true, redacts optional evidenceUri */
  redactEvidenceUri?: boolean;
  /** If true, redacts optional customFields */
  redactCustomFields?: boolean;
  /** Skills to selectively disclose (if omitted, all skills included; pass [] to hide all skills in salted mode) */
  selectedSkills?: string[];
  /** Mode: "payload" (embeds sanitized VC in hash fragment) or "anchor" (only passes contractId, credentialId, hash - ZERO PII in link) */
  mode?: "payload" | "anchor";
  /** Optional contract address to link directly to on-chain ledger record */
  contractId?: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(encoded: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error("Invalid base64url characters in shared credential payload");
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(encoded, "base64url"));
  }
  let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function safeJsonParseObject<T>(raw: string): T {
  const parsed = JSON.parse(raw, (key, value) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return undefined;
    }
    return value;
  });
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Credential payload must be a JSON object");
  }
  return parsed as T;
}

/**
 * Encode a credential into a compact URL-safe base64url string for QR codes and verification links.
 * Uses UTF-8 byte encoding so non-ASCII learner/institution names never fail in browsers.
 */
export function encodeCredentialForSharing(
  credential: VerifiableEducationCredential
): string {
  const json = JSON.stringify(credential);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

/**
 * Decode a shareable base64url string back into a VerifiableCredential object.
 */
export function decodeSharedCredential(
  encoded: string
): VerifiableEducationCredential {
  const trimmed = encoded.trim();
  if (!trimmed || trimmed.length > 65536) {
    throw new Error("Shared credential payload is empty or exceeds 64KB limit");
  }
  const bytes = base64UrlToBytes(trimmed);
  const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return safeJsonParseObject<VerifiableEducationCredential>(json);
}

/**
 * Format a URL placing parameters strictly inside the client-side hash fragment (`#`)
 * so parameters are not sent in HTTP request paths/query strings or standard Referer headers.
 * Note: browsers STILL record hash fragments in local browser history, clipboard, and screenshots.
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

function applySaltedRedaction(
  credential: VerifiableEducationCredential,
  options: SharePrivacyOptions
): VerifiableEducationCredential {
  const sd = credential.proof.selectiveDisclosure!;
  const nextDisclosed: SaltedDisclosureData["disclosed"] = { ...sd.disclosed };
  const nextSubject = { ...credential.credentialSubject };

  const removeField = (field: keyof typeof nextSubject) => {
    delete nextSubject[field];
    delete nextDisclosed[field];
  };

  if (options.redactRecipientName) {
    removeField("recipientName");
  }
  if (options.redactRecipientAddress) {
    delete nextSubject.recipientAddress;
    delete nextDisclosed.recipientAddress;
    nextSubject.id = "did:stellar:redacted";
    delete nextDisclosed.id;
  }
  if (options.redactGrade) {
    removeField("grade");
  }
  if (options.redactDescription) {
    nextSubject.achievementDescription = "Omitted by holder";
    delete nextDisclosed.achievementDescription;
  }
  if (options.redactTitle) {
    nextSubject.title = "Redacted credential title";
    delete nextDisclosed.title;
  }
  if (options.redactEvidenceUri) {
    removeField("evidenceUri");
  }
  if (options.redactCustomFields) {
    removeField("customFields");
  }

  if (options.selectedSkills !== undefined) {
    const selectedSet = new Set(options.selectedSkills);
    const disclosedSkills: string[] = [];
    for (const [key, entry] of Object.entries(nextDisclosed)) {
      if (!key.startsWith("skill:")) continue;
      if (typeof entry.value === "string" && selectedSet.has(entry.value)) {
        disclosedSkills.push(entry.value);
      } else {
        delete nextDisclosed[key];
      }
    }
    // Preserve original skill ordering based on numeric suffix
    const orderedKeys = Object.keys(nextDisclosed)
      .filter((k) => k.startsWith("skill:"))
      .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
    nextSubject.skills = orderedKeys.map((k) => String(nextDisclosed[k].value));
  } else {
    nextSubject.skills = [...nextSubject.skills];
  }

  return {
    ...credential,
    credentialSubject: nextSubject,
    proof: {
      ...credential.proof,
      selectiveDisclosure: {
        ...sd,
        disclosed: nextDisclosed,
      },
    },
  };
}

/**
 * Inspect a sharing URL for privacy exposure across URL queries, fragments, and embedded PII.
 */
export function inspectShareUrlPrivacy(url: string): SharePrivacyReport {
  const warnings: string[] = [];
  const exposedUrlFields: string[] = [];
  const hashIdx = url.indexOf("#");
  const beforeHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const usesFragmentOnly = !beforeHash.includes("?");

  if (!usesFragmentOnly) {
    warnings.push(
      "Parameters before '#' may be transmitted in HTTP requests and logged by web servers or proxies."
    );
  }

  const parsed = parseVerificationUrl(url);
  if (parsed.type === "anchor" && parsed.anchor) {
    if (parsed.anchor.contractId) exposedUrlFields.push("cid");
    if (parsed.anchor.credentialId) exposedUrlFields.push("id");
    if (parsed.anchor.credentialHash) exposedUrlFields.push("h");
    warnings.push(
      "Anchor URLs contain no student PII, but browser history, clipboard, and screenshots retain the link, and on-chain lookup exposes issuer/recipient Stellar addresses and status."
    );
    return {
      mode: "anchor",
      usesFragmentOnly,
      containsPiiInUrl: false,
      exposedUrlFields,
      warnings,
    };
  }

  if (parsed.type === "payload" && parsed.credential) {
    const subj = parsed.credential.credentialSubject;
    if (subj?.recipientName) exposedUrlFields.push("recipientName");
    if (subj?.recipientAddress || (subj?.id && subj.id !== "did:stellar:redacted")) {
      exposedUrlFields.push("recipientAddress");
    }
    if (subj?.grade) exposedUrlFields.push("grade");
    if (subj?.title && subj.title !== "Redacted credential title") {
      exposedUrlFields.push("title");
    }
    if (subj?.skills?.length) exposedUrlFields.push("skills");
    if (
      subj?.achievementDescription &&
      subj.achievementDescription !== "Omitted by holder" &&
      subj.achievementDescription !== "Description omitted by learner for privacy."
    ) {
      exposedUrlFields.push("achievementDescription");
    }
    if (subj?.evidenceUri) exposedUrlFields.push("evidenceUri");

    warnings.push(
      "Payload links encode disclosed credential attributes in the URL fragment: browser history, copied links, messaging logs, and screenshots retain them."
    );
    return {
      mode: "payload",
      usesFragmentOnly,
      containsPiiInUrl: exposedUrlFields.length > 0,
      exposedUrlFields,
      warnings,
    };
  }

  return {
    mode: "unknown",
    usesFragmentOnly,
    containsPiiInUrl: false,
    exposedUrlFields,
    warnings: ["Unable to classify sharing URL payload."],
  };
}

/**
 * Generate a complete sharing package with QR payload and verification link.
 * Supports privacy-preserving anchor mode (zero PII in URL) or sanitized/selective payload mode.
 */
export function createCredentialSharePackage(
  credential: VerifiableEducationCredential,
  baseUrl: string = DEFAULT_PASSPORT_VERIFY_URL,
  options?: SharePrivacyOptions
): CredentialSharePackage {
  const mode = options?.mode || "payload";

  if (mode === "anchor") {
    const idKey = credentialIdToBytes32Hex(credential.id);
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
      privacyReport: inspectShareUrlPrivacy(verificationUrl),
    };
  }

  // Payload mode: use cryptographically verifiable salted disclosure when available
  let sanitized: VerifiableEducationCredential;
  const warnings: string[] = [];

  if (
    credential.proof.type === "StellarSorobanSaltedClaims2026" &&
    credential.proof.selectiveDisclosure
  ) {
    sanitized = applySaltedRedaction(credential, options || {});
  } else {
    sanitized = { ...credential };
    const hasFilterOrRedaction =
      (options?.selectedSkills && options.selectedSkills.length > 0) ||
      options?.redactRecipientName ||
      options?.redactRecipientAddress ||
      options?.redactGrade ||
      options?.redactDescription ||
      options?.redactTitle ||
      options?.redactEvidenceUri ||
      options?.redactCustomFields;

    if (options?.selectedSkills && options.selectedSkills.length > 0) {
      sanitized = createSelectiveCredentialView(sanitized, options.selectedSkills);
    }

    if (
      options?.redactRecipientName ||
      options?.redactRecipientAddress ||
      options?.redactGrade ||
      options?.redactDescription ||
      options?.redactTitle ||
      options?.redactEvidenceUri ||
      options?.redactCustomFields
    ) {
      const subject = { ...sanitized.credentialSubject };
      if (options.redactRecipientName) delete subject.recipientName;
      if (options.redactRecipientAddress) {
        delete subject.recipientAddress;
        subject.id = "did:stellar:redacted";
      }
      if (options.redactGrade) delete subject.grade;
      if (options.redactDescription) {
        subject.achievementDescription = "Description omitted by learner for privacy.";
      }
      if (options.redactTitle) {
        subject.title = "Redacted credential title";
      }
      if (options.redactEvidenceUri) delete subject.evidenceUri;
      if (options.redactCustomFields) delete subject.customFields;
      sanitized = {
        ...sanitized,
        credentialSubject: subject,
      };
    }

    if (hasFilterOrRedaction) {
      warnings.push(
        "Legacy whole-document credential redacted: its recomputed hash differs from the parent Soroban root commitment. Issue with selectiveDisclosure: true for verifiable attribute redaction."
      );
    }
  }

  const encoded = encodeCredentialForSharing(sanitized);
  const verificationUrl = formatFragmentUrl(baseUrl, { data: encoded });
  const privacyReport = inspectShareUrlPrivacy(verificationUrl);
  privacyReport.warnings.push(...warnings);

  return {
    version: 1,
    sharedAt: new Date().toISOString(),
    credential: sanitized,
    verificationUrl,
    qrPayload: verificationUrl,
    privacyReport,
  };
}

/**
 * Selective disclosure: export only chosen skills without leaking unselected competencies.
 * When called on a StellarSorobanSaltedClaims2026 credential, strips unchosen skill salts while preserving root-hash verifiability.
 */
export function createSelectiveCredentialView(
  credential: VerifiableEducationCredential,
  selectedSkills?: string[]
): VerifiableEducationCredential {
  if (!selectedSkills || selectedSkills.length === 0) {
    return credential;
  }

  if (
    credential.proof?.type === "StellarSorobanSaltedClaims2026" &&
    credential.proof.selectiveDisclosure
  ) {
    return applySaltedRedaction(credential, { selectedSkills });
  }

  // Whole-document v1 view filter
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
 * Parse a verification input string (URL, base64url data, or raw JSON)
 * cleanly distinguishing between full/sanitized payload links and anchor-only links.
 */
export function parseVerificationUrl(urlOrText: string): ParsedVerificationInput {
  try {
    const text = urlOrText.trim();
    if (!text) {
      return { type: "unknown", error: "Empty input" };
    }
    if (text.length > 131072) {
      return { type: "unknown", error: "Input exceeds maximum allowed length" };
    }

    // Check if it's raw JSON
    if (text.startsWith("{")) {
      const parsed = safeJsonParseObject<VerifiableEducationCredential>(text);
      return { type: "payload", credential: parsed, payload: parsed };
    }

    // Check for anchor parameters (cid, id, h)
    const cidMatch = text.match(/[?&#]cid=([^&#]+)/);
    const idMatch = text.match(/[?&#]id=([^&#]+)/);
    const hMatch = text.match(/[?&#]h=([^&#]+)/);
    if (idMatch || hMatch) {
      const contractId = cidMatch ? decodeURIComponent(cidMatch[1]).trim() : undefined;
      const credentialId = idMatch ? decodeURIComponent(idMatch[1]).trim() : undefined;
      const credentialHash = hMatch ? decodeURIComponent(hMatch[1]).trim() : undefined;

      if (credentialId && !/^(0x)?[0-9a-fA-F]{64}$/.test(credentialId)) {
        return { type: "unknown", error: "Invalid anchor credentialId format (expected 64-char hex)" };
      }
      if (credentialHash && !/^(0x)?[0-9a-fA-F]{64}$/.test(credentialHash)) {
        return { type: "unknown", error: "Invalid anchor credentialHash format (expected 64-char hex)" };
      }

      return {
        type: "anchor",
        anchor: {
          contractId,
          credentialId: credentialId?.replace(/^0x/i, "").toLowerCase(),
          credentialHash: credentialHash?.replace(/^0x/i, "").toLowerCase(),
        },
      };
    }

    // Check for base64url data parameter
    const dataMatch = text.match(/[?&#]data=([^&#]+)/);
    const rawData = dataMatch ? decodeURIComponent(dataMatch[1]) : text;
    const decoded = decodeSharedCredential(rawData);
    return { type: "payload", credential: decoded, payload: decoded };
  } catch (err: any) {
    return { type: "unknown", error: err?.message || "Failed to parse verification input" };
  }
}
