import {
  computeCredentialHash,
  computeSaltedClaimDigest,
  generateSaltHex,
  generateUuidV4,
} from "./hasher.js";
import type {
  CredentialSubject,
  CredentialType,
  IssuerIdentity,
  SaltedDisclosureData,
  VerifiableEducationCredential,
} from "./types.js";

export interface CreateCredentialInput {
  credentialType: CredentialType;
  issuer: {
    address: string; // Stellar public key
    name: string;
    url?: string;
    metadataUri?: string;
  };
  recipient: {
    address: string; // Stellar public key
    name?: string;
  };
  title: string;
  institution: string;
  skills: string[];
  grade?: string;
  achievementDescription: string;
  evidenceUri?: string;
  customFields?: Record<string, unknown>;
  expirationDate?: string;
  contractId?: string;
  stellarNetwork?: string;
  credentialId?: string;
  /** When true, issues with per-claim salted SHA-256 commitments (StellarSorobanSaltedClaims2026) so redacted views still verify against the on-chain root hash. */
  selectiveDisclosure?: boolean;
}

const DISALLOWED_URI_SCHEME_RE = /^\s*(javascript|vbscript|data):/i;

function assertSafeOptionalUri(value: string | undefined, fieldName: string): void {
  if (value !== undefined && DISALLOWED_URI_SCHEME_RE.test(value)) {
    throw new Error(`Unsafe URI scheme in ${fieldName}`);
  }
}

function buildSaltedDisclosureData(subject: CredentialSubject): SaltedDisclosureData {
  const commitments: Record<string, string> = {};
  const disclosed: SaltedDisclosureData["disclosed"] = {};

  const scalarFields: Array<keyof CredentialSubject> = [
    "id",
    "recipientAddress",
    "recipientName",
    "title",
    "institution",
    "grade",
    "achievementDescription",
    "evidenceUri",
    "customFields",
  ];

  for (const field of scalarFields) {
    const val = subject[field];
    if (val !== undefined) {
      const salt = generateSaltHex(16);
      commitments[field] = computeSaltedClaimDigest(field, salt, val);
      disclosed[field] = { salt, value: val };
    }
  }

  subject.skills.forEach((skill, idx) => {
    const key = `skill:${idx}`;
    const salt = generateSaltHex(16);
    commitments[key] = computeSaltedClaimDigest(key, salt, skill);
    disclosed[key] = { salt, value: skill };
  });

  return {
    version: 1,
    algorithm: "sha256-jcs-salted-v1",
    commitments,
    disclosed,
  };
}

export function createVerifiableCredential(
  input: CreateCredentialInput
): VerifiableEducationCredential {
  assertSafeOptionalUri(input.issuer.url, "issuer.url");
  assertSafeOptionalUri(input.issuer.metadataUri, "issuer.metadataUri");
  assertSafeOptionalUri(input.evidenceUri, "evidenceUri");

  const id = input.credentialId || `urn:uuid:${generateUuidV4()}`;
  const issuanceDate = new Date().toISOString();

  const issuerIdentity: IssuerIdentity = {
    id: `did:stellar:${input.issuer.address}`,
    name: input.issuer.name,
    url: input.issuer.url,
    metadataUri: input.issuer.metadataUri,
  };

  const subject: CredentialSubject = {
    id: `did:stellar:${input.recipient.address}`,
    recipientAddress: input.recipient.address,
    recipientName: input.recipient.name,
    title: input.title,
    institution: input.institution,
    skills: [...input.skills],
    grade: input.grade,
    achievementDescription: input.achievementDescription,
    evidenceUri: input.evidenceUri,
    customFields: input.customFields,
  };

  const unsigned: Omit<VerifiableEducationCredential, "proof"> = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/skills-passport/v1",
    ],
    id,
    type: ["VerifiableCredential", input.credentialType],
    issuer: issuerIdentity,
    issuanceDate,
    expirationDate: input.expirationDate,
    credentialSubject: subject,
  };

  if (input.selectiveDisclosure) {
    const selectiveDisclosure = buildSaltedDisclosureData(subject);
    const credentialHash = computeCredentialHash({
      ...unsigned,
      proof: {
        type: "StellarSorobanSaltedClaims2026",
        selectiveDisclosure,
      },
    });

    return {
      ...unsigned,
      proof: {
        type: "StellarSorobanSaltedClaims2026",
        created: issuanceDate,
        verificationMethod: `did:stellar:${input.issuer.address}#contract`,
        proofPurpose: "assertionMethod",
        credentialHash,
        contractId: input.contractId,
        stellarNetwork: input.stellarNetwork || "testnet",
        selectiveDisclosure,
      },
    };
  }

  const credentialHash = computeCredentialHash(unsigned);

  return {
    ...unsigned,
    proof: {
      type: "StellarSorobanHashCommitment2026",
      created: issuanceDate,
      verificationMethod: `did:stellar:${input.issuer.address}#contract`,
      proofPurpose: "assertionMethod",
      credentialHash,
      contractId: input.contractId,
      stellarNetwork: input.stellarNetwork || "testnet",
    },
  };
}
