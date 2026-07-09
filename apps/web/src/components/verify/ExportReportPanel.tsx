import { useMemo, useState } from "react";
import { useToast } from "../../ui/Toast";
import { buildJsonOutput, type JsonVerifyOutput } from "../../verify/buildJsonOutput";
import type { UseVerificationResult } from "../../hooks/useVerification";
import type { RoundReceipt } from "@decentralized-global-education-skills-passport/sdk";
import { buildPermalinkUrl, byteLengthUtf8 } from "../../verify/permalink";

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

  const reportJson = useMemo(() => {
    if (!report) return null;
    return `${JSON.stringify(report, null, 2)}\n`;
  }, [report]);

  async function handleCopy() {
    if (!reportJson) return;
    setCopyState("copying");
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(reportJson);
      } else {
        // Fallback for browsers / webviews without async clipboard.
        const ta = document.createElement("textarea");
        ta.value = reportJson;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyState("copied");
      toast.push("success", "Report copied", "Paste it anywhere — the JSON is canonical.");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch (e) {
      setCopyState("idle");
      toast.push("error", "Could not copy", e instanceof Error ? e.message : String(e));
    }
  }

  function handleDownload() {
    if (!receipt || !report || !reportJson) return;
    const blob = new Blob([reportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `round-${receipt.roundId}-verify-${report.checkedAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handlePermalink() {
    if (!receipt) return;
    const raw = JSON.stringify(receipt, null, 2);
    const size = byteLengthUtf8(raw);
    setPermalinkSize(size);
    const url = buildPermalinkUrl(raw);
    setPermalink(url);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      toast.push(
        "success",
        "Permalink copied",
        size > 4 * 1024
          ? `${size} bytes — may be too long for some shared link strips. Consider downloading instead.`
          : `${size} bytes — paste this URL to share the receipt with anyone.`,
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
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            className="primary-action"
            onClick={handleCopy}
            disabled={!reportJson}
          >
            {copyState === "copying" ? <span className="spinner" aria-hidden="true" /> : null}
            {copyState === "copied" ? "Copied ✓" : "Copy JSON report"}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={handleDownload}
            disabled={!reportJson}
          >
            Download .json
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={handlePermalink}
          >
            Copy shareable permalink
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

        {permalink ? (
          <div className="export-permalink">
            <span className="export-permalink-ok">
              ✓ Permalink ready ({permalinkSize} bytes)
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
