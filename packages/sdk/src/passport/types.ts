export type CredentialType =
  | "DegreeCredential"
  | "CertificateCredential"
  | "SkillBadgeCredential"
  | "CourseCompletionCredential"
  | "ProfessionalLicenseCredential";

export interface IssuerIdentity {
  id: string; // e.g. "did:stellar:G..."
  name: string;
  url?: string;
  metadataUri?: string;
}

export interface CredentialSubject {
  id: string; // "did:stellar:G..."
  recipientAddress?: string;
  recipientName?: string;
  title: string;
  institution: string;
  skills: string[];
  grade?: string;
  achievementDescription: string;
  evidenceUri?: string;
  customFields?: Record<string, unknown>;
}

export type PassportProofType =
  | "StellarSorobanHashCommitment2026"
  | "StellarSorobanSaltedClaims2026"
  | "DataIntegrityProof";

export interface SaltedClaimEntry {
  /** 32-char lowercase hex (16 random bytes) protecting hidden/disclosed claims from dictionary guessing */
  salt: string;
  value: unknown;
}

export interface SaltedDisclosureData {
  version: 1;
  algorithm: "sha256-jcs-salted-v1";
  /** Map of claim key (e.g. "recipientName", "grade", "skill:0") to 64-char hex salted SHA-256 digest */
  commitments: Record<string, string>;
  /** Disclosed claim plaintexts + salts; omitted keys remain hidden behind their opaque commitments */
  disclosed: Record<string, SaltedClaimEntry>;
}

export interface CredentialProof {
  type: PassportProofType;
  created: string;
  verificationMethod: string;
  proofPurpose: "assertionMethod";
  credentialHash: string; // 64-char hex SHA-256
  contractId?: string;
  stellarNetwork?: string;
  /** Optional W3C Data Integrity cryptosuite (e.g. "eddsa-jcs-2022") */
  cryptosuite?: string;
  /** Optional multibase/base64url Ed25519 signature value for W3C DataIntegrityProof */
  proofValue?: string;
  /** Optional salted claim commitment bundle enabling verifiable attribute-level selective disclosure */
  selectiveDisclosure?: SaltedDisclosureData;
}

export interface VerifiableEducationCredential {
  "@context": string[];
  id: string; // "urn:uuid:..." or "urn:stellar:cred:..."
  type: ["VerifiableCredential", CredentialType] | string[];
  issuer: IssuerIdentity;
  issuanceDate: string; // ISO 8601
  expirationDate?: string; // ISO 8601
  credentialSubject: CredentialSubject;
  proof: CredentialProof;
}

export type OnChainCredentialStatus = "Active" | "Revoked" | "Suspended";

export interface OnChainCredentialRecord {
  credentialId: string; // 64-char hex (BytesN<32>)
  issuer: string; // Stellar address (G...)
  recipient: string; // Stellar address (G...)
  credentialHash: string; // 64-char hex SHA-256
  templateId: string;
  issuedAt: number; // Unix timestamp in seconds
  expiresAt?: number; // Unix timestamp in seconds
  status: OnChainCredentialStatus;
  revocationReason?: string;
  issuerAuthorized?: boolean;
}

export interface VerificationDiagnostic {
  isValid: boolean;
  tampered: boolean;
  expired: boolean;
  revoked: boolean;
  suspended: boolean;
  untrustedIssuer: boolean;
  status: "valid" | "expired" | "revoked" | "suspended" | "untrusted" | "tampered" | "unverifiable";
  calculatedHash: string;
  claimedHash: string;
  errors: string[];
  warnings?: string[];
  evidence: {
    hashMatched: boolean;
    issuerAuthorized: boolean;
    statusActive: boolean;
    notExpired: boolean;
    issuerAddress: string;
    recipientAddress: string;
    issuedAt: string;
    expiresAt?: string;
    disclosedClaims?: string[];
    hiddenClaimsCount?: number;
    w3cSchemaValid?: boolean;
    dataIntegrityVerified?: boolean;
  };
}

export interface SharePrivacyReport {
  mode: "anchor" | "payload" | "unknown";
  usesFragmentOnly: boolean;
  containsPiiInUrl: boolean;
  exposedUrlFields: string[];
  warnings: string[];
}

export interface CredentialSharePackage {
  version: 1;
  sharedAt: string;
  credential: VerifiableEducationCredential;
  verificationUrl?: string;
  qrPayload: string;
  privacyReport?: SharePrivacyReport;
}
