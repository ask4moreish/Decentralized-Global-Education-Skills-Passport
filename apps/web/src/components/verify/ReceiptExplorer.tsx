import { useMemo, useState } from "react";
import { FIELD_SECTIONS } from "../../verify/fieldDocs";
import type { UseVerificationResult } from "../../hooks/useVerification";
import type { RoundReceipt, VerificationIssue } from "@decentralized-global-education-skills-passport/sdk";

export interface ReceiptExplorerProps {
  receipt: RoundReceipt | null;
  verification: UseVerificationResult;
}

/**
 * Two-column receipt explorer.
 *
 * Left: section list. Right: detail of the currently selected field with a
 * short human-readable description and the actual value pulled from the
 * receipt. Fields flagged by the verifier carry a red dot — so users can
 * visually link an issue.path back to the offending field.
 */
export function ReceiptExplorer({ receipt, verification }: ReceiptExplorerProps) {
  const [activeId, setActiveId] = useState<string>(FIELD_SECTIONS[0]?.id ?? "");
  const [activePath, setActivePath] = useState<string>(
    FIELD_SECTIONS[0]?.fields[0]?.path ?? "",
  );

  const flaggedPaths = useMemo(() => {
    const set = new Set<string>();
    for (const issue of verification.result?.issues ?? []) {
      if (issue.path) set.add(issue.path);
    }
    return set;
  }, [verification.result]);

  const flaggedBidders = useMemo(() => {
    const set = new Set<string>();
    for (const issue of verification.result?.issues ?? []) {
      if (!issue.path) continue;
      const match = issue.path.match(/^bids\.([^.]+)/);
      if (match) set.add(match[1]);
    }
    return set;
  }, [verification.result]);

  if (!receipt) {
    return null;
  }

  const section = FIELD_SECTIONS.find((s) => s.id === activeId) ?? FIELD_SECTIONS[0];
  const field = section?.fields.find((f) => f.path === activePath) ?? section?.fields[0];
  const bidderPath = field?.path.startsWith("bids.<address>") ?? false;
  const bidderList = !bidderPath ? [] : expandedBidderFields(receipt, flaggedPaths, flaggedBidders);

  return (
    <section className="panel receipt-explorer-section" aria-label="Receipt field explorer">
      <header className="panel-head">
        <h2>What every receipt field means</h2>
        <p>
          Each field has a short description. The verifier's{" "}
          <code>VerificationIssue.path</code> maps one-to-one to a tree entry, so a
          flagged field shows a red dot. No clue where a code came from? Click into
          the related field for the contract-level meaning.
        </p>
      </header>

      <div className="receipt-explorer">
        <nav aria-label="Field sections">
          <ul>
            {FIELD_SECTIONS.map((s) => {
              const flagged = s.fields.some((f) => flaggedFieldIncludes(f.path, flaggedPaths));
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={s.id === activeId ? "active" : ""}
                    onClick={() => {
                      setActiveId(s.id);
                      const firstField = s.fields[0];
                      if (firstField) setActivePath(firstField.path);
                    }}
                  >
                    {s.title}
                    {flagged ? <span className="explorer-flag" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="receipt-explorer-detail">
          <header>
            <span>{section?.title ?? ""}</span>
            <h3>{field?.label ?? ""}</h3>
          </header>
          <p>{field?.description ?? ""}</p>

          {bidderPath && receipt ? (
            <BidderFieldTable entries={bidderList} />
          ) : field ? (
            <pre className="field-kv">
              {renderValueForField(receipt, field.path)}
            </pre>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function flaggedFieldIncludes(fieldPath: string, flaggedPaths: Set<string>): boolean {
  for (const flagged of flaggedPaths) {
    if (flagged.startsWith(fieldPath.replace("<address>", ""))) return true;
  }
  return false;
}

interface ExpandedBidderEntry {
  bidder: string;
  commitment?: unknown;
  escrow?: unknown;
  revealedValue?: unknown;
  nonce?: unknown;
  evidence?: unknown;
  flagged: boolean;
}

function expandedBidderFields(
  receipt: RoundReceipt,
  flaggedPaths: Set<string>,
  flaggedBidders: Set<string>,
): ExpandedBidderEntry[] {
  return receipt.bidders.map((bidder) => {
    const entry = receipt.bids[bidder];
    const flagged =
      flaggedBidders.has(bidder) ||
      Array.from(flaggedPaths).some((p) => p.startsWith(`bids.${bidder}`));
    return {
      bidder,
      commitment: entry?.commitment,
      escrow: entry?.escrow,
      revealedValue: entry?.revealedValue,
      nonce: entry?.nonce,
      evidence: entry?.evidence,
      flagged,
    };
  });
}

function BidderFieldTable({ entries }: { entries: ExpandedBidderEntry[] }) {
  return (
    <div className="table-wrap" style={{ marginTop: 12 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Bidder</th>
            <th>Commitment</th>
            <th>Escrow</th>
            <th>Revealed</th>
            <th>Nonce</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.bidder} style={e.flagged ? { background: "rgba(217,122,115,0.08)" } : undefined}>
              <td>
                <code>{truncate(e.bidder, 6)}</code>
                {e.flagged ? <span className="explorer-flag" style={{ marginLeft: 6 }} /> : null}
              </td>
              <td><code style={{ wordBreak: "break-all" }}>{stringify(e.commitment)}</code></td>
              <td><code>{stringify(e.escrow)}</code></td>
              <td><code>{stringify(e.revealedValue)}</code></td>
              <td><code style={{ wordBreak: "break-all" }}>{stringify(e.nonce ?? "—")}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderValueForField(receipt: RoundReceipt, path: string): string {
  const v = getByPath(receipt, path);
  return stringify(v);
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return JSON.stringify(value, null, 2);
}

function truncate(value: string, head: number): string {
  if (value.length <= head * 2 + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-head)}`;
}
