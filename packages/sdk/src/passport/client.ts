import {
  Account,
  Address,
  Keypair,
  nativeToScVal,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { normalizeSorobanContractId } from "../ids.js";
import { bytes32ToHex, hexToBytes32 } from "./hasher.js";
import type {
  OnChainCredentialRecord,
  OnChainCredentialStatus,
} from "./types.js";

export const PASSPORT_CONTRACT_ERRORS: Record<
  number,
  { variant: string; message: string }
> = {
  1: { variant: "NotInitialized", message: "Passport contract has not been initialized." },
  2: { variant: "AlreadyInitialized", message: "Passport contract is already initialized." },
  3: { variant: "Unauthorized", message: "Caller is not authorized for this operation or template." },
  4: { variant: "IssuerNotAuthorized", message: "Issuing institution is unregistered or deauthorized." },
  5: { variant: "CredentialAlreadyExists", message: "A credential with this ID already exists on-chain." },
  6: { variant: "CredentialNotFound", message: "Credential record was not found on-chain." },
  7: { variant: "CredentialAlreadyRevoked", message: "Credential is already permanently revoked." },
  8: { variant: "CredentialNotSuspended", message: "Credential is not currently suspended." },
  9: { variant: "InvalidExpiration", message: "Expiration timestamp must be strictly in the future." },
  10: { variant: "IssuerAlreadyRegistered", message: "Issuer address is already registered." },
  11: { variant: "IssuerNotFound", message: "Issuer address is not registered on-chain." },
  12: { variant: "TemplateAlreadyExists", message: "Credential template ID already exists." },
  13: { variant: "TemplateNotFound", message: "Credential template was not found." },
  14: { variant: "InvalidInput", message: "Invalid contract input (empty string, zero ID/hash, or self-reference)." },
  15: { variant: "BatchTooLarge", message: "Batch exceeds maximum of 50 credentials per transaction." },
  16: { variant: "CredentialAlreadySuspended", message: "Credential is already suspended." },
  17: { variant: "ContractPaused", message: "Contract is temporarily paused by administrator." },
  18: { variant: "NoPendingAdmin", message: "No pending administrator transfer has been proposed." },
  19: { variant: "IssuerAlreadyDeauthorized", message: "Issuer is already deauthorized." },
  20: { variant: "IssuerAlreadyActive", message: "Issuer is already active." },
};

export function decodePassportContractError(
  errorOrCode: unknown
): { code: number; variant: string; message: string } | null {
  if (typeof errorOrCode === "number" && PASSPORT_CONTRACT_ERRORS[errorOrCode]) {
    return { code: errorOrCode, ...PASSPORT_CONTRACT_ERRORS[errorOrCode] };
  }
  const msg = errorOrCode instanceof Error ? errorOrCode.message : String(errorOrCode ?? "");
  const match = msg.match(/Error\(Contract,\s*#(\d+)\)/i) || msg.match(/Contract,\s*#(\d+)/i);
  if (match) {
    const code = Number(match[1]);
    const info = PASSPORT_CONTRACT_ERRORS[code];
    if (info) {
      return { code, ...info };
    }
  }
  return null;
}

export class PassportRpcError extends Error {
  public readonly contractCode?: number;
  public readonly variant?: string;

  constructor(message: string, opts?: { contractCode?: number; variant?: string; cause?: unknown }) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "PassportRpcError";
    this.contractCode = opts?.contractCode;
    this.variant = opts?.variant;
  }
}

export interface SorobanSimulationTransport {
  simulateTransaction(tx: unknown): Promise<{
    result?: { retval?: xdr.ScVal; error?: string };
    error?: string;
  }>;
}

export interface EducationPassportClientConfig {
  contractId: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  /** Optional custom RPC transport for testing or custom providers */
  rpcServer?: SorobanSimulationTransport;
}

export interface BatchIssueItemParams {
  recipientAddress: string;
  credentialIdHex: string;
  credentialHashHex: string;
  templateIdSymbol: string;
  expiresAtTimestamp?: number;
}

export interface OnChainIssuerRecord {
  address: string;
  name: string;
  metadataUri: string;
  isActive: boolean;
  registeredAt: number;
}

export interface OnChainTemplateRecord {
  templateId: string;
  issuer: string;
  name: string;
  schemaUri: string;
  registeredAt: number;
}

export interface OnChainVerificationResult {
  isValid: boolean;
  status: OnChainCredentialStatus;
  issuerAuthorized: boolean;
  hashMatches: boolean;
  isExpired: boolean;
  issuedAt: number;
  expiresAt?: number;
  issuer: string;
  recipient: string;
}

const ZERO_HEX_32 = "0".repeat(64);

function validateSymbol(symbol: string, fieldName: string): void {
  if (!symbol || symbol.length > 32) {
    throw new Error(`${fieldName} must be 1-32 characters for Soroban Symbol`);
  }
}

function validateNonZeroHex32(hex: string, fieldName: string): Uint8Array {
  const bytes = hexToBytes32(hex);
  const clean = (hex.startsWith("0x") ? hex.slice(2) : hex).toLowerCase();
  if (clean === ZERO_HEX_32) {
    throw new Error(`${fieldName} cannot be all-zero bytes`);
  }
  return bytes;
}

function parseStatusValue(rawStatus: unknown): OnChainCredentialStatus {
  if (rawStatus === 2 || rawStatus === "Revoked" || (Array.isArray(rawStatus) && rawStatus[0] === "Revoked")) {
    return "Revoked";
  }
  if (rawStatus === 3 || rawStatus === "Suspended" || (Array.isArray(rawStatus) && rawStatus[0] === "Suspended")) {
    return "Suspended";
  }
  return "Active";
}

function toHex32(val: unknown): string {
  if (val instanceof Uint8Array) {
    return bytes32ToHex(val);
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(val)) {
    return (val as Buffer).toString("hex");
  }
  if (typeof val === "string") {
    return val.toLowerCase();
  }
  return "";
}

export class EducationPassportClient {
  public readonly contractId: string;
  public readonly rpcUrl: string;
  public readonly networkPassphrase: string;
  private readonly server: SorobanSimulationTransport;

  constructor(config: EducationPassportClientConfig) {
    this.contractId = normalizeSorobanContractId(config.contractId);
    this.rpcUrl = config.rpcUrl || "https://soroban-testnet.stellar.org";
    this.networkPassphrase =
      config.networkPassphrase || "Test SDF Network ; September 2015";
    this.server = config.rpcServer || (new rpc.Server(this.rpcUrl) as unknown as SorobanSimulationTransport);
  }

  /**
   * Build a Soroban invokeContractFunction operation for Freighter or Keypair signing.
   */
  public buildInvokeOperation(
    functionName: string,
    args: xdr.ScVal[]
  ): xdr.Operation {
    return Operation.invokeContractFunction({
      contract: this.contractId,
      function: functionName,
      args,
    });
  }

  /**
   * Execute a read-only contract simulation call against Soroban RPC.
   */
  public async simulateRead<T = unknown>(
    functionName: string,
    args: xdr.ScVal[] = []
  ): Promise<T> {
    const dummy = Keypair.random();
    const account = new Account(dummy.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.buildInvokeOperation(functionName, args))
      .setTimeout(30)
      .build();

    let sim: { result?: { retval?: xdr.ScVal; error?: string }; error?: string };
    try {
      sim = await this.server.simulateTransaction(tx);
    } catch (err: any) {
      throw new PassportRpcError(
        `Soroban RPC request failed for ${functionName}: ${err?.message || "network error"}`,
        { cause: err }
      );
    }

    const simError = sim?.error || sim?.result?.error;
    if (simError) {
      const decoded = decodePassportContractError(simError);
      if (decoded) {
        throw new PassportRpcError(
          `Contract rejected ${functionName} (#${decoded.code} ${decoded.variant}): ${decoded.message}`,
          { contractCode: decoded.code, variant: decoded.variant }
        );
      }
      throw new PassportRpcError(
        `Simulation failed for ${functionName}: ${simError}`
      );
    }

    if (!sim?.result?.retval) {
      throw new PassportRpcError(
        `Malformed RPC simulation response for ${functionName}: missing retval`
      );
    }

    return scValToNative(sim.result.retval) as T;
  }

  // ---------------------------------------------------------------------------
  // Argument Builders (State-Changing & Administrative)
  // ---------------------------------------------------------------------------

  public buildSetAdminArgs(params: { newAdminAddress: string }): xdr.ScVal[] {
    return [new Address(params.newAdminAddress).toScVal()];
  }

  public buildProposeAdminArgs(params: { newAdminAddress: string }): xdr.ScVal[] {
    return [new Address(params.newAdminAddress).toScVal()];
  }

  public buildAcceptAdminArgs(): xdr.ScVal[] {
    return [];
  }

  public buildPauseArgs(): xdr.ScVal[] {
    return [];
  }

  public buildUnpauseArgs(): xdr.ScVal[] {
    return [];
  }

  public buildRegisterIssuerArgs(params: {
    issuerAddress: string;
    name: string;
    metadataUri: string;
  }): xdr.ScVal[] {
    if (!params.name.trim() || !params.metadataUri.trim()) {
      throw new Error("Issuer name and metadataUri must be non-empty");
    }
    const issuerVal = new Address(params.issuerAddress).toScVal();
    const nameVal = nativeToScVal(params.name, { type: "string" });
    const uriVal = nativeToScVal(params.metadataUri, { type: "string" });
    return [issuerVal, nameVal, uriVal];
  }

  public buildDeauthorizeIssuerArgs(params: { issuerAddress: string }): xdr.ScVal[] {
    return [new Address(params.issuerAddress).toScVal()];
  }

  public buildReactivateIssuerArgs(params: { issuerAddress: string }): xdr.ScVal[] {
    return [new Address(params.issuerAddress).toScVal()];
  }

  public buildRotateIssuerKeyArgs(params: {
    oldIssuerAddress: string;
    newIssuerAddress: string;
  }): xdr.ScVal[] {
    if (params.oldIssuerAddress === params.newIssuerAddress) {
      throw new Error("oldIssuerAddress and newIssuerAddress must differ");
    }
    return [
      new Address(params.oldIssuerAddress).toScVal(),
      new Address(params.newIssuerAddress).toScVal(),
    ];
  }

  public buildRegisterTemplateArgs(params: {
    issuerAddress: string;
    templateIdSymbol: string;
    name: string;
    schemaUri: string;
  }): xdr.ScVal[] {
    validateSymbol(params.templateIdSymbol, "templateIdSymbol");
    if (!params.name.trim() || !params.schemaUri.trim()) {
      throw new Error("Template name and schemaUri must be non-empty");
    }
    const issuerVal = new Address(params.issuerAddress).toScVal();
    const templateVal = xdr.ScVal.scvSymbol(params.templateIdSymbol);
    const nameVal = nativeToScVal(params.name, { type: "string" });
    const schemaVal = nativeToScVal(params.schemaUri, { type: "string" });
    return [issuerVal, templateVal, nameVal, schemaVal];
  }

  public buildIssueCredentialArgs(params: {
    issuerAddress: string;
    recipientAddress: string;
    credentialIdHex: string;
    credentialHashHex: string;
    templateIdSymbol: string;
    expiresAtTimestamp?: number;
  }): xdr.ScVal[] {
    if (params.issuerAddress === params.recipientAddress) {
      throw new Error("issuerAddress and recipientAddress cannot be identical");
    }
    validateSymbol(params.templateIdSymbol, "templateIdSymbol");
    const issuerVal = new Address(params.issuerAddress).toScVal();
    const recipientVal = new Address(params.recipientAddress).toScVal();

    const credIdBytes = validateNonZeroHex32(params.credentialIdHex, "credentialIdHex");
    const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });

    const credHashBytes = validateNonZeroHex32(params.credentialHashHex, "credentialHashHex");
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

  public buildBatchIssueCredentialsArgs(params: {
    issuerAddress: string;
    items: BatchIssueItemParams[];
  }): xdr.ScVal[] {
    if (!params.items.length || params.items.length > 50) {
      throw new Error("Batch issuance requires between 1 and 50 items");
    }
    const issuerVal = new Address(params.issuerAddress).toScVal();

    const scValItems = params.items.map((item) => {
      if (item.recipientAddress === params.issuerAddress) {
        throw new Error("Batch item recipientAddress cannot equal issuerAddress");
      }
      validateSymbol(item.templateIdSymbol, "templateIdSymbol");
      const recipientVal = new Address(item.recipientAddress).toScVal();
      const credIdBytes = validateNonZeroHex32(item.credentialIdHex, "credentialIdHex");
      const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });
      const credHashBytes = validateNonZeroHex32(item.credentialHashHex, "credentialHashHex");
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

  public buildRevokeCredentialArgs(params: {
    callerAddress: string;
    credentialIdHex: string;
    reason: string;
  }): xdr.ScVal[] {
    if (!params.reason.trim()) {
      throw new Error("Revocation reason must be non-empty");
    }
    const callerVal = new Address(params.callerAddress).toScVal();
    const credIdBytes = validateNonZeroHex32(params.credentialIdHex, "credentialIdHex");
    const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });
    const reasonVal = nativeToScVal(params.reason, { type: "string" });

    return [callerVal, credIdVal, reasonVal];
  }

  public buildSuspendCredentialArgs(params: {
    callerAddress: string;
    credentialIdHex: string;
    reason: string;
  }): xdr.ScVal[] {
    if (!params.reason.trim()) {
      throw new Error("Suspension reason must be non-empty");
    }
    const callerVal = new Address(params.callerAddress).toScVal();
    const credIdBytes = validateNonZeroHex32(params.credentialIdHex, "credentialIdHex");
    const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });
    const reasonVal = nativeToScVal(params.reason, { type: "string" });

    return [callerVal, credIdVal, reasonVal];
  }

  public buildReactivateCredentialArgs(params: {
    callerAddress: string;
    credentialIdHex: string;
  }): xdr.ScVal[] {
    const callerVal = new Address(params.callerAddress).toScVal();
    const credIdBytes = validateNonZeroHex32(params.credentialIdHex, "credentialIdHex");
    const credIdVal = nativeToScVal(credIdBytes, { type: "bytes" });

    return [callerVal, credIdVal];
  }

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

  // ---------------------------------------------------------------------------
  // Live Soroban RPC Read & Verification Queries
  // ---------------------------------------------------------------------------

  public async getAdmin(): Promise<string> {
    return this.simulateRead<string>("get_admin");
  }

  public async getPendingAdmin(): Promise<string | null> {
    const res = await this.simulateRead<string | null | undefined>("get_pending_admin");
    return res ?? null;
  }

  public async isPaused(): Promise<boolean> {
    return Boolean(await this.simulateRead<boolean>("is_paused"));
  }

  public async isIssuerAuthorized(issuerAddress: string): Promise<boolean> {
    const arg = new Address(issuerAddress).toScVal();
    return Boolean(await this.simulateRead<boolean>("is_issuer_authorized", [arg]));
  }

  public async getIssuer(issuerAddress: string): Promise<OnChainIssuerRecord | null> {
    const arg = new Address(issuerAddress).toScVal();
    const raw = await this.simulateRead<any>("get_issuer", [arg]);
    if (!raw) return null;
    return {
      address: raw.address || issuerAddress,
      name: raw.name || "",
      metadataUri: raw.metadata_uri || "",
      isActive: Boolean(raw.is_active),
      registeredAt: Number(raw.registered_at || 0),
    };
  }

  public async getTemplate(templateIdSymbol: string): Promise<OnChainTemplateRecord | null> {
    validateSymbol(templateIdSymbol, "templateIdSymbol");
    const arg = xdr.ScVal.scvSymbol(templateIdSymbol);
    const raw = await this.simulateRead<any>("get_template", [arg]);
    if (!raw) return null;
    return {
      templateId: raw.template_id || templateIdSymbol,
      issuer: raw.issuer || "",
      name: raw.name || "",
      schemaUri: raw.schema_uri || "",
      registeredAt: Number(raw.registered_at || 0),
    };
  }

  public async getCredential(
    credentialIdHex: string
  ): Promise<OnChainCredentialRecord | null> {
    const credIdBytes = hexToBytes32(credentialIdHex);
    const arg = nativeToScVal(credIdBytes, { type: "bytes" });
    const raw = await this.simulateRead<any>("get_credential", [arg]);
    return this.parseNativeCredentialRecord(raw);
  }

  public async getCredentialStatus(credentialIdHex: string): Promise<{
    status: OnChainCredentialStatus;
    expiresAt?: number;
    revocationReason?: string;
  } | null> {
    const credIdBytes = hexToBytes32(credentialIdHex);
    const arg = nativeToScVal(credIdBytes, { type: "bytes" });
    try {
      const tuple = await this.simulateRead<[unknown, unknown, unknown]>(
        "get_credential_status",
        [arg]
      );
      if (!Array.isArray(tuple) || tuple.length < 3) return null;
      return {
        status: parseStatusValue(tuple[0]),
        expiresAt:
          tuple[1] !== null && tuple[1] !== undefined ? Number(tuple[1]) : undefined,
        revocationReason:
          typeof tuple[2] === "string" ? tuple[2] : undefined,
      };
    } catch (err) {
      if (err instanceof PassportRpcError && err.contractCode === 6) {
        return null;
      }
      throw err;
    }
  }

  public async getLearnerCredentials(recipientAddress: string): Promise<string[]> {
    const arg = new Address(recipientAddress).toScVal();
    const raw = await this.simulateRead<unknown[]>("get_learner_credentials", [arg]);
    if (!Array.isArray(raw)) return [];
    return raw.map(toHex32).filter(Boolean);
  }

  public async getLearnerCredentialCount(recipientAddress: string): Promise<number> {
    const arg = new Address(recipientAddress).toScVal();
    const raw = await this.simulateRead<number | bigint>("get_learner_credential_count", [arg]);
    return Number(raw || 0);
  }

  public async getLearnerCredentialsPage(
    recipientAddress: string,
    cursor: number,
    limit: number
  ): Promise<string[]> {
    if (!Number.isInteger(cursor) || cursor < 0) {
      throw new Error("cursor must be a non-negative integer");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("limit must be an integer between 1 and 100");
    }
    const args = [
      new Address(recipientAddress).toScVal(),
      nativeToScVal(cursor, { type: "u32" }),
      nativeToScVal(limit, { type: "u32" }),
    ];
    const raw = await this.simulateRead<unknown[]>("get_learner_credentials_page", args);
    if (!Array.isArray(raw)) return [];
    return raw.map(toHex32).filter(Boolean);
  }

  public async verifyCredentialOnChain(
    credentialIdHex: string,
    claimedHashHex: string
  ): Promise<OnChainVerificationResult | null> {
    const args = this.buildVerifyCredentialArgs({
      credentialIdHex,
      claimedHashHex,
    });
    try {
      const raw = await this.simulateRead<any>("verify_credential", args);
      if (!raw) return null;
      return {
        isValid: Boolean(raw.is_valid),
        status: parseStatusValue(raw.status),
        issuerAuthorized: Boolean(raw.issuer_authorized),
        hashMatches: Boolean(raw.hash_matches),
        isExpired: Boolean(raw.is_expired),
        issuedAt: Number(raw.issued_at || 0),
        expiresAt:
          raw.expires_at !== null && raw.expires_at !== undefined
            ? Number(raw.expires_at)
            : undefined,
        issuer: raw.issuer || "",
        recipient: raw.recipient || "",
      };
    } catch (err) {
      if (err instanceof PassportRpcError && err.contractCode === 6) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Fetch complete OnChainCredentialRecord including live issuer authorization status.
   * Returns null only when credential does not exist on-chain; throws PassportRpcError on network/RPC errors.
   */
  public async fetchOnChainRecord(
    credentialIdHex: string
  ): Promise<OnChainCredentialRecord | null> {
    const record = await this.getCredential(credentialIdHex);
    if (!record) return null;
    const issuerAuthorized = await this.isIssuerAuthorized(record.issuer);
    return {
      ...record,
      issuerAuthorized,
    };
  }

  /**
   * Parse an XDR ScVal representing Option<CredentialRecord> or CredentialRecord.
   */
  public parseCredentialRecord(scVal: xdr.ScVal): OnChainCredentialRecord | null {
    try {
      if (!scVal) return null;
      const native = scValToNative(scVal) as any;
      return this.parseNativeCredentialRecord(native);
    } catch {
      return null;
    }
  }

  private parseNativeCredentialRecord(native: any): OnChainCredentialRecord | null {
    if (!native || typeof native !== "object") return null;
    const credentialId = toHex32(native.credential_id);
    const credentialHash = toHex32(native.credential_hash);
    if (!credentialId || !credentialHash) return null;

    return {
      credentialId,
      issuer: native.issuer || "",
      recipient: native.recipient || "",
      credentialHash,
      templateId: native.template_id || "",
      issuedAt: Number(native.issued_at || 0),
      expiresAt:
        native.expires_at !== null && native.expires_at !== undefined
          ? Number(native.expires_at)
          : undefined,
      status: parseStatusValue(native.status),
      revocationReason: native.revocation_reason || undefined,
    };
  }
}
