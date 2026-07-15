import type { RoundReceipt } from "skills-passport-sdk";

export interface SavedReceipt {
  /** Unique id (generated at save time) */
  id: string;
  /** Unix timestamp (ms) when saved */
  savedAt: number;
  /** User-assigned label (e.g. "Round 3 — grant scoring") */
  label: string;
  /** User-assigned tags for filtering */
  tags: string[];
  /** Freeform notes about this receipt */
  notes: string;
  /** Canonical JSON serialization of the receipt */
  receiptJson: string;
  /** SHA-256 fingerprint of the canonical JSON */
  fingerprint: string;
  /** Round id from the receipt */
  roundId: string;
  /** Contract id from the receipt */
  contractId: string;
  /** Whether the receipt passed verification when saved */
  valid: boolean;
  /** ISO timestamp of when verification was performed */
  verifiedAt: string;
  /** Number of errors found during verification */
  errorCount: number;
  /** Number of warnings found during verification */
  warningCount: number;
}

export type ReceiptSortKey = "savedAt" | "roundId" | "label" | "valid";
export type ReceiptSortDir = "asc" | "desc";
