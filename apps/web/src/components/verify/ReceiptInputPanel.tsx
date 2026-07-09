import { useRef, type DragEvent, type ReactNode } from "react";
import type { UseReceiptInputResult } from "../../hooks/useReceiptInput";

export interface ReceiptInputPanelProps {
  input: UseReceiptInputResult;
  /** Optional slot rendered above the dropzone (commit 4 mounts sample buttons here). */
  toolbar?: ReactNode;
}

export function ReceiptInputPanel({ input, toolbar }: ReceiptInputPanelProps) {
  // Reset the <input type="file"> after each pick so re-selecting the same file fires `onChange` again.
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    void file.text().then((text) => input.setRawJson(text));
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <section className="panel receipt-input" aria-label="Receipt input">
      <header className="panel-head">
        <h2>Paste a round receipt</h2>
        <p>
          Drop a <code>.json</code> file, paste canonical receipt JSON, or pick a sample below.
          Verification runs entirely in your browser — no RPC, no server round-trip.
        </p>
      </header>

      {toolbar}

      <label
        className="receipt-input-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="receipt-input-file"
          aria-label="Choose receipt JSON file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // Allow picking the same file again later.
            e.target.value = "";
          }}
        />
        <span className="receipt-input-dropzone-prompt">
          Drop a receipt file here, or click to browse…
        </span>
      </label>

      <label className="receipt-input-textarea-wrap">
        <span className="receipt-input-textarea-label">Receipt JSON</span>
        <textarea
          className="receipt-input-textarea"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder='{"version":1,"network":"…","roundId":"…",…}'
          value={input.rawJson}
          onChange={(e) => input.setRawJson(e.target.value)}
          rows={18}
          aria-label="Receipt JSON"
        />
      </label>

      <div className="receipt-input-status">
        {input.parseError ? (
          <span className="receipt-input-error" role="alert" title={input.parseError}>
            ✖ {input.parseError}
          </span>
        ) : input.receipt ? (
          <span className="receipt-input-ok">
            ✓ Parsed receipt — round <code>{input.receipt.roundId}</code> on{" "}
            <code>{input.receipt.status}</code>.
          </span>
        ) : (
          <span className="receipt-input-empty">Awaiting receipt input…</span>
        )}
        <button
          type="button"
          className="ghost-action compact"
          onClick={input.clear}
          disabled={!input.rawJson}
        >
          Clear
        </button>
      </div>
    </section>
  );
}
