import { createHash, randomBytes } from "node:crypto";
import type { VerifiableEducationCredential } from "./types.js";

/**
 * Deterministically sort and canonicalize JSON values according to RFC 8785 (JCS).
 * Uses UTF-16 code-unit lexicographic comparison (not localeCompare) and rejects non-finite numbers.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`RFC 8785 JCS rejects non-finite number: ${String(value)}`);
    }
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }

  if (typeof value === "bigint") {
    throw new Error("RFC 8785 JCS does not support bigint values");
  }

  if (typeof value !== "object") {
    throw new Error(`RFC 8785 JCS cannot serialize value of type ${typeof value}`);
  }

  const maybeToJson = value as { toJSON?: () => unknown };
  if (typeof maybeToJson.toJSON === "function") {
    return canonicalizeJson(maybeToJson.toJSON());
  }

  if (Array.isArray(value)) {
    return (
      "[" +
      value
        .map((item) =>
          item === undefined || typeof item === "function" || typeof item === "symbol"
            ? "null"
            : canonicalizeJson(item)
        )
        .join(",") +
      "]"
    );
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(
      ([_, v]) =>
        v !== undefined && typeof v !== "function" && typeof v !== "symbol"
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return (
    "{" +
    entries
      .map(([k, v]) => JSON.stringify(k) + ":" + canonicalizeJson(v))
      .join(",") +
    "}"
  );
}

/**
 * Generate a cross-platform RFC 4122 UUID v4 (works in Node.js and Vite browser bundles).
 */
export function generateUuidV4(): string {
  const webCrypto = globalThis.crypto as
    | { randomUUID?: () => string; getRandomValues?: (arr: Uint8Array) => Uint8Array }
    | undefined;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Generate a cryptographically random lowercase hex salt (default 16 bytes = 128 bits).
 */
export function generateSaltHex(byteLength: number = 16): string {
  if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 64) {
    throw new Error("Salt length must be between 16 and 64 bytes");
  }
  const webCrypto = globalThis.crypto as
    | { getRandomValues?: (arr: Uint8Array) => Uint8Array }
    | undefined;
  const bytes =
    webCrypto && typeof webCrypto.getRandomValues === "function"
      ? webCrypto.getRandomValues(new Uint8Array(byteLength))
      : randomBytes(byteLength);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute domain-separated SHA-256 commitment for an individual claim with a random salt.
 */
export function computeSaltedClaimDigest(
  claimKey: string,
  saltHex: string,
  value: unknown
): string {
  if (!claimKey) {
    throw new Error("claimKey must be non-empty");
  }
  if (!/^[0-9a-fA-F]{32,128}$/.test(saltHex)) {
    throw new Error("saltHex must be 32-128 hex characters (16-64 bytes)");
  }
  const preimage = `skp-claim-v1:${claimKey}:${saltHex.toLowerCase()}:${canonicalizeJson(value)}`;
  return createHash("sha256").update(preimage, "utf8").digest("hex");
}

/**
 * Extract the payload of a credential that forms the cryptographic commitment (excluding the proof itself).
 * For StellarSorobanSaltedClaims2026 credentials, returns the immutable header + salted claim commitments root.
 */
export function extractCredentialPayload(
  credential: Omit<VerifiableEducationCredential, "proof"> & {
    proof?: Partial<VerifiableEducationCredential["proof"]>;
  }
): Record<string, unknown> {
  if (
    credential.proof?.type === "StellarSorobanSaltedClaims2026" &&
    credential.proof.selectiveDisclosure?.commitments
  ) {
    return {
      "@context": credential["@context"],
      id: credential.id,
      type: credential.type,
      issuer: credential.issuer,
      issuanceDate: credential.issuanceDate,
      ...(credential.expirationDate !== undefined
        ? { expirationDate: credential.expirationDate }
        : {}),
      selectiveDisclosure: {
        version: credential.proof.selectiveDisclosure.version,
        algorithm: credential.proof.selectiveDisclosure.algorithm,
        commitments: credential.proof.selectiveDisclosure.commitments,
      },
    };
  }
  const { proof: _proof, ...payload } = credential;
  return payload;
}

/**
 * Compute the SHA-256 hash of the canonical credential payload.
 * Returns a 64-character lowercase hex string.
 */
export function computeCredentialHash(
  credential: Omit<VerifiableEducationCredential, "proof"> & {
    proof?: Partial<VerifiableEducationCredential["proof"]>;
  }
): string {
  const payload = extractCredentialPayload(credential);
  const canonicalString = canonicalizeJson(payload);
  return createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

/**
 * Deterministically convert a credential URI (`urn:uuid:...` or arbitrary URI) or 64-char hex
 * into a Soroban BytesN<32> 64-character lowercase hex identifier.
 */
export function credentialIdToBytes32Hex(credentialId: string): string {
  const trimmed = credentialId.trim();
  if (!trimmed) {
    throw new Error("credentialId must be non-empty");
  }
  const cleanHex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    return cleanHex.toLowerCase();
  }
  const uuidMatch = trimmed.match(
    /^urn:uuid:([0-9a-fA-F]{8})-?([0-9a-fA-F]{4})-?([0-9a-fA-F]{4})-?([0-9a-fA-F]{4})-?([0-9a-fA-F]{12})$/i
  );
  if (uuidMatch) {
    return (uuidMatch[1] + uuidMatch[2] + uuidMatch[3] + uuidMatch[4] + uuidMatch[5])
      .toLowerCase()
      .padEnd(64, "0");
  }
  return createHash("sha256")
    .update(`skp-cred-id-v1:${trimmed}`, "utf8")
    .digest("hex");
}

/**
 * Convert a 64-char hex string to a 32-byte Uint8Array for Soroban contract interaction (BytesN<32>).
 */
export function hexToBytes32(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    throw new Error(`Expected 64-character hex string, got "${hex.slice(0, 16)}..." (length ${cleanHex.length})`);
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert a 32-byte Uint8Array to a 64-char hex string.
 */
export function bytes32ToHex(bytes: Uint8Array): string {
  if (bytes.length !== 32) {
    throw new Error(`Expected 32 bytes, got ${bytes.length}`);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
