export class SkillsPassportClientConfigError extends Error {
  readonly name = "SkillsPassportClientConfigError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class SkillsPassportSubmitError extends Error {
  readonly name = "SkillsPassportSubmitError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class SkillsPassportTransactionError extends Error {
  readonly name = "SkillsPassportTransactionError";
  readonly hash: string;
  readonly status: string;

  constructor(hash: string, status: string, options?: ErrorOptions) {
    super(`transaction ${hash} ended with status ${status}`, options);
    this.hash = hash;
    this.status = status;
  }
}

export class SkillsPassportMissingReturnValueError extends Error {
  readonly name = "SkillsPassportMissingReturnValueError";
  readonly hash: string;

  constructor(hash: string) {
    super(`transaction ${hash} succeeded without a return value`);
    this.hash = hash;
  }
}

export interface TimeoutErrorParams {
  hash: string;
  submitter: string;
  lastStatus: string;
  timeoutMs: number;
  pollIntervalMs: number;
}

export type PreflightFailureKind =
  | "rpc_error"
  | "simulation_error"
  | "expired_state"
  | "contract_error"
  | "malformed_response";

export interface SkillsPassportPreflightErrorParams {
  kind: PreflightFailureKind;
  operation: string;
  message: string;
  simulationError?: string;
  contractErrorCode?: number;
  contractErrorMessage?: string;
  restoreMinResourceFee?: bigint;
  cause?: unknown;
}

/** Typed error for preflight/simulation failures before transaction submission. */
export class SkillsPassportPreflightError extends Error {
  readonly name = "SkillsPassportPreflightError";
  readonly kind: PreflightFailureKind;
  readonly operation: string;
  readonly simulationError?: string;
  readonly contractErrorCode?: number;
  readonly contractErrorMessage?: string;
  readonly restoreMinResourceFee?: bigint;

  constructor(params: SkillsPassportPreflightErrorParams) {
    super(params.message, params.cause ? { cause: params.cause } : undefined);
    this.kind = params.kind;
    this.operation = params.operation;
    this.simulationError = params.simulationError;
    this.contractErrorCode = params.contractErrorCode;
    this.contractErrorMessage = params.contractErrorMessage;
    this.restoreMinResourceFee = params.restoreMinResourceFee;
  }
}

export class SkillsPassportTimeoutError extends Error {
  readonly name = "SkillsPassportTimeoutError";
  readonly hash: string;
  readonly submitter: string;
  readonly lastStatus: string;
  readonly timeoutMs: number;
  readonly pollIntervalMs: number;

  constructor(params: TimeoutErrorParams) {
    super(
      `${params.submitter} submitted ${params.hash}, but RPC did not finalize it in time (last=${params.lastStatus})`,
    );
    this.hash = params.hash;
    this.submitter = params.submitter;
    this.lastStatus = params.lastStatus;
    this.timeoutMs = params.timeoutMs;
    this.pollIntervalMs = params.pollIntervalMs;
  }
}
