import { useMemo, useState } from "react";
import { redactReceipt } from "skills-passport-sdk";
import { useToast } from "../../ui/Toast";
import { buildJsonOutput, type JsonVerifyOutput } from "../../verify/buildJsonOutput";
import type { UseVerificationResult } from "../../hooks/useVerification";
import type { RoundReceipt } from "skills-passport-sdk";
import { buildPermalinkUrl, byteLengthUtf8 } from "../../verify/permalink";
import { buildExportBundle } from "../../verify/buildExportBundle";
import { serializeReceipt } from "skills-passport-sdk";

export interface ExportReportPanelProps {
  receipt: RoundReceipt | null;
  /** Verification result computed once at the page level (avoids duplicate `verifyReceipt`). */
  verification: UseVerificationResult;
}

type CopyState = "idle" | "copying" | "copied";

export function ExportReportPanel({ receipt, verification }: ExportReportPanelProps) {
  const toast = useToast();
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [permalink, setPermalink] = useState<string | null>(null);
  const [permalinkSize, setPermalinkSize] = useState<number>(0);
  const [sanitise, setSanitise] = useState<boolean>(false);

  // Sanitised receipts come from the SDK's redactReceipt helper. We default to
  // its default keep-list (operator/winner/bidder addresses and audit blobs
  // become <redacted> placeholders) — the verification card stays based on
  // the unmodified receipt because redacted fields cannot be re-verified.
  const exportedReceipt = useMemo<RoundReceipt | null>(() => {
    if (!receipt) return null;
    if (!sanitise) return receipt;
    try {
      return redactReceipt(receipt);
    } catch (e) {
      // Fallback: if redaction fails for any reason, export the full receipt
      // and notify the user so we never silently ship raw PII in this code path.
      toast.push(
        "error",
        "Redaction failed",
        e instanceof Error ? e.message : String(e),
      );
      return receipt;
    }
  }, [receipt, sanitise, toast]);

  const report = useMemo<JsonVerifyOutput | null>(() => {
    if (!receipt) return null;
    return {
      valid: verification.result?.valid ?? false,
      receiptId: verification.fingerprint,
      roundId: receipt.roundId,
      checkedAt: new Date().toISOString(),
      errors: (verification.result?.issues ?? [])
        .filter((i) => i.severity === "error")
        .map((i) => ({ code: i.code, message: i.message, path: i.path })),
      warnings: (verification.result?.issues ?? [])
        .filter((i) => i.severity === "warning")
        .map((i) => ({ code: i.code, message: i.message, path: i.path })),
    };
  }, [receipt, verification.result, verification.fingerprint]);

  const exportedPayload = useMemo<{ json: string; bytes: number } | null>(() => {
    if (!exportedReceipt) return null;
    const json = `${serializeReceipt(exportedReceipt)}\n`;
    return { json, bytes: byteLengthUtf8(json) };
  }, [exportedReceipt]);

  const reportJson = useMemo(() => {
    if (!report) return null;
    return `${JSON.stringify(report, null, 2)}\n`;
  }, [report]);

  async function handleCopy() {
    if (!exportedPayload || !reportJson) return;
    setCopyState("copying");
    // Bundle: bundled.json (canonical, possibly redacted receipt)
    //                     + report.json (verification metadata, NOT redacted).
    // The bundle shape (indent + trailing newline + `{receipt, report}` keys) is
    // owned by buildExportBundle() so the panel stays declarative and the test
    // suite can lock the format independently.
    const bundledJson = buildExportBundle(
      exportedPayload.json.trim(),
      JSON.parse(reportJson),
    );
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(bundledJson);
      } else {
        const ta = document.createElement("textarea");
        ta.value = bundledJson;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyState("copied");
      toast.push(
        "success",
        sanitise ? "Sanitised bundle copied" : "Bundle copied",
        sanitise
          ? "Receipt addresses are redacted; verification metadata is unmodified."
          : "Paste it anywhere — the bundle is canonical.",
      );
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch (e) {
      setCopyState("idle");
      toast.push("error", "Could not copy", e instanceof Error ? e.message : String(e));
    }
  }

  function handleDownload() {
    if (!exportedPayload || !receipt || !report) return;
    const payloadName = sanitise ? "redacted.json" : "receipt.json";
    const blob = new Blob([exportedPayload.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `round-${receipt.roundId}-${payloadName}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handlePermalink() {
    if (!receipt) return;
    const source = sanitise && exportedReceipt ? exportedReceipt : receipt;
    const raw = JSON.stringify(source, null, 2);
    setPermalinkSize(byteLengthUtf8(raw));
    const { url, oversized } = buildPermalinkUrl(raw);
    setPermalink(url);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      toast.push(
        "success",
        sanitise ? "Sanitised permalink copied" : "Permalink copied",
        oversized
          ? `${raw.length} bytes — may be too long for some shared link strips. Consider downloading instead.`
          : `${raw.length} bytes — paste this URL to share ${sanitise ? "the redacted receipt" : "the receipt"} with anyone.`,
      );
    } catch {
      toast.push("info", "Permalink ready", "Copy it from the link below.");
    }
  }

  if (!receipt) return null;

  return (
    <section className="panel" aria-label="Export verification report">
      <header className="panel-head">
        <h2>Export verified report</h2>
        <p>
          The report is the same shape as <code>receipt-cli verify --json</code> and is computed
          entirely from the receipt you pasted. Use it as a receipt of the verification itself.
        </p>
      </header>

      <div className="export-panel">
        <div className="export-summary">
          <span>
            Valid:&nbsp;
            <strong style={{ color: report?.valid ? "var(--green)" : "var(--alert)" }}>
              {report?.valid ? "PASS" : "FAIL"}
            </strong>
          </span>
          <span>
            Round:&nbsp;<code>#{receipt.roundId}</code>
          </span>
          <span>
            Errors:&nbsp;<strong>{report?.errors.length ?? 0}</strong>
          </span>
          <span>
            Warnings:&nbsp;<strong>{report?.warnings.length ?? 0}</strong>
          </span>
          {report?.receiptId ? (
            <span>
              Receipt id:&nbsp;<code>{report.receiptId.slice(0, 16)}…</code>
            </span>
          ) : null}
          <span
            className={`export-pill ${sanitise ? "active" : ""}`}
            title="Sanitised view replaces operator/winner/bidder addresses and audit blobs with <redacted> placeholders; verification metadata stays based on the unmodified receipt."
          >
            <span className="export-pill-dot" aria-hidden="true" />
            {sanitise
              ? "Exporting sanitised view"
              : "Exporting full view (toggle for sanitised)"}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            className="primary-action"
            onClick={handleCopy}
            disabled={!exportedPayload || !reportJson}
          >
            {copyState === "copying" ? <span className="spinner" aria-hidden="true" /> : null}
            {copyState === "copied"
              ? sanitise
                ? "Sanitised bundle copied ✓"
                : "Bundle copied ✓"
              : sanitise
                ? "Copy sanitised bundle"
                : "Copy full bundle"}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={handleDownload}
            disabled={!exportedPayload}
          >
            {sanitise ? "Download redacted.json" : "Download receipt.json"}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={handlePermalink}
          >
            {sanitise ? "Copy sanitised permalink" : "Copy full permalink"}
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={async () => {
              const fresh = await buildJsonOutput(receipt, verification.result, null);
              toast.push(
                "info",
                "Verifier ran offline",
                `${fresh.errors.length} errors, ${fresh.warnings.length} warnings reported.`,
              );
            }}
          >
            Recompute offline
          </button>
        </div>

        <label className="export-toggle">
          <input
            type="checkbox"
            checked={sanitise}
            onChange={(e) => setSanitise(e.target.checked)}
            aria-label="Sanitise on export — replace operator/winner/bidder addresses and audit blobs with placeholder text"
          />
          <span>
            <strong>Sanitise on export</strong>
            <small>
              Switches copy / download / permalink to the redacted JSON produced by
              {" "}<code>redactReceipt()</code>. Verification stays based on the
              unmodified receipt.
            </small>
          </span>
        </label>

        {permalink ? (
          <div className="export-permalink">
            <span className="export-permalink-ok">
              ✓ Permalink ready ({permalinkSize} bytes{sanitise ? " · sanitised" : ""})
            </span>
            <pre className="field-kv" style={{ wordBreak: "break-all" }}>
              {permalink}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}
