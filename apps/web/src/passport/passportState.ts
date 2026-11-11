import {
  createVerifiableCredential,
  credentialIdToBytes32Hex,
  type OnChainCredentialRecord,
  type VerifiableEducationCredential,
} from "skills-passport-sdk";
import {
  decryptVaultPayload,
  encryptVaultPayload,
  isEncryptedVaultEnvelope,
  parseSafeVaultJson,
  type EncryptedVaultEnvelope,
} from "./vaultCrypto";

const envVars = (import.meta as { env?: Record<string, string | undefined> })
  .env;

export const DEFAULT_PASSPORT_CONTRACT_ID =
  envVars?.VITE_PASSPORT_CONTRACT_ID ||
  "CDDP5OJDNOWD5QUIFVLQ6CFTUS72KGOOCLEVJTDPNJDIDOPFIMQ36OF2";
export const DEFAULT_PASSPORT_RPC_URL =
  envVars?.VITE_RPC_URL || "https://soroban-testnet.stellar.org";
export const DEFAULT_PASSPORT_NETWORK_PASSPHRASE =
  envVars?.VITE_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";

export interface IssuerProfile {
  address: string;
  name: string;
  metadataUri: string;
  isAuthorized: boolean;
  registeredAt: number;
}

export const DEMO_ISSUERS: IssuerProfile[] = [
  {
    address: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
    name: "MIT Digital Credentials Institute",
    metadataUri: "https://mit.edu/credentials/accreditation.json",
    isAuthorized: true,
    registeredAt: 1704067200,
  },
  {
    address: "GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR",
    name: "Stellar Developer Academy",
    metadataUri: "https://stellar.org/academy/verification",
    isAuthorized: true,
    registeredAt: 1709251200,
  },
  {
    address: "GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U",
    name: "Stanford Center for Blockchain Research",
    metadataUri: "https://cbr.stanford.edu/credentials",
    isAuthorized: true,
    registeredAt: 1711929600,
  },
  {
    address: "GDWUSKGGFDI4FRXK5EBTRECZSVQSSWJHHJOGH6JWG3AUMFFMQ435DIAG",
    name: "Unaccredited Online Diploma Mill",
    metadataUri: "https://fake-diplomas.example.com",
    isAuthorized: false, // Unauthorized!
    registeredAt: 1714521600,
  },
];

export const DEMO_LEARNERS = [
  {
    address: "GDFJHLAXAUMHA4OWPOB4P7YO72AQR2HMIUYFOXLXE2DZGM633K7HZDQP",
    name: "Elena Rostova",
    did: "did:stellar:GDFJHLAXAUMHA4OWPOB4P7YO72AQR2HMIUYFOXLXE2DZGM633K7HZDQP",
    role: "Senior Distributed Systems Engineer",
  },
  {
    address: "GBXHUHG5FGYLPD6RHL2MKWMP572O6KUXCZXDZJXS4T57ZTMAKBN7DWXN",
    name: "Alexandre Moreau",
    did: "did:stellar:GBXHUHG5FGYLPD6RHL2MKWMP572O6KUXCZXDZJXS4T57ZTMAKBN7DWXN",
    role: "Soroban Protocol Researcher",
  },
];

export interface StoredCredentialItem {
  vc: VerifiableEducationCredential;
  onChain: OnChainCredentialRecord;
}

export interface EncryptedVaultBundle {
  version: 1;
  credentials: StoredCredentialItem[];
  issuers: IssuerProfile[];
}

const STORAGE_KEY = "skills_passport_credentials_v1";
const ISSUERS_STORAGE_KEY = "skills_passport_issuers_v1";
export const ENCRYPTED_VAULT_STORAGE_KEY = "skills_passport_encrypted_vault_v1";

export function initializeSeedCredentials(): StoredCredentialItem[] {
  const learner = DEMO_LEARNERS[0];
  const mit = DEMO_ISSUERS[0];
  const stellarAcad = DEMO_ISSUERS[1];
  const stanford = DEMO_ISSUERS[2];

  // 1. Degree (with salted selective disclosure support)
  const degreeVc = createVerifiableCredential({
    credentialType: "DegreeCredential",
    issuer: {
      address: mit.address,
      name: mit.name,
      url: "https://mit.edu",
    },
    recipient: {
      address: learner.address,
      name: learner.name,
    },
    title: "Bachelor of Science in Computer Science & Distributed Systems",
    institution: "Massachusetts Institute of Technology",
    skills: ["Algorithms", "Distributed Systems", "Rust", "Network Protocols", "Applied Cryptography"],
    grade: "Summa Cum Laude (GPA 4.0)",
    achievementDescription:
      "Conferred with highest departmental honors for exceptional research in fault-tolerant consensus systems.",
    contractId: DEFAULT_PASSPORT_CONTRACT_ID,
    selectiveDisclosure: true,
  });

  const degreeOnChain: OnChainCredentialRecord = {
    credentialId: credentialIdToBytes32Hex(degreeVc.id),
    issuer: mit.address,
    recipient: learner.address,
    credentialHash: degreeVc.proof.credentialHash,
    templateId: "Degree",
    issuedAt: Math.floor(Date.parse(degreeVc.issuanceDate) / 1000),
    status: "Active",
    issuerAuthorized: true,
  };

  // 2. Soroban Certification
  const sorobanVc = createVerifiableCredential({
    credentialType: "CertificateCredential",
    issuer: {
      address: stellarAcad.address,
      name: stellarAcad.name,
      url: "https://stellar.org/academy",
    },
    recipient: {
      address: learner.address,
      name: learner.name,
    },
    title: "Certified Soroban Smart Contract Architect",
    institution: "Stellar Developer Academy",
    skills: ["Soroban SDK", "Rust", "SAC Integration", "Formal Verification", "DeFi Architecture"],
    grade: "Mastery Level (Score 98%)",
    achievementDescription:
      "Passed rigorous hands-on audit and contract deployment assessment for Protocol 22+ production standards.",
    contractId: DEFAULT_PASSPORT_CONTRACT_ID,
    selectiveDisclosure: true,
  });

  const sorobanOnChain: OnChainCredentialRecord = {
    credentialId: credentialIdToBytes32Hex(sorobanVc.id),
    issuer: stellarAcad.address,
    recipient: learner.address,
    credentialHash: sorobanVc.proof.credentialHash,
    templateId: "Certificate",
    issuedAt: Math.floor(Date.parse(sorobanVc.issuanceDate) / 1000),
    status: "Active",
    issuerAuthorized: true,
  };

  // 3. Cryptography Skill Badge
  const cryptoVc = createVerifiableCredential({
    credentialType: "SkillBadgeCredential",
    issuer: {
      address: stanford.address,
      name: stanford.name,
      url: "https://cbr.stanford.edu",
    },
    recipient: {
      address: learner.address,
      name: learner.name,
    },
    title: "BLS12-381 & Timelock Encryption Specialist",
    institution: "Stanford Center for Blockchain Research",
    skills: ["BLS Signatures", "Drand Quicknet", "Threshold Encryption", "tlock"],
    achievementDescription:
      "Demonstrated end-to-end integration of verifiable delay and non-interactive threshold encryption in distributed applications.",
    contractId: DEFAULT_PASSPORT_CONTRACT_ID,
    selectiveDisclosure: true,
  });

  const cryptoOnChain: OnChainCredentialRecord = {
    credentialId: credentialIdToBytes32Hex(cryptoVc.id),
    issuer: stanford.address,
    recipient: learner.address,
    credentialHash: cryptoVc.proof.credentialHash,
    templateId: "SkillBadge",
    issuedAt: Math.floor(Date.parse(cryptoVc.issuanceDate) / 1000),
    status: "Active",
    issuerAuthorized: true,
  };

  // 4. Revoked Security License (for testing revocation detection)
  const revokedVc = createVerifiableCredential({
    credentialType: "ProfessionalLicenseCredential",
    issuer: {
      address: mit.address,
      name: mit.name,
    },
    recipient: {
      address: learner.address,
      name: learner.name,
    },
    title: "Lead Systems Auditor License",
    institution: "Global Security Accreditation Council",
    skills: ["Penetration Testing", "Audit Certification"],
    achievementDescription: "Accredited auditor license (revoked for test case).",
    contractId: DEFAULT_PASSPORT_CONTRACT_ID,
    selectiveDisclosure: true,
  });

  const revokedOnChain: OnChainCredentialRecord = {
    credentialId: credentialIdToBytes32Hex(revokedVc.id),
    issuer: mit.address,
    recipient: learner.address,
    credentialHash: revokedVc.proof.credentialHash,
    templateId: "License",
    issuedAt: Math.floor(Date.now() / 1000) - 864000,
    status: "Revoked",
    revocationReason: "License revoked following administrative audit update (SEC-REF-2026-901)",
    issuerAuthorized: true,
  };

  // 5. Expired Certificate (for testing expiry detection)
  const expiredDate = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const expiredVc = createVerifiableCredential({
    credentialType: "CourseCompletionCredential",
    issuer: {
      address: stellarAcad.address,
      name: stellarAcad.name,
    },
    recipient: {
      address: learner.address,
      name: learner.name,
    },
    title: "First Responder Digital Safety Certificate",
    institution: "Stellar Academy",
    skills: ["Incident Response", "Key Management"],
    achievementDescription: "Annual re-certification required.",
    expirationDate: expiredDate,
    contractId: DEFAULT_PASSPORT_CONTRACT_ID,
    selectiveDisclosure: true,
  });

  const expiredOnChain: OnChainCredentialRecord = {
    credentialId: credentialIdToBytes32Hex(expiredVc.id),
    issuer: stellarAcad.address,
    recipient: learner.address,
    credentialHash: expiredVc.proof.credentialHash,
    templateId: "CourseCompletion",
    issuedAt: Math.floor(Date.now() / 1000) - 400 * 86400,
    expiresAt: Math.floor(Date.parse(expiredDate) / 1000),
    status: "Active",
    issuerAuthorized: true,
  };

  return [
    { vc: degreeVc, onChain: degreeOnChain },
    { vc: sorobanVc, onChain: sorobanOnChain },
    { vc: cryptoVc, onChain: cryptoOnChain },
    { vc: revokedVc, onChain: revokedOnChain },
    { vc: expiredVc, onChain: expiredOnChain },
  ];
}

export function loadStoredCredentials(): StoredCredentialItem[] {
  try {
    if (typeof localStorage === "undefined") {
      return initializeSeedCredentials();
    }
    if (hasEncryptedVault()) {
      // Encrypted vault is active: never recreate plaintext seed storage
      return initializeSeedCredentials();
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = initializeSeedCredentials();
      saveStoredCredentials(seed);
      return seed;
    }
    const parsed = parseSafeVaultJson(raw);
    return Array.isArray(parsed)
      ? (parsed as StoredCredentialItem[])
      : initializeSeedCredentials();
  } catch {
    return initializeSeedCredentials();
  }
}

export function saveStoredCredentials(items: StoredCredentialItem[]): void {
  try {
    if (typeof localStorage !== "undefined" && !hasEncryptedVault()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  } catch (err) {
    console.error("Failed to save credentials to localStorage", err);
  }
}

export function loadStoredIssuers(): IssuerProfile[] {
  try {
    if (typeof localStorage === "undefined") {
      return DEMO_ISSUERS;
    }
    if (hasEncryptedVault()) {
      // Encrypted vault is active: return in-memory demo profiles without writing plaintext storage
      return DEMO_ISSUERS;
    }
    const raw = localStorage.getItem(ISSUERS_STORAGE_KEY);
    if (!raw) {
      saveStoredIssuers(DEMO_ISSUERS);
      return DEMO_ISSUERS;
    }
    const parsed = parseSafeVaultJson(raw);
    return Array.isArray(parsed) ? (parsed as IssuerProfile[]) : DEMO_ISSUERS;
  } catch {
    return DEMO_ISSUERS;
  }
}

export function saveStoredIssuers(issuers: IssuerProfile[]): void {
  try {
    if (typeof localStorage !== "undefined" && !hasEncryptedVault()) {
      localStorage.setItem(ISSUERS_STORAGE_KEY, JSON.stringify(issuers));
    }
  } catch (err) {
    console.error("Failed to save issuers to localStorage", err);
  }
}

export function hasEncryptedVault(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ENCRYPTED_VAULT_STORAGE_KEY) !== null;
}

export async function saveEncryptedVault(
  credentials: StoredCredentialItem[],
  issuers: IssuerProfile[],
  passphrase: string
): Promise<EncryptedVaultEnvelope> {
  const bundle: EncryptedVaultBundle = {
    version: 1,
    credentials,
    issuers,
  };
  const envelope = await encryptVaultPayload(bundle, passphrase);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(ENCRYPTED_VAULT_STORAGE_KEY, JSON.stringify(envelope));
    // Scrub unencrypted demo cache once vault encryption is enabled
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ISSUERS_STORAGE_KEY);
  }
  return envelope;
}

export async function unlockEncryptedVault(
  passphrase: string
): Promise<EncryptedVaultBundle> {
  if (typeof localStorage === "undefined") {
    throw new Error("Browser localStorage is unavailable");
  }
  const raw = localStorage.getItem(ENCRYPTED_VAULT_STORAGE_KEY);
  if (!raw) {
    throw new Error("No encrypted passport vault found in this browser");
  }
  const envelope = parseSafeVaultJson<unknown>(raw);
  if (!isEncryptedVaultEnvelope(envelope)) {
    throw new Error("Stored vault data is corrupted or unrecognized");
  }
  const decrypted = await decryptVaultPayload<EncryptedVaultBundle>(
    envelope,
    passphrase
  );
  if (
    !decrypted ||
    decrypted.version !== 1 ||
    !Array.isArray(decrypted.credentials) ||
    !Array.isArray(decrypted.issuers)
  ) {
    throw new Error("Decrypted vault payload failed schema check");
  }
  return decrypted;
}

export async function importEncryptedVaultJson(
  rawJson: string,
  passphrase: string
): Promise<EncryptedVaultBundle> {
  const envelope = parseSafeVaultJson<unknown>(rawJson);
  if (!isEncryptedVaultEnvelope(envelope)) {
    throw new Error("Backup file is not a valid skills-passport encrypted vault");
  }
  const decrypted = await decryptVaultPayload<EncryptedVaultBundle>(
    envelope,
    passphrase
  );
  if (
    !decrypted ||
    decrypted.version !== 1 ||
    !Array.isArray(decrypted.credentials) ||
    !Array.isArray(decrypted.issuers)
  ) {
    throw new Error("Decrypted backup failed passport vault schema validation");
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(ENCRYPTED_VAULT_STORAGE_KEY, JSON.stringify(envelope));
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ISSUERS_STORAGE_KEY);
  }
  return decrypted;
}

export function clearDemoPassportStorage(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ISSUERS_STORAGE_KEY);
    localStorage.removeItem(ENCRYPTED_VAULT_STORAGE_KEY);
  }
}
