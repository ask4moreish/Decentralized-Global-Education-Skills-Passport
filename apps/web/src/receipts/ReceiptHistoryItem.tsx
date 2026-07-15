import { useState } from "react";
import type { SavedReceipt } from "./types";

function relativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { dateStyle: "short" });
}

interface ReceiptHistoryItemProps {
  receipt: SavedReceipt;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Pick<SavedReceipt, "label" | "tags" | "notes">>) => void;
}

export function ReceiptHistoryItem({
  receipt,
  selected,
  onSelect,
  onDelete,
  onUpdate,
}: ReceiptHistoryItemProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(receipt.label);
  const [tagInput, setTagInput] = useState("");

  const handleSaveLabel = () => {
    onUpdate({ label: label.trim() || `Round #${receipt.roundId}` });
    setEditing(false);
  };

  return (
    <div className={`receipt-history-item ${selected ? "selected" : ""} ${receipt.valid ? "valid" : "invalid"}`}>
      <button type="button" className="receipt-history-item-main" onClick={onSelect}>
        <div className="receipt-history-item-head">
          {editing ? (
            <input
              type="text"
              className="receipt-history-label-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleSaveLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveLabel();
                if (e.key === "Escape") {
                  setLabel(receipt.label);
                  setEditing(false);
                }
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <strong
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              title="Click to rename"
            >
              {receipt.label || `Round #${receipt.roundId}`}
            </strong>
          )}
          <span className={`receipt-valid-badge ${receipt.valid ? "pass" : "fail"}`}>
            {receipt.valid ? "✓ Valid" : "✗ Invalid"}
          </span>
        </div>
        <div className="receipt-history-item-meta">
          <span>Round #{receipt.roundId}</span>
          <span>{relativeDate(receipt.savedAt)}</span>
          {receipt.errorCount > 0 ? <span className="receipt-error-count">{receipt.errorCount} errors</span> : null}
        </div>
        <div className="receipt-tag-row">
          {receipt.tags.map((tag) => (
            <span key={tag} className="receipt-tag">
              {tag}
              <button
                type="button"
                className="receipt-tag-remove"
                aria-label={`Remove tag ${tag}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ tags: receipt.tags.filter((t) => t !== tag) });
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="receipt-tag-input"
            placeholder="+ tag"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagInput.trim()) {
                e.stopPropagation();
                if (!receipt.tags.includes(tagInput.trim())) {
                  onUpdate({ tags: [...receipt.tags, tagInput.trim()] });
                }
                setTagInput("");
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </button>
      <button
        type="button"
        className="receipt-history-item-delete"
        aria-label="Delete receipt"
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}
