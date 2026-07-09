/**
 * Browser-friendly sha256 helper.
 *
 * The SDK's receipt serialiser produces canonical, deep-key-sorted JSON.
 * Fingerprinting that payload is the standard "receiptId" used by the
 * receipt-cli verifier — by keeping this helper here we ensure the web UI
 * produces the exact same hex the CLI would.
 *
 * If `crypto.subtle` is unavailable (older browsers, sandboxed iframes) we
 * return `null` so the UI can degrade gracefully to "fingerprint: —".
 */

export function isSubtleCryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && crypto.subtle !== undefined;
}

export async function sha256Hex(text: string): Promise<string | null> {
  if (!isSubtleCryptoAvailable()) return null;
  const bytes = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
