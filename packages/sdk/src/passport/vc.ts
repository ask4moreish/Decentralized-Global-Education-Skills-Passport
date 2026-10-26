import { randomUUID } from "node:crypto";
import { computeCredentialHash } from "./hasher.js";
import type {
  CredentialSubject,
  CredentialType,
  IssuerIdentity,
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
  expirationDate?: string;
  contractId?: string;
  stellarNetwork?: string;
  credentialId?: string;
}

export function createVerifiableCredential(
  input: CreateCredentialInput
): VerifiableEducationCredential {
  const id = input.credentialId || `urn:uuid:${randomUUID()}`;
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
    skills: input.skills,
    grade: input.grade,
    achievementDescription: input.achievementDescription,
    evidenceUri: input.evidenceUri,
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

  const credentialHash = computeCredentialHash(unsigned);

  const credential: VerifiableEducationCredential = {
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

  return credential;
}
