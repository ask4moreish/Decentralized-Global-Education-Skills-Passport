import { useEffect, useState } from "react";
import { ExportReportPanel } from "../components/verify/ExportReportPanel";
import { ReceiptExplorer } from "../components/verify/ReceiptExplorer";
import { ReceiptInputPanel } from "../components/verify/ReceiptInputPanel";
import { SampleControls } from "../components/verify/SampleControls";
import { VerdictPanel } from "../components/verify/VerdictPanel";
import { useReceiptInput } from "../hooks/useReceiptInput";
import { useVerification } from "../hooks/useVerification";
import { readDataParam, decodePermalink } from "../verify/permalink";
import { useReceiptHistory, ReceiptHistoryPanel } from "../receipts";
import { useToast } from "../ui/Toast";
import type { SavedReceipt } from "../receipts";

export function VerifyPage({ goHome }: { goHome: () => void }) {
  const input = useReceiptInput();
  const verification = useVerification(input.receipt);
  const receiptStore = useReceiptHistory();
  const toast = useToast();
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | undefined>();

  // Pull a receipt straight out of a shared permalink (?d=...). Runs once on
  // mount so manually pasting after the fact still wins.
  useEffect(() => {
    const data = readDataParam(window.location.hash);
    const decoded = decodePermalink(data);
    if (decoded && decoded !== input.rawJson) {
      input.load(decoded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alreadySaved = input.receipt && verification.fingerprint
    ? receiptStore.hasReceipt(verification.fingerprint)
    : false;

  function handleSave() {
    if (!input.receipt || !verification.fingerprint) return;
    const receipt: SavedReceipt = {
      id: `receipt-${Date.now()}`,
      savedAt: Date.now(),
      label: `Round #${input.receipt.roundId}`,
      tags: [],
      notes: "",
      receiptJson: input.rawJson,
      fingerprint: verification.fingerprint,
      roundId: input.receipt.roundId,
      contractId: input.receipt.contractId,
      valid: verification.result?.valid ?? false,
      verifiedAt: new Date().toISOString(),
      errorCount: verification.result?.issues.filter((i) => i.severity === "error").length ?? 0,
      warningCount: verification.result?.issues.filter((i) => i.severity === "warning").length ?? 0,
    };
    receiptStore.saveReceipt(receipt);
    toast.push("success", "Receipt saved", `Round #${receipt.roundId} added to your history.`);
  }

  function handleSelectReceipt(receipt: SavedReceipt) {
    setSelectedReceiptId(receipt.id);
    input.load(receipt.receiptJson);
  }

  return (
    <main className="app-frame">
      <nav className="verify-page-nav">
        <button type="button" className="verify-page-brand" onClick={goHome}>
          ← Back to home
        </button>
        <div className="verify-page-title">
          <span className="eyebrow">Off-chain tools</span>
          <h1>Receipt verifier</h1>
        </div>
      </nav>

      <div className="verify-layout">
        <ReceiptInputPanel input={input} toolbar={<SampleControls input={input} />} />
        <VerdictPanel receipt={input.receipt} />
      </div>

      <div className="verify-extras">
        <ReceiptExplorer receipt={input.receipt} verification={verification} />
        <ExportReportPanel receipt={input.receipt} verification={verification} />
        {input.receipt ? (
          <button
            type="button"
            className={`receipt-save-btn ${alreadySaved ? "saved" : ""}`}
            onClick={handleSave}
            disabled={alreadySaved}
          >
            {alreadySaved ? "✓ Saved" : "💾 Save receipt"}
          </button>
        ) : null}
      </div>

      <ReceiptHistoryPanel
        receipts={receiptStore.receipts}
        onDelete={receiptStore.deleteReceipt}
        onUpdate={receiptStore.updateReceipt}
        onSelect={handleSelectReceipt}
        selectedId={selectedReceiptId}
      />
    </main>
  );
}
