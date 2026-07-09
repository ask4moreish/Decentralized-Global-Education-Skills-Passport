import { useMemo, useState } from "react";
import { useVerification } from "../../hooks/useVerification";
import type { RoundReceipt, VerificationIssue } from "@decentralized-global-education-skills-passport/sdk";

export interface VerdictPanelProps {
  receipt: RoundReceipt | null;
}

type Filter = "all" | "error" | "warning";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "error", label: "Errors" },
  { id: "warning", label: "Warnings" },
];

export function VerdictPanel({ receipt }: VerdictPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const { result, fingerprint, roundId } = useVerification(receipt);

  const stats = useMemo(() => {
    if (!result) return { errors: 0, warnings: 0 };
    return {
      errors: result.issues.filter((i) => i.severity === "error").length,
      warnings: result.issues.filter((i) => i.severity === "warning").length,
    };
  }, [result]);

  const visibleIssues = useMemo(() => {
    const all = result?.issues ?? [];
    return filter === "all" ? all : all.filter((i) => i.severity === filter);
  }, [filter, result]);

  if (!receipt || !result) {
    return (
      <section className="panel" aria-label="Verification output">
        <header className="panel-head">
          <h2>Verification output</h2>
          <p>
            Verification appears here as soon as you paste a receipt. The pipeline mirrors{" "}
            <code>receipt-cli verify</code> one-for-one in your browser.
          </p>
        </header>
        <div className="verdict-empty">
          <span className="placeholder-pulse" aria-hidden="true" />
          <p>Paste a receipt on the left to begin.</p>
        </div>
      </section>
    );
  }

  const tone: "pass" | "fail" = result.valid ? "pass" : "fail";
  const winner = result.computedWinner;

  return (
    <section className="panel" aria-label="Verification output">
      <header className="panel-head">
        <h2>Verification output</h2>
        <p>
          Issues list reflects what <code>verifyReceipt</code> flagged against the parsed
          receipt. The fingerprint below is the sha256 of the canonical re-serialised JSON.
        </p>
      </header>

      <div className={`verdict-banner ${tone}`} role="status">
        <span className={`verdict-state ${tone === "fail" ? "fail" : ""}`}>
          {result.valid ? "Verified" : "Verification failed"}
        </span>
        <h2>{result.valid ? "Receipt is valid" : `Found ${stats.errors} error${stats.errors === 1 ? "" : "s"}`}</h2>

        <div className="verdict-pill-row">
          <span className={`verdict-pill ${tone}`}>
            {result.valid ? "✓" : "✖"} <strong>{result.valid ? "PASS" : "FAIL"}</strong>
          </span>
          <span className="verdict-pill">
            Round <strong>#{roundId ?? "?"}</strong>
          </span>
          <span className="verdict-pill">
            Bidders <strong>{receipt.bidders.length}</strong>
          </span>
          <span className="verdict-pill">
            Status <strong>{receipt.status}</strong>
          </span>
          <span className="verdict-pill">
            Computed winner <strong>{winner.address ? truncate(winner.address, 6) : "—"}</strong>
            {" "}
            = <strong>{winner.value == null ? "—" : winner.value.toString()}</strong>
          </span>
          <span className={`verdict-pill ${stats.errors === 0 ? "pass" : "fail"}`}>
            Errors <strong>{stats.errors}</strong>
          </span>
          <span className="verdict-pill">
            Warnings <strong>{stats.warnings}</strong>
          </span>
        </div>

        <div className="verdict-foot">
          <span className="fingerprint">
            Fingerprint&nbsp;<code>{fingerprint ?? "—"}</code>
          </span>
        </div>
      </div>

      {result.issues.length === 0 ? (
        <p
          style={{
            marginTop: 16,
            color: "var(--muted)",
            fontFamily: "var(--mono)",
            fontSize: "0.82rem",
          }}
        >
          ✓ No issues found. Winner is consistent with the on-chain clearing rule.
        </p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div className="issue-filter" role="tablist" aria-label="Issue filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={filter === f.id ? "active" : ""}
                onClick={() => setFilter(f.id)}
              >
                {f.label} ({f.id === "all" ? result.issues.length : f.id === "error" ? stats.errors : stats.warnings})
              </button>
            ))}
          </div>

          <ul className="issue-list">
            {visibleIssues.map((issue, idx) => (
              <IssueRow key={`${issue.code}-${issue.path ?? idx}-${idx}`} issue={issue} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function IssueRow({ issue }: { issue: VerificationIssue }) {
  return (
    <li className={`issue-row ${issue.severity}`}>
      <span className="issue-mark">{issue.severity === "error" ? "✖" : "⚠"}</span>
      <div>
        <span>
          <code>{issue.code}</code> — {issue.message}
        </span>
        {issue.path ? <span className="issue-path">at {issue.path}</span> : null}
      </div>
    </li>
  );
}

function truncate(value: string, head: number): string {
  if (value.length <= head * 2 + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-head)}`;
}
