import {
  Address,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { hexToBytes32 } from "./hasher.js";
import type {
  OnChainCredentialRecord,
  OnChainCredentialStatus,
} from "./types.js";

export interface EducationPassportClientConfig {
  contractId: string;
  rpcUrl?: string;
  networkPassphrase?: string;
}

export interface BatchIssueItemParams {
  recipientAddress: string;
  credentialIdHex: string;
  credentialHashHex: string;
  templateIdSymbol: string;
  expiresAtTimestamp?: number;
}

export class EducationPassportClient {
  public readonly contractId: string;
  public readonly rpcUrl: string;
  public readonly networkPassphrase: string;
  private readonly server: rpc.Server;

  constructor(config: EducationPassportClientConfig) {
    this.contractId = config.contractId;
    this.rpcUrl = config.rpcUrl || "https://soroban-testnet.stellar.org";
    this.networkPassphrase =
      config.networkPassphrase || "Test SDF Network ; September 2015";
    this.server = new rpc.Server(this.rpcUrl);
  }

  /**
   * Format contract call arguments for register_issuer
   */
  public buildRegisterIssuerArgs(params: {
    issuerAddress: string;
    name: string;
    metadataUri: string;
  }): xdr.ScVal[] {
    const issuerVal = new Address(params.issuerAddress).toScVal();
    const nameVal = nativeToScVal(params.name, { type: "string" });
    const uriVal = nativeToScVal(params.metadataUri, { type: "string" });
    return [issuerVal, nameVal, uriVal];
  }

  /**
   * Format contract call arguments for register_template
   */
  public buildRegisterTemplateArgs(params: {
    issuerAddress: string;
    templateIdSymbol: string;
    name: string;
    schemaUri: string;
  }): xdr.ScVal[] {
    const issuerVal = new Address(params.issuerAddress).toScVal();
    const templateVal = xdr.ScVal.scvSymbol(params.templateIdSymbol);
    const nameVal = nativeToScVal(params.name, { type: "string" });
    const schemaVal = nativeToScVal(params.schemaUri, { type: "string" });
    return [issuerVal, templateVal, nameVal, schemaVal];
  }

  /**
   * Format contract call arguments for issue_credential
   */
  public buildIssueCredentialArgs(params: {
    issuerAddress: string;
    recipientAddress: string;
    credentialIdHex: string;
    credentialHashHex: string;
    templateIdSymbol: string;
    expiresAtTimestamp?: number;
  }): xdr.ScVal[] {
    const issuerVal = new Address(params.issuerAddress).toScVal();
    const recipientVal = new Address(params.recipientAddress).toScVal();

    const credIdBytes = hexToBytes32(params.credentialIdHex);
    const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });

    const credHashBytes = hexToBytes32(params.credentialHashHex);
    const credHashVal = nativeToScVal(credHashBytes, { type: "bytes" });

    const templateVal = xdr.ScVal.scvSymbol(params.templateIdSymbol);

    const expiresAtVal =
      params.expiresAtTimestamp !== undefined
        ? nativeToScVal(BigInt(params.expiresAtTimestamp), { type: "u64" })
        : xdr.ScVal.scvVoid();

    return [
      issuerVal,
      recipientVal,
      credIdVal,
      credHashVal,
      templateVal,
      expiresAtVal,
    ];
  }

  /**
   * Format contract call arguments for batch_issue_credentials
   */
  public buildBatchIssueCredentialsArgs(params: {
    issuerAddress: string;
    items: BatchIssueItemParams[];
  }): xdr.ScVal[] {
    const issuerVal = new Address(params.issuerAddress).toScVal();

    const scValItems = params.items.map((item) => {
      const recipientVal = new Address(item.recipientAddress).toScVal();
      const credIdBytes = hexToBytes32(item.credentialIdHex);
      const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });
      const credHashBytes = hexToBytes32(item.credentialHashHex);
      const credHashVal = nativeToScVal(credHashBytes, { type: "bytes" });
      const templateVal = xdr.ScVal.scvSymbol(item.templateIdSymbol);
      const expiresAtVal =
        item.expiresAtTimestamp !== undefined
          ? nativeToScVal(BigInt(item.expiresAtTimestamp), { type: "u64" })
          : xdr.ScVal.scvVoid();

      return xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("credential_hash"),
          val: credHashVal,
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("credential_id"),
          val: credIdVal,
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("expires_at"),
          val: expiresAtVal,
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("recipient"),
          val: recipientVal,
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("template_id"),
          val: templateVal,
        }),
      ]);
    });

    const vecVal = xdr.ScVal.scvVec(scValItems);
    return [issuerVal, vecVal];
  }

  /**
   * Format contract call arguments for revoke_credential
   */
  public buildRevokeCredentialArgs(params: {
    callerAddress: string;
    credentialIdHex: string;
    reason: string;
  }): xdr.ScVal[] {
    const callerVal = new Address(params.callerAddress).toScVal();
    const credIdBytes = hexToBytes32(params.credentialIdHex);
    const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });
    const reasonVal = nativeToScVal(params.reason, { type: "string" });

    return [callerVal, credIdVal, reasonVal];
  }

  /**
   * Format contract call arguments for suspend_credential
   */
  public buildSuspendCredentialArgs(params: {
    callerAddress: string;
    credentialIdHex: string;
    reason: string;
  }): xdr.ScVal[] {
    const callerVal = new Address(params.callerAddress).toScVal();
    const credIdBytes = hexToBytes32(params.credentialIdHex);
    const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });
    const reasonVal = nativeToScVal(params.reason, { type: "string" });

    return [callerVal, credIdVal, reasonVal];
  }

  /**
   * Format contract call arguments for reactivate_credential
   */
  public buildReactivateCredentialArgs(params: {
    callerAddress: string;
    credentialIdHex: string;
  }): xdr.ScVal[] {
    const callerVal = new Address(params.callerAddress).toScVal();
    const credIdBytes = hexToBytes32(params.credentialIdHex);
    const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });

    return [callerVal, credIdVal];
  }

  /**
   * Format contract call arguments for verify_credential
   */
  public buildVerifyCredentialArgs(params: {
    credentialIdHex: string;
    claimedHashHex: string;
  }): xdr.ScVal[] {
    const credIdBytes = hexToBytes32(params.credentialIdHex);
    const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });

    const credHashBytes = hexToBytes32(params.claimedHashHex);
    const credHashVal = nativeToScVal(credHashBytes, { type: "bytes" });

    return [credIdVal, credHashVal];
  }

  /**
   * Simulates a read-only credential verification or status query
   */
  public parseCredentialRecord(scVal: xdr.ScVal): OnChainCredentialRecord | null {
    try {
      const native = scValToNative(scVal) as any;
      if (!native) return null;

      let status: OnChainCredentialStatus = "Active";
      if (native.status === 2 || native.status === "Revoked") {
        status = "Revoked";
      } else if (native.status === 3 || native.status === "Suspended") {
        status = "Suspended";
      }

      return {
        credentialId: native.credential_id
          ? Buffer.from(native.credential_id).toString("hex")
          : "",
        issuer: native.issuer || "",
        recipient: native.recipient || "",
        credentialHash: native.credential_hash
          ? Buffer.from(native.credential_hash).toString("hex")
          : "",
        templateId: native.template_id || "",
        issuedAt: Number(native.issued_at || 0),
        expiresAt: native.expires_at ? Number(native.expires_at) : undefined,
        status,
        revocationReason: native.revocation_reason || undefined,
      };
    } catch {
      return null;
    }
  }
}
