// URL-hash-based permalink encoding for receipts.
//
// Strategy: pack the canonical JSON into the URL hash so verifiers stay 100%
// offline (no server required to share). Browser limits on hash length vary,
// but in practice fragments up to ~64KB are tolerated by modern browsers.
// We surface a soft warning at 4KB, which the shell prompts to share as a
// file paste instead.

const SOFT_LIMIT_BYTES = 4 * 1024;

export interface PermalinkPayload {
  /** Raw receipt JSON, exactly what the input panel would receive. */
  raw: string;
  /** Whether the link payload exceeds the soft limit. */
  oversized: boolean;
}

/** Encode raw receipt JSON into a URL-fragment payload. */
export function encodePermalink(raw: string): PermalinkPayload {
  const oversized = byteLengthUtf8(raw) > SOFT_LIMIT_BYTES;
  return { raw, oversized };
}

/** Decode a payload back into raw JSON, or null when invalid. */
export function decodePermalink(encoded: string | null | undefined): string | null {
  if (!encoded || !encoded.trim()) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/** Extract `?d=<value>` from a URL hash fragment. */
export function readDataParam(hash: string): string | null {
  if (!hash) return null;
  const queryIdx = hash.indexOf("?");
  if (queryIdx === -1) return null;
  const query = hash.slice(queryIdx + 1);
  const params = new URLSearchParams(query);
  return params.get("d");
}

export interface PermalinkUrl {
  /** Full permalink URL including origin, path, and #/verify?d=... */
  url: string;
  /** Whether the raw JSON payload exceeds the 4KB soft limit. */
  oversized: boolean;
}

/** Build a `#/verify?d=<encoded raw>`-shaped URL on the current origin. */
export function buildPermalinkUrl(raw: string): PermalinkUrl {
  const data = encodeURIComponent(raw);
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = `${base}#/verify?d=${data}`;
  const oversized = byteLengthUtf8(raw) > SOFT_LIMIT_BYTES;
  return { url, oversized };
}

/** UTF-8 byte length using the platform's TextEncoder. */
export function byteLengthUtf8(str: string): number {
  return new TextEncoder().encode(str).length;
}
