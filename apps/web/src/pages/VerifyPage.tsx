import { ReceiptInputPanel } from "../components/verify/ReceiptInputPanel";
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
      </div>
    </main>
  );
}
