// Bundled export payload for the verifier UI.
//
// Shape produced:
//
//   {
//     "receipt": <string — verbatim embedded receipt JSON, possibly redacted>,
//     "report":  <object — verification metadata, NEVER redacted>
//   }
//
// The `receipt` field is a JSON string (already-formatted canonical
// serializeReceipt output). The `report` field is the structured object that
// `receipt-cli verify --json` would emit. We embed `receipt` as a string so
// the receipt stays byte-stable across tools — any downstream consumer can
// `JSON.parse(bundle.receipt)` and re-verify.
//
// This helper is extracted from ExportReportPanel.tsx's `handleCopy` so the
// shape is unit-testable without spinning up React. The component calls
// `buildExportBundle(exportedPayload.json.trim(), JSON.parse(reportJson))`,
// matching the exact shape it shipped before the extraction.
//
// Trim contract: the helper embeds the receipt string verbatim. The caller is
// responsible for any whitespace-trimming it wants applied to the embedded
// receipt string — the panel strips the trailing `\n` that `serializeReceipt`
// emits with `.trim()` before calling this helper. The helper NEVER re-
// canonicalizes, trims, or otherwise mutates the embedded string.

import type { JsonVerifyOutput } from "./buildJsonOutput";

export interface BuildExportBundleOptions {
  /**
   * Spaces per indent level applied by JSON.stringify.
   * Default: 2.
   */
  indent?: number;
  /**
   * Whether to terminate the bundle with a single trailing `\n`.
   * Default: true. Matches the format of `serializeReceipt()` output so the
   * bundled payload reads identically to `\n`-terminated JSONL-ish streams.
   */
  trailingNewline?: boolean;
}

export function buildExportBundle(
  receiptJson: string,
  report: JsonVerifyOutput,
  options: BuildExportBundleOptions = {},
): string {
  const { indent = 2, trailingNewline = true } = options;
  const body = JSON.stringify({ receipt: receiptJson, report }, null, indent);
  return trailingNewline ? `${body}\n` : body;
}
