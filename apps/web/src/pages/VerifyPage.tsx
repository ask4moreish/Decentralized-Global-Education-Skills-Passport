import { ReceiptInputPanel } from "../components/verify/ReceiptInputPanel";
import { VerdictPanel } from "../components/verify/VerdictPanel";
import { useReceiptInput } from "../hooks/useReceiptInput";

export function VerifyPage({ goHome }: { goHome: () => void }) {
  const input = useReceiptInput();

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
        <ReceiptInputPanel input={input} />
        <VerdictPanel receipt={input.receipt} />
      </div>
    </main>
  );
}
