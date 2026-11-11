export const ENCRYPTED_VAULT_FORMAT = "skills-passport-encrypted-vault-v1" as const;
export const DEFAULT_PBKDF2_ITERATIONS = 150_000;
export const MIN_PBKDF2_ITERATIONS = 100_000;
export const MIN_PASSPHRASE_LENGTH = 8;

export interface EncryptedVaultEnvelope {
  format: typeof ENCRYPTED_VAULT_FORMAT;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  saltB64: string;
  cipher: "AES-256-GCM";
  ivB64: string;
  ciphertextB64: string;
  updatedAt: string;
}

const SAFE_EXTERNAL_URL_RE = /^(https?:|ipfs:)\/\//i;
const DISALLOWED_PROTOCOL_RE = /^\s*(javascript|vbscript|data):/i;

export function isSafeHttpOrIpfsUrl(value: string | undefined | null): boolean {
  if (typeof value !== "string") return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (DISALLOWED_PROTOCOL_RE.test(trimmed)) return false;
  if (!SAFE_EXTERNAL_URL_RE.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "https:" ||
        parsed.protocol === "http:" ||
        parsed.protocol === "ipfs:") &&
      trimmed.length <= 2048
    );
  } catch {
    return false;
  }
}

function getSubtleCrypto(): Crypto {
  const webCrypto = globalThis.crypto;
  if (!webCrypto || !webCrypto.subtle || typeof webCrypto.getRandomValues !== "function") {
    throw new Error("Web Crypto API (crypto.subtle) is unavailable in this environment");
  }
  return webCrypto;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveAesGcmKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const webCrypto = getSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await webCrypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return webCrypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    usage
  );
}

export function isEncryptedVaultEnvelope(
  value: unknown
): value is EncryptedVaultEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    obj.format === ENCRYPTED_VAULT_FORMAT &&
    obj.kdf === "PBKDF2-SHA256" &&
    obj.cipher === "AES-256-GCM" &&
    typeof obj.iterations === "number" &&
    typeof obj.saltB64 === "string" &&
    typeof obj.ivB64 === "string" &&
    typeof obj.ciphertextB64 === "string"
  );
}

/**
 * Encrypt arbitrary JSON-serializable vault state using PBKDF2-SHA256 + AES-256-GCM.
 */
export async function encryptVaultPayload(
  payload: unknown,
  passphrase: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS
): Promise<EncryptedVaultEnvelope> {
  if (typeof passphrase !== "string" || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `Vault passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters long`
    );
  }
  if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS) {
    throw new Error(
      `PBKDF2 iteration count must be at least ${MIN_PBKDF2_ITERATIONS}`
    );
  }

  const webCrypto = getSubtleCrypto();
  const encoder = new TextEncoder();
  const salt = webCrypto.getRandomValues(new Uint8Array(16));
  const iv = webCrypto.getRandomValues(new Uint8Array(12));

  const key = await deriveAesGcmKey(passphrase, salt, iterations, ["encrypt"]);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const aad = encoder.encode(ENCRYPTED_VAULT_FORMAT);

  const encrypted = await webCrypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(aad),
    },
    key,
    plaintext
  );

  return {
    format: ENCRYPTED_VAULT_FORMAT,
    kdf: "PBKDF2-SHA256",
    iterations,
    saltB64: bytesToBase64(salt),
    cipher: "AES-256-GCM",
    ivB64: bytesToBase64(iv),
    ciphertextB64: bytesToBase64(new Uint8Array(encrypted)),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Decrypt an encrypted vault envelope using the caller's passphrase.
 * Rejects wrong passphrases or tampered ciphertext via AES-GCM tag verification.
 */
export async function decryptVaultPayload<T = unknown>(
  envelope: EncryptedVaultEnvelope,
  passphrase: string
): Promise<T> {
  if (!isEncryptedVaultEnvelope(envelope)) {
    throw new Error("Unsupported or malformed encrypted vault envelope");
  }
  if (envelope.iterations < MIN_PBKDF2_ITERATIONS) {
    throw new Error(
      `Refusing weak PBKDF2 iteration count (${envelope.iterations} < ${MIN_PBKDF2_ITERATIONS})`
    );
  }
  if (typeof passphrase !== "string" || passphrase.length === 0) {
    throw new Error("Passphrase is required to unlock encrypted vault");
  }

  const webCrypto = getSubtleCrypto();
  const salt = base64ToBytes(envelope.saltB64);
  const iv = base64ToBytes(envelope.ivB64);
  const ciphertext = base64ToBytes(envelope.ciphertextB64);

  if (salt.length < 16 || iv.length !== 12 || ciphertext.length < 16) {
    throw new Error("Malformed encrypted vault salt, IV, or ciphertext length");
  }

  const key = await deriveAesGcmKey(passphrase, salt, envelope.iterations, [
    "decrypt",
  ]);
  const aad = new TextEncoder().encode(ENCRYPTED_VAULT_FORMAT);

  let plaintextBuf: ArrayBuffer;
  try {
    plaintextBuf = await webCrypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(aad),
      },
      key,
      toArrayBuffer(ciphertext)
    );
  } catch {
    throw new Error("Failed to decrypt vault: wrong passphrase or tampered data");
  }

  const json = new TextDecoder().decode(plaintextBuf);
  return parseSafeVaultJson<T>(json);
}

export function assertNoPrototypePollution(value: unknown, depth = 0): void {
  if (depth > 32 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoPrototypePollution(item, depth + 1);
    }
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(`Rejected forbidden key '${key}' in vault JSON payload`);
    }
    assertNoPrototypePollution(obj[key], depth + 1);
  }
}

export function parseSafeVaultJson<T = unknown>(rawJson: string): T {
  // Inspect raw JSON text for __proto__/constructor property keys (Object.keys skips "__proto__" in V8)
  const parsed = JSON.parse(rawJson, (key, val) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(`Rejected forbidden key '${key}' in vault JSON payload`);
    }
    return val;
  });
  assertNoPrototypePollution(parsed);
  return parsed as T;
}
