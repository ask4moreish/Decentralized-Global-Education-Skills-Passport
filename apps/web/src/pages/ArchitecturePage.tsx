import architectureMd from "../../../../ARCHITECTURE.md?raw";
import { LOGO_SRC } from "../lib/chain";

export function ArchitecturePage({ goHome }: { goHome: () => void }) {
  return (
    <main className="architecture-page">
      <nav className="architecture-nav">
        <button type="button" className="brand-link" onClick={goHome}>
          <img src={LOGO_SRC} alt="" />
          <span>Decentralized Global Education & Skills Passport</span>
        </button>
        <div className="architecture-nav-actions">
          <button type="button" className="secondary-action compact" onClick={goHome}>
            Back to demo
          </button>
        </div>
      </nav>

      <section className="architecture-intro" aria-label="Primitive overview">
        <span className="architecture-eyebrow">Soroban sealed commit–reveal architecture</span>
        <h1>The primitive, end-to-end.</h1>
        <p>
          One Soroban contract, one Drand reveal round, one tlock-encrypted value.
          <br />
          The document below names the contracts, the message flow, the on-chain state machine,
          and the verifier receipt — the same surface regardless of which vertical you map onto it.
        </p>
      </section>
      <article className="architecture-doc" aria-label="ARCHITECTE.md content">
        <pre>{architectureMd}</pre>
      </article>
    </main>
  );
}
