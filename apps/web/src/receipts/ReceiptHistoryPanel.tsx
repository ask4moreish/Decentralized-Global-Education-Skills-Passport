import { useMemo, useState } from "react";
import type { SavedReceipt, ReceiptSortKey, ReceiptSortDir } from "./types";
import { ReceiptHistoryItem } from "./ReceiptHistoryItem";

interface ReceiptHistoryPanelProps {
  receipts: SavedReceipt[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<SavedReceipt, "label" | "tags" | "notes">>) => void;
  onSelect: (receipt: SavedReceipt) => void;
  onClearAll: () => void;
  selectedId?: string;
}

export function ReceiptHistoryPanel({
  receipts,
  onDelete,
  onUpdate,
  onSelect,
  onClearAll,
  selectedId,
}: ReceiptHistoryPanelProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<ReceiptSortKey>("savedAt");
  const [sortDir, setSortDir] = useState<ReceiptSortDir>("desc");

  const filtered = useMemo(() => {
    let list = [...receipts];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.roundId.includes(q) ||
          r.contractId.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "savedAt") cmp = a.savedAt - b.savedAt;
      else if (sortKey === "roundId") cmp = a.roundId.localeCompare(b.roundId, undefined, { numeric: true });
      else if (sortKey === "label") cmp = a.label.localeCompare(b.label);
      else if (sortKey === "valid") cmp = Number(a.valid) - Number(b.valid);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [receipts, search, sortKey, sortDir]);

  const toggleSort = (key: ReceiptSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <section className="receipt-history-panel" aria-label="Saved receipts">
      <header className="receipt-history-header">
        <h2>Saved receipts ({receipts.length})</h2>
        <div className="receipt-history-header-actions">
          {receipts.length > 0 ? (
            <button type="button" className="receipt-clear-all-btn" onClick={onClearAll} title="Clear all saved receipts">
              Clear all
            </button>
          ) : null}
        </div>
        <input
          type="search"
          className="receipt-history-search"
          placeholder="Search by label, round, contract, tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search receipts"
        />
      </header>

      <div className="receipt-history-sort">
        {(["savedAt", "roundId", "label", "valid"] as ReceiptSortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`receipt-sort-btn ${sortKey === key ? "active" : ""}`}
            onClick={() => toggleSort(key)}
          >
            {key === "savedAt" ? "Date" : key === "roundId" ? "Round" : key === "label" ? "Label" : "Valid"}
            {sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
          </button>
        ))}
      </div>

      <div className="receipt-history-list">
        {filtered.length === 0 ? (
          <div className="receipt-history-empty">
            {receipts.length === 0 ? (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <p>No saved receipts yet</p>
                <small>Verify a receipt above and click Save to add it here.</small>
              </>
            ) : (
              <p>No receipts match your search</p>
            )}
          </div>
        ) : (
          filtered.map((receipt) => (
            <ReceiptHistoryItem
              key={receipt.id}
              receipt={receipt}
              selected={receipt.id === selectedId}
              onSelect={() => onSelect(receipt)}
              onDelete={() => onDelete(receipt.id)}
              onUpdate={(patch) => onUpdate(receipt.id, patch)}
            />
          ))
        )}
      </div>
    </section>
  );
}
