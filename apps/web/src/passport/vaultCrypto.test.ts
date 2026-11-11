import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ENCRYPTED_VAULT_FORMAT,
  decryptVaultPayload,
  encryptVaultPayload,
  isEncryptedVaultEnvelope,
  isSafeHttpOrIpfsUrl,
} from "./vaultCrypto.js";
import {
  DEMO_ISSUERS,
  ENCRYPTED_VAULT_STORAGE_KEY,
  clearDemoPassportStorage,
  hasEncryptedVault,
  importEncryptedVaultJson,
  initializeSeedCredentials,
  loadStoredCredentials,
  saveEncryptedVault,
  unlockEncryptedVault,
} from "./passportState.js";

describe("Frontend Encrypted Vault & Security Controls", () => {
  const mockStorage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = val;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(mockStorage)) {
        delete mockStorage[k];
      }
    },
  };

  beforeEach(() => {
    (globalThis as any).localStorage = mockLocalStorage;
    mockLocalStorage.clear();
  });

  it("encrypts and decrypts vault payloads using PBKDF2-SHA256 + AES-256-GCM", async () => {
    const secret = { credentialTitle: "MSc Distributed Systems", grade: "Distinction" };
    const envelope = await encryptVaultPayload(secret, "CorrectHorseBattery9!");

    assert.equal(envelope.format, ENCRYPTED_VAULT_FORMAT);
    assert.equal(envelope.kdf, "PBKDF2-SHA256");
    assert.equal(envelope.cipher, "AES-256-GCM");
    assert.ok(envelope.iterations >= 100_000);
    assert.equal(isEncryptedVaultEnvelope(envelope), true);

    // Ciphertext must not leak plaintext claims
    const rawEnvelope = JSON.stringify(envelope);
    assert.equal(rawEnvelope.includes("MSc Distributed Systems"), false);
    assert.equal(rawEnvelope.includes("CorrectHorseBattery9!"), false);

    const decrypted = await decryptVaultPayload<typeof secret>(
      envelope,
      "CorrectHorseBattery9!"
    );
    assert.deepEqual(decrypted, secret);
  });

  it("rejects wrong passphrases, tampered ciphertexts, weak passphrases, and lowered PBKDF2 work factors", async () => {
    await assert.rejects(
      () => encryptVaultPayload({ a: 1 }, "short"),
      /at least 8 characters/
    );
    await assert.rejects(
      () => encryptVaultPayload({ a: 1 }, "ValidPassphrase123!", 1000),
      /at least 100000/
    );

    const envelope = await encryptVaultPayload(
      { claim: "sensitive" },
      "StrongPassphrase!2026"
    );

    await assert.rejects(
      () => decryptVaultPayload(envelope, "WrongPassphrase!2026"),
      /wrong passphrase or tampered/
    );

    // Mutate one byte of ciphertextB64
    const buf = Buffer.from(envelope.ciphertextB64, "base64");
    buf[0] ^= 0xff;
    const tamperedCiphertext = {
      ...envelope,
      ciphertextB64: buf.toString("base64"),
    };
    await assert.rejects(
      () => decryptVaultPayload(tamperedCiphertext, "StrongPassphrase!2026"),
      /wrong passphrase or tampered/
    );

    // Downgraded iteration attack rejected
    await assert.rejects(
      () =>
        decryptVaultPayload(
          { ...envelope, iterations: 5000 },
          "StrongPassphrase!2026"
        ),
      /weak PBKDF2/
    );
  });

  it("scrubs plaintext localStorage once encrypted vault is saved and restores from backup JSON", async () => {
    // Initialize demo seed -> populates plaintext localStorage
    const seeded = loadStoredCredentials();
    assert.ok(mockStorage["skills_passport_credentials_v1"]);
    assert.equal(hasEncryptedVault(), false);

    // Encrypt vault -> removes plaintext storage keys and writes encrypted envelope
    const envelope = await saveEncryptedVault(
      seeded,
      DEMO_ISSUERS,
      "LearnerVaultPass!2026"
    );
    assert.equal(hasEncryptedVault(), true);
    assert.equal(mockStorage["skills_passport_credentials_v1"], undefined);
    assert.equal(mockStorage["skills_passport_issuers_v1"], undefined);
    assert.ok(mockStorage[ENCRYPTED_VAULT_STORAGE_KEY]);
    assert.equal(
      mockStorage[ENCRYPTED_VAULT_STORAGE_KEY].includes("Elena Rostova"),
      false
    );

    const unlocked = await unlockEncryptedVault("LearnerVaultPass!2026");
    assert.equal(unlocked.credentials.length, seeded.length);
    assert.equal(unlocked.issuers.length, DEMO_ISSUERS.length);

    // Wipe browser storage then import backup JSON
    clearDemoPassportStorage();
    assert.equal(hasEncryptedVault(), false);

    const restored = await importEncryptedVaultJson(
      JSON.stringify(envelope),
      "LearnerVaultPass!2026"
    );
    assert.equal(restored.credentials.length, seeded.length);
    assert.equal(hasEncryptedVault(), true);
  });

  it("enforces safe external URI validation against javascript/data/vbscript XSS schemes", () => {
    assert.equal(isSafeHttpOrIpfsUrl("https://mit.edu/accreditation.json"), true);
    assert.equal(isSafeHttpOrIpfsUrl("ipfs://QmTestHash123"), true);
    assert.equal(isSafeHttpOrIpfsUrl("http://localhost:5173"), true);

    assert.equal(isSafeHttpOrIpfsUrl("javascript:alert(document.cookie)"), false);
    assert.equal(isSafeHttpOrIpfsUrl("  JAVASCRIPT:alert(1)"), false);
    assert.equal(isSafeHttpOrIpfsUrl("data:text/html,<script>alert(1)</script>"), false);
    assert.equal(isSafeHttpOrIpfsUrl("vbscript:msgbox(1)"), false);
    assert.equal(isSafeHttpOrIpfsUrl("https://evil.com\n"), false);
  });

  it("ensures seed credentials use valid checksummed Stellar StrKey addresses", () => {
    const seeds = initializeSeedCredentials();
    assert.ok(seeds.length >= 5);
    for (const item of seeds) {
      assert.match(item.onChain.issuer, /^G[A-Z2-7]{55}$/);
      assert.match(item.onChain.recipient, /^G[A-Z2-7]{55}$/);
    }
  });

  it("never recreates plaintext localStorage once an encrypted vault is enabled and rejects polluted backup JSON", async () => {
    const {
      loadStoredIssuers,
      saveStoredCredentials,
      saveStoredIssuers,
    } = await import("./passportState.js");
    const seeded = loadStoredCredentials();
    await saveEncryptedVault(seeded, DEMO_ISSUERS, "StrongVaultKey!2026");

    // Calling demo loader/saver methods after encryption must not write plaintext keys back
    loadStoredCredentials();
    loadStoredIssuers();
    saveStoredCredentials(seeded);
    saveStoredIssuers(DEMO_ISSUERS);

    assert.equal(mockStorage["skills_passport_credentials_v1"], undefined);
    assert.equal(mockStorage["skills_passport_issuers_v1"], undefined);
    assert.ok(mockStorage[ENCRYPTED_VAULT_STORAGE_KEY]);

    // Prototype-pollution backup JSON must be rejected before decryption
    const pollutedJson = '{"__proto__":{"admin":true},"format":"skills-passport-encrypted-vault-v1"}';
    await assert.rejects(
      () => importEncryptedVaultJson(pollutedJson, "StrongVaultKey!2026"),
      /forbidden key '__proto__'/
    );
  });
});
