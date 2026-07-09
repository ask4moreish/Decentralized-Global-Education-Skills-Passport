import { ReceiptExplorer } from "../components/verify/ReceiptExplorer";
import { ReceiptInputPanel } from "../components/verify/ReceiptInputPanel";
import { SampleControls } from "../components/verify/SampleControls";
import { VerdictPanel } from "../components/verify/VerdictPanel";
import { useReceiptInput } from "../hooks/useReceiptInput";
import { useVerification } from "../hooks/useVerification";

export function VerifyPage({ goHome }: { goHome: () => void }) {
  const input = useReceiptInput();
  const verification = useVerification(input.receipt);

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
      </div>
    </main>
  );
}
