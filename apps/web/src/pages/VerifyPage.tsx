import { useEffect } from "react";
import { ExportReportPanel } from "../components/verify/ExportReportPanel";
import { ReceiptExplorer } from "../components/verify/ReceiptExplorer";
import { ReceiptInputPanel } from "../components/verify/ReceiptInputPanel";
import { SampleControls } from "../components/verify/SampleControls";
import { VerdictPanel } from "../components/verify/VerdictPanel";
import { useReceiptInput } from "../hooks/useReceiptInput";
import { useVerification } from "../hooks/useVerification";
import { readDataParam, decodePermalink } from "../verify/permalink";

export function VerifyPage({ goHome }: { goHome: () => void }) {
  const input = useReceiptInput();
  const verification = useVerification(input.receipt);

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
      </div>
    </main>
  );
}
