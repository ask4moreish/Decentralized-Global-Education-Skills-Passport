// Mirror of services/receipt-cli/src/json-output.ts buildJsonOutput().
//
// The CLI uses node:crypto for the receiptId sha256; the web client uses
// crypto.subtle (resolved via computeReceiptId below). Keeping the JSON
// shape identical means any downstream tool that consumes `receipt-cli
// --json` output also works on web exports verbatim.

import {
  serializeReceipt,
  type RoundReceipt,
  type VerificationResult,
} from "skills-passport-sdk";
import { sha256Hex } from "./hashFingerprint";

export interface JsonIssue {
  code: string;
  message: string;
  path?: string;
}

export interface JsonVerifyOutput {
  valid: boolean;
  receiptId: string | null;
  roundId: string | null;
  checkedAt: string;
  errors: JsonIssue[];
  warnings: JsonIssue[];
}

/**
 * Browser-side equivalent of cli buildJsonOutput. The receiptId is computed
 * asynchronously — caller must `await`. Returns `null` for receiptId when
 * crypto.subtle is unavailable, mirroring the CLI 'deterministic identity'
 * style (we just leave it null instead of inventing a fallback hash).
 */
export async function buildJsonOutput(
  receipt: RoundReceipt | null,
  result: VerificationResult | null,
  parseError: string | null,
): Promise<JsonVerifyOutput> {
  const checkedAt = new Date().toISOString();

  if (parseError !== null || receipt === null || result === null) {
    return {
      valid: false,
      receiptId: null,
      roundId: null,
      checkedAt,
      errors: parseError
        ? [{ code: "parse_error", message: parseError }]
        : [{ code: "parse_error", message: "Unknown error" }],
      warnings: [],
    };
  }

  const canonical = serializeReceipt(receipt);
  const receiptId = await sha256Hex(canonical);

  const errors: JsonIssue[] = [];
  const warnings: JsonIssue[] = [];

  for (const issue of result.issues) {
    const entry: JsonIssue = { code: issue.code, message: issue.message };
    if (issue.path) entry.path = issue.path;
    if (issue.severity === "error") errors.push(entry);
    else warnings.push(entry);
  }

  return {
    valid: result.valid,
    receiptId,
    roundId: receipt.roundId,
    checkedAt,
    errors,
    warnings,
  };
}
