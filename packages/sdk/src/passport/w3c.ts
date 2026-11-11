import { createHash } from "node:crypto";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { canonicalizeJson } from "./hasher.js";
import type { CredentialProof, VerifiableEducationCredential } from "./types.js";

const BASE58_BTC_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_BTC_MAP = new Map<string, number>(
  Array.from(BASE58_BTC_ALPHABET).map((ch, idx) => [ch, idx])
);

const W3C_VC_V1_CONTEXT = "https://www.w3.org/2018/credentials/v1";
const DISALLOWED_URI_SCHEME_RE = /^\s*(javascript|vbscript|data):/i;
const URI_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+$/;
// Strict ISO 8601 / RFC 3339 combined date-time (XSD dateTime used in W3C VC DM v1.1)
const RFC3339_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const SUPPORTED_W3C_CRYPTOSUITES = ["eddsa-jcs-2022"] as const;

export const UNSUPPORTED_W3C_SUITES = [
  "eddsa-rdfc-2022",
  "Ed25519Signature2020",
  "Ed25519Signature2018",
  "bbs-2023",
  "BbsBlsSignature2020",
  "BbsBlsSignatureProof2020",
  "JsonWebSignature2020",
  "ecdsa-rdfc-2019",
  "ecdsa-jcs-2019",
] as const;

export interface W3CDataIntegrityProof {
  "@context"?: string | unknown[];
  type: "DataIntegrityProof";
  cryptosuite: "eddsa-jcs-2022";
  created?: string;
  verificationMethod: string;
  proofPurpose: "assertionMethod" | string;
  proofValue: string;
  domain?: string;
  challenge?: string;
}

export interface W3CDataIntegritySignOptions {
  created?: string;
  verificationMethod?: string;
  /** "did:key" produces standard W3C did:key:z6Mk...#z6Mk...; "did:stellar" uses did:stellar:G...#key-1 */
  verificationMethodFormat?: "did:key" | "did:stellar";
  proofPurpose?: string;
  domain?: string;
  challenge?: string;
}

export interface W3CDataIntegrityVerificationResult {
  verified: boolean;
  cryptosuite?: string;
  verificationMethod?: string;
  resolvedStellarPublicKey?: string;
  errors: string[];
}

export interface W3CSchemaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  supportedProofTypes: string[];
  unsupportedProofTypes: string[];
}

export type W3CDualProofCredential = Omit<VerifiableEducationCredential, "proof"> & {
  proof:
    | CredentialProof
    | W3CDataIntegrityProof
    | Array<CredentialProof | W3CDataIntegrityProof>;
};

export function encodeBase58Btc(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros++;
  }

  const digits: number[] = [0];
  for (let i = leadingZeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let out = "1".repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    out += BASE58_BTC_ALPHABET[digits[i]];
  }
  return out;
}

export function decodeBase58Btc(encoded: string): Uint8Array {
  if (typeof encoded !== "string" || encoded.length === 0) {
    throw new Error("Base58btc input must be a non-empty string");
  }
  let leadingOnes = 0;
  while (leadingOnes < encoded.length && encoded[leadingOnes] === "1") {
    leadingOnes++;
  }

  const bytes: number[] = [0];
  for (let i = leadingOnes; i < encoded.length; i++) {
    const val = BASE58_BTC_MAP.get(encoded[i]);
    if (val === undefined) {
      throw new Error(`Invalid base58btc character '${encoded[i]}'`);
    }
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  const result = new Uint8Array(leadingOnes + (bytes.length === 1 && bytes[0] === 0 ? 0 : bytes.length));
  if (!(bytes.length === 1 && bytes[0] === 0)) {
    for (let i = 0; i < bytes.length; i++) {
      result[result.length - 1 - i] = bytes[i];
    }
  }
  return result;
}

/**
 * Convert a Stellar G... Ed25519 public key into a W3C did:key identifier
 * using the 0xed01 multicodec prefix and base58-btc multibase ('z').
 */
export function stellarPublicKeyToDidKey(stellarPublicKey: string): string {
  if (!StrKey.isValidEd25519PublicKey(stellarPublicKey)) {
    throw new Error(`Invalid Stellar Ed25519 public key: ${stellarPublicKey}`);
  }
  const rawPub = Keypair.fromPublicKey(stellarPublicKey).rawPublicKey();
  const multicodec = new Uint8Array(2 + rawPub.length);
  multicodec[0] = 0xed;
  multicodec[1] = 0x01;
  multicodec.set(rawPub, 2);
  return `did:key:z${encodeBase58Btc(multicodec)}`;
}

/**
 * Resolve raw 32-byte Ed25519 public key bytes from a W3C verificationMethod
 * (supports did:key:z6Mk...[#...] and did:stellar:G...[#...]).
 */
export function resolveEd25519PublicKeyFromVerificationMethod(
  verificationMethod: string
): { rawPublicKey: Uint8Array; stellarPublicKey: string } {
  if (typeof verificationMethod !== "string" || verificationMethod.trim().length === 0) {
    throw new Error("verificationMethod must be a non-empty string");
  }
  const baseDid = verificationMethod.split("#")[0];

  if (baseDid.startsWith("did:key:")) {
    const mb = baseDid.slice("did:key:".length);
    if (!mb.startsWith("z")) {
      throw new Error("did:key multibase value must use base58-btc prefix 'z'");
    }
    const decoded = decodeBase58Btc(mb.slice(1));
    if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
      throw new Error("did:key does not encode an Ed25519 multicodec key (0xed01 + 32 bytes)");
    }
    const rawPublicKey = decoded.slice(2);
    const stellarPublicKey = StrKey.encodeEd25519PublicKey(Buffer.from(rawPublicKey));
    return { rawPublicKey, stellarPublicKey };
  }

  if (baseDid.startsWith("did:stellar:")) {
    const addr = baseDid.slice("did:stellar:".length);
    if (!StrKey.isValidEd25519PublicKey(addr)) {
      throw new Error(`Invalid Stellar public key in verificationMethod: ${addr}`);
    }
    const rawPublicKey = new Uint8Array(Keypair.fromPublicKey(addr).rawPublicKey());
    return { rawPublicKey, stellarPublicKey: addr };
  }

  throw new Error(
    `Unsupported verificationMethod DID '${verificationMethod}'. Supported offline DID methods: did:key (Ed25519) and did:stellar`
  );
}

function computeEddsaJcs2022HashData(
  unsecuredDocument: Record<string, unknown>,
  proofConfig: Record<string, unknown>
): Buffer {
  const canonicalProofConfig = canonicalizeJson(proofConfig);
  const canonicalDocument = canonicalizeJson(unsecuredDocument);

  const proofConfigHash = createHash("sha256")
    .update(canonicalProofConfig, "utf8")
    .digest();
  const transformedDocumentHash = createHash("sha256")
    .update(canonicalDocument, "utf8")
    .digest();

  // W3C vc-di-eddsa Section 3.3.4: hashData = proofConfigHash || transformedDocumentHash
  return Buffer.concat([proofConfigHash, transformedDocumentHash]);
}

function contextsStartWith(docContext: unknown, proofContext: unknown): boolean {
  const docArr = Array.isArray(docContext) ? docContext : [docContext];
  const proofArr = Array.isArray(proofContext) ? proofContext : [proofContext];
  if (proofArr.length > docArr.length) return false;
  for (let i = 0; i < proofArr.length; i++) {
    if (canonicalizeJson(docArr[i]) !== canonicalizeJson(proofArr[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Create a W3C Data Integrity proof (`cryptosuite: "eddsa-jcs-2022"`) per W3C vc-di-eddsa Section 3.3.
 */
export function signDocumentEddsaJcs2022(
  document: Record<string, unknown>,
  issuerSecretKey: string,
  options: W3CDataIntegritySignOptions = {}
): W3CDataIntegrityProof {
  if (!StrKey.isValidEd25519SecretSeed(issuerSecretKey)) {
    throw new Error("issuerSecretKey must be a valid Stellar Ed25519 secret seed (S...)");
  }
  const keypair = Keypair.fromSecret(issuerSecretKey);
  const stellarPublicKey = keypair.publicKey();

  const created = options.created ?? new Date().toISOString();
  if (!RFC3339_DATETIME_RE.test(created) || Number.isNaN(Date.parse(created))) {
    throw new Error(`proof.created must be a valid RFC 3339 / XSD dateTime string, got: ${created}`);
  }

  let verificationMethod = options.verificationMethod;
  if (!verificationMethod) {
    if (options.verificationMethodFormat === "did:stellar") {
      verificationMethod = `did:stellar:${stellarPublicKey}#key-1`;
    } else {
      const didKey = stellarPublicKeyToDidKey(stellarPublicKey);
      verificationMethod = `${didKey}#${didKey.slice("did:key:".length)}`;
    }
  } else {
    const resolved = resolveEd25519PublicKeyFromVerificationMethod(verificationMethod);
    if (resolved.stellarPublicKey !== stellarPublicKey) {
      throw new Error(
        `verificationMethod public key (${resolved.stellarPublicKey}) does not match signing secret key (${stellarPublicKey})`
      );
    }
  }

  const { proof: _ignoredProof, ...unsecuredDocument } = document;

  const proofOptions: Record<string, unknown> = {
    type: "DataIntegrityProof",
    cryptosuite: "eddsa-jcs-2022",
    created,
    verificationMethod,
    proofPurpose: options.proofPurpose ?? "assertionMethod",
  };
  if (options.domain !== undefined) proofOptions.domain = options.domain;
  if (options.challenge !== undefined) proofOptions.challenge = options.challenge;

  // W3C vc-di-eddsa Section 3.3.1 Step 2: inherit @context onto proof
  if (unsecuredDocument["@context"] !== undefined) {
    proofOptions["@context"] = unsecuredDocument["@context"];
  }

  const hashData = computeEddsaJcs2022HashData(unsecuredDocument, proofOptions);
  const signatureBytes = keypair.sign(hashData);
  const proofValue = `z${encodeBase58Btc(new Uint8Array(signatureBytes))}`;

  return {
    ...(proofOptions as unknown as Omit<W3CDataIntegrityProof, "proofValue">),
    proofValue,
  };
}

/**
 * Verify a W3C Data Integrity proof (`eddsa-jcs-2022`) on a secured JSON document.
 */
export function verifyDocumentEddsaJcs2022(
  securedDocument: Record<string, unknown>,
  explicitProof?: Record<string, unknown>,
  options: { expectedProofPurpose?: string } = {}
): W3CDataIntegrityVerificationResult {
  const errors: string[] = [];
  if (!securedDocument || typeof securedDocument !== "object") {
    return { verified: false, errors: ["Document must be a JSON object"] };
  }

  let candidateProof = explicitProof;
  if (!candidateProof) {
    if (Array.isArray(securedDocument.proof)) {
      candidateProof = securedDocument.proof.find(
        (p) =>
          p &&
          typeof p === "object" &&
          (p as Record<string, unknown>).type === "DataIntegrityProof"
      ) as Record<string, unknown> | undefined;
    } else if (securedDocument.proof && typeof securedDocument.proof === "object") {
      candidateProof = securedDocument.proof as Record<string, unknown>;
    }
  }

  if (!candidateProof || typeof candidateProof !== "object") {
    return {
      verified: false,
      errors: ["Document does not contain a DataIntegrityProof object"],
    };
  }

  const proofType = candidateProof.type;
  const cryptosuite =
    typeof candidateProof.cryptosuite === "string"
      ? candidateProof.cryptosuite
      : undefined;

  if (proofType !== "DataIntegrityProof") {
    return {
      verified: false,
      cryptosuite,
      errors: [`Unsupported proof.type '${String(proofType)}' for Data Integrity verification`],
    };
  }

  if (cryptosuite !== "eddsa-jcs-2022") {
    return {
      verified: false,
      cryptosuite,
      errors: [
        `Unsupported cryptosuite '${String(cryptosuite)}'. Supported Data Integrity cryptosuite: eddsa-jcs-2022`,
      ],
    };
  }

  const verificationMethod = candidateProof.verificationMethod;
  if (typeof verificationMethod !== "string") {
    return {
      verified: false,
      cryptosuite,
      errors: ["Missing verificationMethod in DataIntegrityProof"],
    };
  }

  const proofValue = candidateProof.proofValue;
  if (typeof proofValue !== "string" || !proofValue.startsWith("z")) {
    return {
      verified: false,
      cryptosuite,
      verificationMethod,
      errors: ["proofValue must be a base58-btc multibase string starting with 'z'"],
    };
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = decodeBase58Btc(proofValue.slice(1));
  } catch (err: any) {
    return {
      verified: false,
      cryptosuite,
      verificationMethod,
      errors: [`Malformed base58-btc proofValue: ${err?.message || "decode error"}`],
    };
  }

  if (signatureBytes.length !== 64) {
    return {
      verified: false,
      cryptosuite,
      verificationMethod,
      errors: [`Ed25519 proofValue must decode to 64 bytes, got ${signatureBytes.length}`],
    };
  }

  let resolvedKey: { rawPublicKey: Uint8Array; stellarPublicKey: string };
  try {
    resolvedKey = resolveEd25519PublicKeyFromVerificationMethod(verificationMethod);
  } catch (err: any) {
    return {
      verified: false,
      cryptosuite,
      verificationMethod,
      errors: [err?.message || "Failed to resolve verificationMethod"],
    };
  }

  const { proof: _strippedProof, ...unsecuredDocument } = securedDocument;
  const { proofValue: _strippedProofValue, ...proofOptions } = candidateProof;

  if (proofOptions.created !== undefined) {
    if (
      typeof proofOptions.created !== "string" ||
      !RFC3339_DATETIME_RE.test(proofOptions.created) ||
      Number.isNaN(Date.parse(proofOptions.created))
    ) {
      errors.push("Invalid created timestamp in DataIntegrityProof");
    }
  }

  if (
    typeof proofOptions.proofPurpose !== "string" ||
    proofOptions.proofPurpose.trim().length === 0
  ) {
    errors.push("Missing proofPurpose in DataIntegrityProof");
  } else if (
    options.expectedProofPurpose &&
    proofOptions.proofPurpose !== options.expectedProofPurpose
  ) {
    errors.push(
      `DataIntegrityProof proofPurpose '${String(proofOptions.proofPurpose)}' does not match expected '${options.expectedProofPurpose}'`
    );
  }

  // W3C vc-di-eddsa Section 3.3.2 Step 4: proofOptions.@context prefix check
  if (proofOptions["@context"] !== undefined) {
    if (
      securedDocument["@context"] === undefined ||
      !contextsStartWith(securedDocument["@context"], proofOptions["@context"])
    ) {
      return {
        verified: false,
        cryptosuite,
        verificationMethod,
        resolvedStellarPublicKey: resolvedKey.stellarPublicKey,
        errors: ["Document @context does not match proof @context prefix"],
      };
    }
    unsecuredDocument["@context"] = proofOptions["@context"];
  }

  if (errors.length > 0) {
    return {
      verified: false,
      cryptosuite,
      verificationMethod,
      resolvedStellarPublicKey: resolvedKey.stellarPublicKey,
      errors,
    };
  }

  const hashData = computeEddsaJcs2022HashData(unsecuredDocument, proofOptions);
  const verified = Keypair.fromPublicKey(resolvedKey.stellarPublicKey).verify(
    hashData,
    Buffer.from(signatureBytes)
  );

  if (!verified) {
    errors.push("Ed25519 signature verification failed for eddsa-jcs-2022 proof");
  }

  return {
    verified,
    cryptosuite,
    verificationMethod,
    resolvedStellarPublicKey: resolvedKey.stellarPublicKey,
    errors,
  };
}

/**
 * Sign an existing Education & Skills Passport credential using W3C Data Integrity (`eddsa-jcs-2022`),
 * preserving the Soroban commitment proof in a standard W3C multi-proof array `[sorobanProof, diProof]`.
 */
export function attachW3CDataIntegrityProof(
  credential: VerifiableEducationCredential,
  issuerSecretKey: string,
  options: W3CDataIntegritySignOptions = {}
): W3CDualProofCredential {
  const { proof: existingProof, ...unsignedDoc } = credential;
  const diProof = signDocumentEddsaJcs2022(
    unsignedDoc as unknown as Record<string, unknown>,
    issuerSecretKey,
    options
  );
  const proofArray = Array.isArray(existingProof)
    ? [...existingProof.filter((p) => (p as Record<string, unknown>).type !== "DataIntegrityProof"), diProof]
    : [existingProof, diProof];
  return {
    ...credential,
    proof: proofArray,
  };
}

function isSafeValidUri(value: unknown): value is string {
  return (
    typeof value === "string" &&
    URI_SCHEME_RE.test(value) &&
    !DISALLOWED_URI_SCHEME_RE.test(value)
  );
}

/**
 * Validate a credential against the W3C Verifiable Credentials Data Model v1.1 schema
 * and report supported vs unsupported proof suites.
 */
export function validateVerifiableCredentialStructure(
  credential: unknown
): W3CSchemaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const supportedProofTypes: string[] = [];
  const unsupportedProofTypes: string[] = [];

  if (!credential || typeof credential !== "object" || Array.isArray(credential)) {
    return {
      valid: false,
      errors: ["Credential must be a JSON object"],
      warnings,
      supportedProofTypes,
      unsupportedProofTypes,
    };
  }

  const doc = credential as Record<string, unknown>;

  // 1. @context validation (W3C VC DM v1.1 Section 4.1)
  const contexts = doc["@context"];
  if (!Array.isArray(contexts) || contexts.length === 0) {
    errors.push("@context must be a non-empty array of URI strings");
  } else {
    if (contexts[0] !== W3C_VC_V1_CONTEXT) {
      errors.push(
        `@context[0] must be '${W3C_VC_V1_CONTEXT}' per W3C VC Data Model v1.1`
      );
    }
    contexts.forEach((ctx, idx) => {
      if (typeof ctx === "string") {
        if (!isSafeValidUri(ctx)) {
          errors.push(`@context[${idx}] must be a valid safe URI`);
        }
      } else if (typeof ctx !== "object" || ctx === null) {
        errors.push(`@context[${idx}] must be a URI string or embedded context object`);
      }
    });
  }

  // 2. id validation (optional in generic W3C VC DM v1.1, must be safe URI if present)
  if (doc.id !== undefined && !isSafeValidUri(doc.id)) {
    errors.push("id must be a valid RFC 3986 URI (e.g. urn:uuid:...) when present");
  }

  // 3. type validation
  const types = doc.type;
  if (!Array.isArray(types) || !types.includes("VerifiableCredential")) {
    errors.push("type must be an array containing 'VerifiableCredential'");
  } else if (types.some((t) => typeof t !== "string" || t.trim().length === 0)) {
    errors.push("Every entry in type must be a non-empty string");
  }

  // 4. issuer validation
  const issuer = doc.issuer;
  let issuerId: string | undefined;
  if (typeof issuer === "string") {
    issuerId = issuer;
  } else if (issuer && typeof issuer === "object" && !Array.isArray(issuer)) {
    const issuerObj = issuer as Record<string, unknown>;
    if (typeof issuerObj.id !== "string") {
      errors.push("issuer object must contain a string id URI");
    } else {
      issuerId = issuerObj.id;
    }
    if (issuerObj.url !== undefined && !isSafeValidUri(issuerObj.url)) {
      errors.push("issuer.url must be a valid safe URI");
    }
    if (issuerObj.metadataUri !== undefined && !isSafeValidUri(issuerObj.metadataUri)) {
      errors.push("issuer.metadataUri must be a valid safe URI");
    }
  } else {
    errors.push("issuer must be a URI string or an issuer object with id");
  }

  if (issuerId !== undefined) {
    if (!isSafeValidUri(issuerId)) {
      errors.push("issuer.id must be a valid safe URI");
    } else if (issuerId.startsWith("did:stellar:")) {
      const addr = issuerId.slice("did:stellar:".length);
      if (!StrKey.isValidEd25519PublicKey(addr)) {
        errors.push(`issuer.id contains invalid Stellar public key: ${addr}`);
      }
    }
  }

  // 5. issuanceDate & expirationDate (W3C VC DM v1.1 requires RFC 3339 / XMLSCHEMA dateTime)
  let issuanceMs = NaN;
  if (typeof doc.issuanceDate !== "string" || !RFC3339_DATETIME_RE.test(doc.issuanceDate)) {
    errors.push("issuanceDate must be a valid RFC 3339 timestamp with timezone (e.g. ...Z)");
  } else {
    issuanceMs = Date.parse(doc.issuanceDate);
    if (Number.isNaN(issuanceMs)) {
      errors.push("issuanceDate cannot be parsed as a valid date");
    }
  }

  if (doc.expirationDate !== undefined) {
    if (
      typeof doc.expirationDate !== "string" ||
      !RFC3339_DATETIME_RE.test(doc.expirationDate) ||
      Number.isNaN(Date.parse(doc.expirationDate))
    ) {
      errors.push("expirationDate must be a valid RFC 3339 timestamp when present");
    } else if (!Number.isNaN(issuanceMs) && Date.parse(doc.expirationDate) <= issuanceMs) {
      warnings.push("expirationDate is earlier than or equal to issuanceDate");
    }
  }

  // 6. credentialSubject validation
  const subject = doc.credentialSubject;
  const subjects = Array.isArray(subject) ? subject : [subject];
  if (
    !subject ||
    (Array.isArray(subject) && subject.length === 0) ||
    subjects.some((s) => !s || typeof s !== "object" || Array.isArray(s))
  ) {
    errors.push("credentialSubject must be a JSON object or non-empty array of objects");
  } else {
    for (const s of subjects as Array<Record<string, unknown>>) {
      if (s.id !== undefined) {
        if (!isSafeValidUri(s.id)) {
          errors.push("credentialSubject.id must be a valid safe URI when present");
        } else if (s.id === "did:stellar:redacted") {
          warnings.push("credentialSubject.id is redacted for selective presentation");
        } else if (s.id.startsWith("did:stellar:")) {
          const addr = s.id.slice("did:stellar:".length);
          if (!StrKey.isValidEd25519PublicKey(addr)) {
            errors.push(`credentialSubject.id contains invalid Stellar public key: ${addr}`);
          }
        }
      }
      if (s.evidenceUri !== undefined && !isSafeValidUri(s.evidenceUri)) {
        errors.push("credentialSubject.evidenceUri must be a valid safe URI when present");
      }
    }
  }

  // 7. proof validation (single proof object or array of proofs)
  if (doc.proof !== undefined) {
    const proofs = Array.isArray(doc.proof) ? doc.proof : [doc.proof];
    if (proofs.length === 0) {
      errors.push("proof array must not be empty");
    }
    for (const p of proofs) {
      if (!p || typeof p !== "object" || Array.isArray(p)) {
        errors.push("Each proof entry must be an object");
        continue;
      }
      const pObj = p as Record<string, unknown>;
      const pType = typeof pObj.type === "string" ? pObj.type : "";
      if (!pType) {
        errors.push("Proof is missing required 'type' string");
        continue;
      }
      if (typeof pObj.proofPurpose !== "string" || !pObj.proofPurpose) {
        errors.push(`Proof '${pType}' is missing required 'proofPurpose'`);
      }

      if (pType === "DataIntegrityProof") {
        const suite = typeof pObj.cryptosuite === "string" ? pObj.cryptosuite : "";
        if ((SUPPORTED_W3C_CRYPTOSUITES as readonly string[]).includes(suite)) {
          supportedProofTypes.push(`DataIntegrityProof:${suite}`);
          if (typeof pObj.verificationMethod !== "string" || typeof pObj.proofValue !== "string") {
            errors.push(`DataIntegrityProof (${suite}) requires verificationMethod and proofValue`);
          }
        } else {
          unsupportedProofTypes.push(suite || "DataIntegrityProof:unknown");
          errors.push(
            `Unsupported DataIntegrityProof cryptosuite '${suite}'. Supported: eddsa-jcs-2022`
          );
        }
      } else if (
        pType === "StellarSorobanHashCommitment2026" ||
        pType === "StellarSorobanSaltedClaims2026"
      ) {
        supportedProofTypes.push(pType);
        if (typeof pObj.credentialHash !== "string" || !/^[0-9a-fA-F]{64}$/.test(pObj.credentialHash)) {
          errors.push(`Proof '${pType}' requires a 64-character hex credentialHash`);
        }
      } else if ((UNSUPPORTED_W3C_SUITES as readonly string[]).includes(pType)) {
        unsupportedProofTypes.push(pType);
        errors.push(
          `Unsupported W3C signature suite '${pType}'. JSON-LD/RDFC and BBS+ suites require external libraries not bundled here`
        );
      } else {
        unsupportedProofTypes.push(pType);
        errors.push(`Unrecognized proof type '${pType}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    supportedProofTypes,
    unsupportedProofTypes,
  };
}
