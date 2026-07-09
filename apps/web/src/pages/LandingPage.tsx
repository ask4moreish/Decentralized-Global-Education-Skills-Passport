import { motion, useReducedMotion } from "framer-motion";
import { DEMO_TRACE } from "../demo/trace";
import { USE_CASES, type UseCaseId } from "../config/useCases";
import { LOGO_SRC } from "../lib/chain";
import { shortAddr } from "../lib/format";
import { DOCS_BASE_URL, VERTICALS, verticalDocsUrl } from "../lib/docs";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const staggerParent = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.12,
    },
  },
};

export function LandingPage({
  onDemo,
  onCase,
}: {
  onDemo: () => void;
  onCase: (useCase: UseCaseId) => void;
}) {
  const reduce = useReducedMotion();

  const transition = reduce
    ? { duration: 0 }
    : { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

  return (
    <main className="landing-page">
      <motion.nav
        className="landing-nav"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <button type="button" className="brand-link" onClick={onDemo}>
          <img src={LOGO_SRC} alt="" />
          <span>Decentralized Global Education & Skills Passport</span>
        </button>
        <div className="landing-nav-actions">
          <span className="landing-status-pill winner">Hack Privacy #1</span>
          <span className="landing-status-pill">testnet · live</span>
          <a href="https://github.com/decentralized-global-education-skills-passport/decentralized-global-education-skills-passport" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="#/verify" className="secondary-action compact" title="Paste a receipt and run verifyReceipt in your browser">
            Verify a receipt
          </a>
          <a href="#/dashboard" className="secondary-action compact">
            Dashboard
          </a>
          <button type="button" className="primary-action compact" onClick={onDemo}>
            Open demo
          </button>
        </div>
      </motion.nav>

      <motion.section
        className="landing-hero"
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        <motion.div className="hero-copy" variants={fadeUp} transition={transition}>
          <span className="hero-eyebrow">
            <span>SR</span>
            Sealed commit–reveal primitive on Stellar
          </span>
          <motion.h1 variants={fadeUp} transition={transition}>
            Sealed commit–reveal coordination. <em>One primitive, four verticals.</em>
          </motion.h1>
          <motion.p className="lede" variants={fadeUp} transition={transition}>
            A drop-in sealed commit–reveal primitive for judge panels, sealed bidding, sealed
            RFPs, and sealed credential portfolios — every workflow runs on the same Soroban
            contract, TypeScript SDK, tlock helpers, and permissionless keeper.
          </motion.p>
          <motion.p className="hero-infra-line" variants={fadeUp} transition={transition}>
            Scores, bids, and allocation inputs stay unreadable until Drand R, then reveal
            and settle publicly on Soroban.
          </motion.p>

          <motion.div className="hero-actions" variants={fadeUp} transition={transition}>
            <button type="button" className="primary-action large" onClick={onDemo}>
              Open sealed grant scoring demo
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <a className="secondary-action" href="#/architecture">
              Read the architecture
            </a>
          </motion.div>

          <motion.div
            className="hero-metrics"
            aria-label="Proof points"
            variants={fadeUp}
            transition={transition}
          >
            <div>
              <span>Drand gate</span>
              <strong>R {DEMO_TRACE.meta.revealRound.toLocaleString()}</strong>
            </div>
            <div>
              <span>Settlement</span>
              <strong>{DEMO_TRACE.keeper.contractBalanceFinal} USDC final</strong>
            </div>
            <div>
              <span>Verticals</span>
              <strong>4 today</strong>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-console"
          variants={fadeUp}
          transition={{ ...transition, delay: 0.18 }}
          aria-hidden="true"
        >
          <div className="console-status-row">
            <div>
              <span>allocation round</span>
              <strong>Scores sealed</strong>
            </div>
            <span className="status-tag">commit live</span>
          </div>

          <div className="seal-stage">
            <span className="seal-pulse" />
            <span className="seal-pulse" />
            <span className="seal-pulse" />
            <div className="seal-orb">
              <img src={LOGO_SRC} alt="" />
            </div>
            <span className="seal-chip commit">
              <i />
              commit · H
            </span>
            <span className="seal-chip cipher">
              <i />
              ciphertext
            </span>
            <span className="seal-chip drand">
              <i />
              Drand R
            </span>
          </div>

          <div className="console-events">
            <p>
              <strong>1</strong>
              <span>Judges submit sealed scores</span>
              <em>private</em>
            </p>
            <p>
              <strong>2</strong>
              <span>Drand R opens the scoring set</span>
              <em>public</em>
            </p>
            <p>
              <strong>3</strong>
              <span>Soroban settles the result</span>
              <em>verifiable</em>
            </p>
          </div>

          <div className="proof-strip">
            <span>{shortAddr(DEMO_TRACE.meta.contractId, 6)}</span>
            <span>sealed scoring</span>
            <span>round #{DEMO_TRACE.meta.roundId}</span>
          </div>
        </motion.div>
      </motion.section>

      <motion.section
        className="landing-verticals-section"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={staggerParent}
        aria-label="Verticals powered by the same primitive"
      >
        <motion.div
          className="landing-verticals-head"
          variants={fadeUp}
          transition={transition}
        >
          <div>
            <span className="verticals-eyebrow">Verticals</span>
            <h2>The same primitive powers every workflow.</h2>
          </div>
          <p>
            One Soroban sealed-round contract, one tlock helper, one keeper. The vertical
            changes &mdash; the primitive stays the same. Open any card for the full reference in{" "}
            <a
              href={`${DOCS_BASE_URL}/VERTICALS.md`}
              target="_blank"
              rel="noreferrer"
            >
              docs/VERTICALS.md
            </a>
            .
          </p>
        </motion.div>

        <motion.div className="landing-verticals-grid" variants={staggerParent}>
          {VERTICALS.map((v) => (
            <motion.a
              key={v.id}
              className="verticals-card-link"
              href={verticalDocsUrl(v)}
              target="_blank"
              rel="noreferrer"
              variants={fadeUp}
              transition={transition}
              whileHover={reduce ? undefined : { y: -3 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              aria-label={`Read about ${v.title} in docs/VERTICALS.md`}
            >
              <span className="verticals-card-pill">{v.pill}</span>
              <strong>{v.title}</strong>
              <p>{v.body}</p>
            </motion.a>
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        className="pilot-banner"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={transition}
      >
        <div>
          <span>Pilot 1 · Internal</span>
          <h2>OverBlock</h2>
        </div>
        <p>
          OverBlock is our internal &mdash; sealed judging, bounty allocation, and grant-style
          scoring on the same primitive. Pilot&nbsp;2 (sealed credential portfolios) and a parallel
          outreach track live alongside it.
        </p>
      </motion.section>

      <section className="landing-cases-section">
        <motion.div
          className="landing-cases-head"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={transition}
        >
          <h2>Run a verifiable allocation workflow.</h2>
          <p>
            Each case uses the same sealed-round primitive: inputs stay hidden until reveal, then
            the result is public and enforceable on Stellar.
          </p>
        </motion.div>

        <motion.div
          className="landing-cases"
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          {USE_CASES.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              className="case-card-link"
              onClick={() => onCase(item.id)}
              variants={fadeUp}
              transition={transition}
              whileHover={reduce ? undefined : { y: -3 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
            >
              <span>{item.tagline}</span>
              <strong>{item.oneLine}</strong>
            </motion.button>
          ))}
        </motion.div>
      </section>
    </main>
  );
}
