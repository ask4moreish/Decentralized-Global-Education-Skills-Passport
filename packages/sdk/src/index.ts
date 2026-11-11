export {
  SkillsPassportClient,
  type SkillsPassportClientConfig,
  type CreateRoundParams,
  type CommitParams,
  type RevealParams,
  type ClearingRuleTag,
} from "./client.js";
export { normalizeRoundId, normalizeSorobanContractId } from "./ids.js";
export {
  type PreflightOperation,
  type PreflightResult,
  type PreflightSuccess,
  type PreflightFailureResult,
  type PreflightFeeEstimate,
  type PreflightResourceEstimate,
  evaluatePreflight,
  contractErrorCode,
} from "./preflight.js";
export {
  createOzChannelsSubmitter,
  createOzChannelsSubmitterFromEnv,
  type OzChannelsSubmitterConfig,
  type SubmittedTransaction,
  type SubmitSignedTransactionParams,
  type TransactionSubmitter,
} from "./submitter.js";
export {
  SkillsPassportClientConfigError,
  SkillsPassportMissingReturnValueError,
  SkillsPassportPreflightError,
  SkillsPassportSubmitError,
  SkillsPassportTimeoutError,
  SkillsPassportTransactionError,
} from "./errors.js";
export type {
  PreflightFailureKind,
  SkillsPassportPreflightErrorParams,
  TimeoutErrorParams,
} from "./errors.js";

export {
  validateEncryptedBlob,
  tryDecodeHex,
  tryDecodeBase64,
  MAX_CIPHERTEXT_BYTES,
  MAX_AUDITOR_BLOB_BYTES,
  type BlobContentType,
  type BlobValidationIssue,
  type BlobValidationResult,
} from "./encrypted-blob.js";
export {
  MAINNET_ARTIFACTS,
  MAINNET_CONFIRM_PHRASE,
  MAINNET_DEPLOY_MIN_XLM_STROOPS,
  MAINNET_MICRO_MAX_ESCROW,
  MAINNET_MIN_FEE_RESERVE_STROOPS,
} from "./mainnet-artifacts.js";
export {
  AssetConfigError,
  validateAssetConfig,
  validateAssetConfigs,
  ASSET_FIXTURES,
  type AssetConfig,
  type AssetType,
} from "./asset-config.js";
export {
  assertMainnetConfirmed,
  assertMicroAmounts,
  assertReadinessForExecute,
  createSacBalanceReader,
  defaultMainnetReadinessInput,
  fetchContractWasmHash,
  formatReadinessReport,
  hasBlockingFailures,
  nativeXlmSacId,
  runMainnetReadiness,
  verifySettledRoundProof,
  type MainnetReadinessDeps,
  type MainnetReadinessInput,
  type MainnetReadinessReport,
  type ReadinessCheck,
  type ReadinessStatus,
} from "./mainnet-readiness.js";

export {
  serializeReceipt,
  parseReceipt,
  networkFingerprint,
  type RoundReceipt,
  type BidReceiptEntry,
  RECEIPT_VERSION,
} from "./receipt.js";
export {
  redactReceipt,
  type RedactOptions,
} from "./redact.js";
export {
  verifyReceipt,
  type VerificationIssue,
  type VerificationResult,
  type VerifyOptions,
  type Severity,
} from "./verify.js";

// Keeper status-API response shapes. Mirror services/keeper/src/status.ts.
export {
  type RoundStatus,
  type SettlementIndicator,
  type KeeperHealthState,
  type KeeperRoundStatusView,
  type KeeperServiceHealth,
  type KeeperStatusResponse,
  type KeeperHealthResponse,
  type ApiError,
} from "./status.js";

// Fetch client for the keeper status API.
export {
  KeeperStatusClient,
  StatusApiError,
  type StatusClientOptions,
  fetchKeeperStatus,
} from "./status-client.js";

// Re-export the generated contract types so consumers get spec-accurate shapes
// from a single import surface.
export {
  Client as RoundContract,
  Errors as RoundErrors,
  type Round,
  type BidState,
  type BiddersPage,
  type Seal,
  type GlobalConfig,
  type ClearingRule,
  type Status,
  type DataKey,
} from "round-bindings";

// Education & Skills Passport
export {
  canonicalizeJson,
  computeCredentialHash,
  computeSaltedClaimDigest,
  credentialIdToBytes32Hex,
  generateSaltHex,
  generateUuidV4,
  hexToBytes32,
  bytes32ToHex,
  createVerifiableCredential,
  verifyEducationCredential,
  encodeCredentialForSharing,
  decodeSharedCredential,
  createCredentialSharePackage,
  createSelectiveCredentialView,
  formatFragmentUrl,
  inspectShareUrlPrivacy,
  parseVerificationUrl,
  DEFAULT_PASSPORT_VERIFY_URL,
  EducationPassportClient,
  PASSPORT_CONTRACT_ERRORS,
  decodePassportContractError,
  PassportRpcError,
  SUPPORTED_W3C_CRYPTOSUITES,
  UNSUPPORTED_W3C_SUITES,
  encodeBase58Btc,
  decodeBase58Btc,
  stellarPublicKeyToDidKey,
  resolveEd25519PublicKeyFromVerificationMethod,
  signDocumentEddsaJcs2022,
  verifyDocumentEddsaJcs2022,
  attachW3CDataIntegrityProof,
  validateVerifiableCredentialStructure,
  type CredentialType,
  type PassportProofType,
  type SaltedClaimEntry,
  type SaltedDisclosureData,
  type IssuerIdentity,
  type CredentialSubject,
  type CredentialProof,
  type VerifiableEducationCredential,
  type OnChainCredentialStatus,
  type OnChainCredentialRecord,
  type OnChainIssuerRecord,
  type OnChainTemplateRecord,
  type OnChainVerificationResult,
  type SorobanSimulationTransport,
  type VerificationDiagnostic,
  type VerifyEducationOptions,
  type SharePrivacyReport,
  type CredentialSharePackage,
  type SharePrivacyOptions,
  type ParsedVerificationUrl,
  type AnchorPayload,
  type CreateCredentialInput,
  type EducationPassportClientConfig,
  type BatchIssueItemParams,
  type W3CDataIntegrityProof,
  type W3CDataIntegritySignOptions,
  type W3CDataIntegrityVerificationResult,
  type W3CSchemaValidationResult,
  type W3CDualProofCredential,
} from "./passport/index.js";
