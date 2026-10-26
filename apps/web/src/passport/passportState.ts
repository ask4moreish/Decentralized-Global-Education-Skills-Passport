import {
  createVerifiableCredential,
  type OnChainCredentialRecord,
  type VerifiableEducationCredential,
} from "skills-passport-sdk";

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
    address: "GBDEVWLZZK5XMNJ2UHKX72ZAKNZP37Z8NVBL345NMQXLP081274BZXYZ",
    name: "Stellar Developer Academy",
    metadataUri: "https://stellar.org/academy/verification",
    isAuthorized: true,
    registeredAt: 1709251200,
  },
  {
    address: "GCSTANFORDZ9103857Z02837501938570283750193857028375019385",
    name: "Stanford Center for Blockchain Research",
    metadataUri: "https://cbr.stanford.edu/credentials",
    isAuthorized: true,
    registeredAt: 1711929600,
  },
  {
    address: "GDROGUE999999999999999999999999999999999999999999999999999",
    name: "Unaccredited Online Diploma Mill",
    metadataUri: "https://fake-diplomas.example.com",
    isAuthorized: false, // Unauthorized!
    registeredAt: 1714521600,
  },
];

export const DEMO_LEARNERS = [
  {
    address: "GBZXN7PIRZGNMHGA728DJNVH3189031ZXCBNM91048NZX891048NZ104",
    name: "Elena Rostova",
    did: "did:stellar:GBZXN7PIRZGNMHGA728DJNVH3189031ZXCBNM91048NZX891048NZ104",
    role: "Senior Distributed Systems Engineer",
  },
  {
    address: "GCALEX991048591038571029384719283740192837401928374019283",
    name: "Alexandre Moreau",
    did: "did:stellar:GCALEX9910485910385710293847192837401928374019283",
    role: "Soroban Protocol Researcher",
  },
];

export interface StoredCredentialItem {
  vc: VerifiableEducationCredential;
  onChain: OnChainCredentialRecord;
}

const STORAGE_KEY = "skills_passport_credentials_v1";
const ISSUERS_STORAGE_KEY = "skills_passport_issuers_v1";

function initializeSeedCredentials(): StoredCredentialItem[] {
  const learner = DEMO_LEARNERS[0];
  const mit = DEMO_ISSUERS[0];
  const stellarAcad = DEMO_ISSUERS[1];
  const stanford = DEMO_ISSUERS[2];

  // 1. Degree
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
    contractId: "CDSPASSPORTREGISTRY2026STELLARGLOBALTESTNETKEY",
  });

  const degreeOnChain: OnChainCredentialRecord = {
    credentialId: degreeVc.id.replace("urn:uuid:", "").replace(/-/g, "").padEnd(64, "0").slice(0, 64),
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
    contractId: "CDSPASSPORTREGISTRY2026STELLARGLOBALTESTNETKEY",
  });

  const sorobanOnChain: OnChainCredentialRecord = {
    credentialId: sorobanVc.id.replace("urn:uuid:", "").replace(/-/g, "").padEnd(64, "0").slice(0, 64),
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
    contractId: "CDSPASSPORTREGISTRY2026STELLARGLOBALTESTNETKEY",
  });

  const cryptoOnChain: OnChainCredentialRecord = {
    credentialId: cryptoVc.id.replace("urn:uuid:", "").replace(/-/g, "").padEnd(64, "0").slice(0, 64),
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
  });

  const revokedOnChain: OnChainCredentialRecord = {
    credentialId: revokedVc.id.replace("urn:uuid:", "").replace(/-/g, "").padEnd(64, "0").slice(0, 64),
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
  });

  const expiredOnChain: OnChainCredentialRecord = {
    credentialId: expiredVc.id.replace("urn:uuid:", "").replace(/-/g, "").padEnd(64, "0").slice(0, 64),
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = initializeSeedCredentials();
      saveStoredCredentials(seed);
      return seed;
    }
    return JSON.parse(raw) as StoredCredentialItem[];
  } catch {
    return initializeSeedCredentials();
  }
}

export function saveStoredCredentials(items: StoredCredentialItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error("Failed to save credentials to localStorage", err);
  }
}

export function loadStoredIssuers(): IssuerProfile[] {
  try {
    const raw = localStorage.getItem(ISSUERS_STORAGE_KEY);
    if (!raw) {
      saveStoredIssuers(DEMO_ISSUERS);
      return DEMO_ISSUERS;
    }
    return JSON.parse(raw) as IssuerProfile[];
  } catch {
    return DEMO_ISSUERS;
  }
}

export function saveStoredIssuers(issuers: IssuerProfile[]): void {
  try {
    localStorage.setItem(ISSUERS_STORAGE_KEY, JSON.stringify(issuers));
  } catch (err) {
    console.error("Failed to save issuers to localStorage", err);
  }
}
