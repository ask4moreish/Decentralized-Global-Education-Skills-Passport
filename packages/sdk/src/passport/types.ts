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
  recipientAddress: string;
  recipientName?: string;
  title: string;
  institution: string;
  skills: string[];
  grade?: string;
  achievementDescription: string;
  evidenceUri?: string;
  customFields?: Record<string, unknown>;
}

export interface CredentialProof {
  type: "StellarSorobanHashCommitment2026";
  created: string;
  verificationMethod: string;
  proofPurpose: "assertionMethod";
  credentialHash: string; // 64-char hex SHA-256
  contractId?: string;
  stellarNetwork?: string;
}

export interface VerifiableEducationCredential {
  "@context": string[];
  id: string; // "urn:uuid:..." or "urn:stellar:cred:..."
  type: ["VerifiableCredential", CredentialType];
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
  evidence: {
    hashMatched: boolean;
    issuerAuthorized: boolean;
    statusActive: boolean;
    notExpired: boolean;
    issuerAddress: string;
    recipientAddress: string;
    issuedAt: string;
    expiresAt?: string;
  };
}

export interface CredentialSharePackage {
  version: 1;
  sharedAt: string;
  credential: VerifiableEducationCredential;
  verificationUrl?: string;
  qrPayload: string;
}
