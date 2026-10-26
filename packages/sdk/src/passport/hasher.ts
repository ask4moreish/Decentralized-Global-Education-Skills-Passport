import { createHash } from "node:crypto";
import type { VerifiableEducationCredential } from "./types.js";

/**
 * Deterministically sort and canonicalize JSON values according to RFC 8785 (JCS principles).
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalizeJson(item)).join(",") + "]";
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([_, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    "{" +
    entries
      .map(([k, v]) => JSON.stringify(k) + ":" + canonicalizeJson(v))
      .join(",") +
    "}"
  );
}

/**
 * Extract the payload of a credential that forms the cryptographic commitment (excluding the proof itself).
 */
export function extractCredentialPayload(
  credential: Omit<VerifiableEducationCredential, "proof"> & { proof?: unknown }
): Record<string, unknown> {
  const { proof: _proof, ...payload } = credential;
  return payload;
}

/**
 * Compute the SHA-256 hash of the canonical credential payload.
 * Returns a 64-character lowercase hex string.
 */
export function computeCredentialHash(
  credential: Omit<VerifiableEducationCredential, "proof"> & { proof?: unknown }
): string {
  const payload = extractCredentialPayload(credential);
  const canonicalString = canonicalizeJson(payload);
  return createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

/**
 * Convert a 64-char hex string to a 32-byte Uint8Array for Soroban contract interaction (BytesN<32>).
 */
export function hexToBytes32(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleanHex.length !== 64) {
    throw new Error(`Expected 64-character hex string, got ${cleanHex.length}`);
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
