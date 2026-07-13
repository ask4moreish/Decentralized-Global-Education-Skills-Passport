import { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LOGO_SRC } from "../lib/chain";
import { shortHash } from "../lib/format";
import {
  formatDrandCountdown,
  useDrandBeacon,
  fetchDrandBeaconByRound,
  type DrandBeaconData,
  type RoundLatencyEntry,
} from "../hooks/useDrandBeacon";

function BeaconStatusDot({ published }: { published: boolean }) {
  return (
    <span
      className={`drand-beacon-dot ${published ? "published" : "waiting"}`}
      aria-hidden="true"
    />
  );
}

// ── DrandLatencyChart ───────────────────────────────────────────────
// SVG bar chart showing publication latency for recent rounds.
// Bars are color-coded: green (< 1s), amber (1-2s), red (> 2s).

function DrandLatencyChart({
  history,
  period,
}: {
  history: RoundLatencyEntry[];
  period: number;
}) {
  if (history.length === 0) return null;

  const maxLatency = Math.max(
    ...history.map((e) => e.latencyMs),
    period * 1000, // ensure the scale is at least 1 period wide
  );

  // Only show the most recent entries that fit
  const visible = history.slice(0, 20);

  function barColor(latencyMs: number): string {
    if (latencyMs < 1000) return "var(--green)";
    if (latencyMs < 2000) return "var(--amber)";
    return "var(--alert)";
  }

  function barLabel(latencyMs: number): string {
    if (latencyMs < 1000) return `< 1s`;
    return `${(latencyMs / 1000).toFixed(1)}s`;
  }

  const BAR_HEIGHT = 18;
  const BAR_GAP = 4;
  const LABEL_WIDTH = 60;
  const SCALE_WIDTH = 120;
  const SVG_HEIGHT = visible.length * (BAR_HEIGHT + BAR_GAP) + 24;

  return (
    <section className="drand-card drand-latency-card">
      <header className="drand-card-header">
        <h2>Publication latency</h2>
        <span
          className="drand-latency-legend"
          title="Green: <1s · Amber: 1-2s · Red: >2s"
        >
          <i style={{ background: "var(--green)" }} />
          <i style={{ background: "var(--amber)" }} />
          <i style={{ background: "var(--alert)" }} />
        </span>
      </header>
      <div className="drand-latency-body">
        <p className="drand-muted">
          Time between the expected publish time and when the beacon was observed, for the
          last {visible.length} rounds. Quicknet publishes every {period}s.
        </p>
        <div className="drand-latency-chart-wrap">
          <svg
            width="100%"
            height={SVG_HEIGHT}
            viewBox={`0 0 ${LABEL_WIDTH + SCALE_WIDTH + 8} ${SVG_HEIGHT}`}
            aria-label="Round publication latency chart"
            role="img"
          >
            {/* Baseline grid line at 0 */}
            <line
              x1={LABEL_WIDTH}
              y1={0}
              x2={LABEL_WIDTH}
              y2={SVG_HEIGHT - 12}
              stroke="var(--line-1)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />

            {/* Grid line at 1x period */}
            <line
              x1={LABEL_WIDTH + SCALE_WIDTH}
              y1={0}
              x2={LABEL_WIDTH + SCALE_WIDTH}
              y2={SVG_HEIGHT - 12}
              stroke="var(--line-0)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />

            {visible.map((entry, i) => {
              const y = 12 + i * (BAR_HEIGHT + BAR_GAP);
              const pct = Math.min(entry.latencyMs / maxLatency, 1);
              const barW = pct * SCALE_WIDTH;
              const color = barColor(entry.latencyMs);

              return (
                <g key={entry.round}>
                  {/* Round number label */}
                  <text
                    x={LABEL_WIDTH - 4}
                    y={y + BAR_HEIGHT - 4}
                    textAnchor="end"
                    fill="var(--muted)"
                    fontFamily="var(--mono)"
                    fontSize="10"
                  >
                    #{entry.round.toLocaleString()}
                  </text>

                  {/* Latency bar */}
                  <rect
                    x={LABEL_WIDTH}
                    y={y}
                    width={Math.max(barW, 2)}
                    height={BAR_HEIGHT}
                    rx={3}
                    fill={color}
                    opacity={0.85}
                  >
                    <title>{barLabel(entry.latencyMs)}</title>
                  </rect>

                  {/* Latency label */}
                  <text
                    x={LABEL_WIDTH + barW + 4}
                    y={y + BAR_HEIGHT - 4}
                    fill="var(--muted)"
                    fontFamily="var(--mono)"
                    fontSize="9"
                  >
                    {barLabel(entry.latencyMs)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="drand-page">
      <div className="drand-nav">
        <span className="drand-skeleton" style={{ width: 200, height: 36 }} />
      </div>
      <div className="drand-loading-state">
        <div className="drand-spinner" />
        <p>Syncing with Drand quicknet...</p>
      </div>
    </div>
  );
}

export function DrandPage({ goHome }: { goHome: () => void }) {
  const reduce = useReducedMotion();
  const drand = useDrandBeacon();
  const [searchRound, setSearchRound] = useState("");
  const [searchResult, setSearchResult] = useState<{
    loading: boolean;
    data: DrandBeaconData | null;
    error: string | null;
  }>({ loading: false, data: null, error: null });

  const transition = reduce
    ? { duration: 0 }
    : { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

  const handleSearch = useCallback(async () => {
    const round = parseInt(searchRound.trim(), 10);
    if (isNaN(round) || round < 1) {
      setSearchResult({ loading: false, data: null, error: "Enter a valid round number (>= 1)" });
      return;
    }
    setSearchResult({ loading: true, data: null, error: null });
    const result = await fetchDrandBeaconByRound(round);
    if (result) {
      setSearchResult({ loading: false, data: result, error: null });
    } else {
      setSearchResult({
        loading: false,
        data: null,
        error: `Round ${round} not yet published or unreachable.`,
      });
    }
  }, [searchRound]);

  // Extract to local const for TypeScript narrowing (JSX ternary scopes don't narrow).
  const currentRound = drand.currentRound;

  const beaconHistory = useMemo(() => {
    if (!drand.latest || !currentRound) return [];
    const rounds: DrandBeaconData[] = [];
    // Show recent rounds: current-3 to current (latest)
    for (let r = Math.max(1, currentRound - 3); r <= currentRound; r++) {
      if (r === drand.latest.round) {
        rounds.push(drand.latest);
      } else {
        rounds.push({
          round: r,
          randomness: "—",
          signature: "—",
        });
      }
    }
    return rounds;
  }, [drand]);

  if (drand.loading) {
    return <LoadingSkeleton />;
  }

  return (
    <main className="drand-page">
      <motion.nav
        className="drand-nav"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <button type="button" className="brand-link" onClick={goHome}>
          <img src={LOGO_SRC} alt="" />
          <span>Decentralized Global Education & Skills Passport</span>
        </button>
        <div className="drand-nav-actions">
          <button type="button" className="secondary-action compact" onClick={goHome}>
            Back to home
          </button>
        </div>
      </motion.nav>

      <motion.header
        className="drand-header"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
      >
        <div>
          <span className="drand-eyebrow">Drand beacon explorer</span>
          <h1>Drand quicknet</h1>
          <p className="drand-lede">
            Live monitor for the Drand quicknet randomness beacon. Every 3 seconds, a new
            publicly-verifiable BLS signature is published. The Round contract uses signature{" "}
            <strong>R</strong> as the cryptographic gate for sealed reveals.
          </p>
        </div>
        <div className="drand-hero-metrics">
          <div>
            <span>Network</span>
            <strong>quicknet</strong>
          </div>
          <div>
            <span>Scheme</span>
            <strong>{drand.chain?.schemeID ?? "—"}</strong>
          </div>
          <div>
            <span>Period</span>
            <strong>{drand.chain?.period ?? "—"}s</strong>
          </div>
        </div>
      </motion.header>

      {drand.error ? (
        <div className="drand-error-banner" role="alert">
          <span>Could not reach Drand quicknet: {drand.error}</span>
          <p>
            This is likely a transient network issue. The page will keep polling.
          </p>
        </div>
      ) : null}

      {/* Main grid */}
      <div className="drand-grid">
        {/* Column 1: live beacon & countdown */}
        <div className="drand-column">
          <section className="drand-card drand-beacon-card">
            <header className="drand-card-header">
              <h2>Live beacon</h2>
              <BeaconStatusDot published={drand.latest !== null} />
            </header>

            <div className="drand-beacon-body">
              <div className="drand-current-round">
                <span className="drand-round-label">Current round</span>
                <strong className="drand-round-number">
                  {drand.currentRound?.toLocaleString() ?? "—"}
                </strong>
              </div>

              <div className="drand-countdown-section">
                <span className="drand-round-label">Next round in</span>
                <strong className="drand-countdown-value">
                  {formatDrandCountdown(drand.secondsUntilNext)}
                </strong>
                <div className="drand-countdown-track">
                  <motion.div
                    className="drand-countdown-fill"
                    animate={{
                      width: `${
                        drand.chain
                          ? ((drand.chain.period - drand.secondsUntilNext) /
                              drand.chain.period) *
                            100
                          : 0
                      }%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="drand-round-label">
                  Next round <strong>#{drand.nextRound?.toLocaleString() ?? "—"}</strong>
                  {drand.nextRoundTime
                    ? ` · ${new Date(drand.nextRoundTime * 1000).toLocaleTimeString()}`
                    : ""}
                </span>
              </div>

              {drand.latest ? (
                <div className="drand-latest-details">
                  <div className="drand-kv">
                    <dt>Latest published</dt>
                    <dd>Round #{drand.latest.round.toLocaleString()}</dd>
                  </div>
                  <div className="drand-kv">
                    <dt>Randomness</dt>
                    <dd>
                      <code className="drand-hex" title={drand.latest.randomness}>
                        {shortHash(drand.latest.randomness, 16)}
                      </code>
                    </dd>
                  </div>
                  <div className="drand-kv">
                    <dt>Signature (G1)</dt>
                    <dd>
                      <code className="drand-hex" title={drand.latest.signature}>
                        {shortHash(drand.latest.signature, 16)}
                      </code>
                    </dd>
                  </div>
                </div>
              ) : (
                <p className="drand-muted">Awaiting first beacon data...</p>
              )}
            </div>
          </section>

          {/* Chain info card */}
          <section className="drand-card drand-chain-card">
            <header className="drand-card-header">
              <h2>Chain parameters</h2>
            </header>
            <div className="drand-chain-body">
              <div className="drand-kv-row">
                <span className="drand-kv-label">Chain hash</span>
                <span className="drand-kv-value">
                  <code>{shortHash(drand.chain?.hash ?? "", 16)}</code>
                </span>
              </div>
              <div className="drand-kv-row">
                <span className="drand-kv-label">Public key (G2)</span>
                <span className="drand-kv-value">
                  <code className="drand-hex" title={drand.chain?.publicKey}>
                    {shortHash(drand.chain?.publicKey ?? "", 20)}
                  </code>
                </span>
              </div>
              <div className="drand-kv-row">
                <span className="drand-kv-label">Genesis time</span>
                <span className="drand-kv-value">
                  {drand.chain
                    ? new Date(drand.chain.genesisTime * 1000).toLocaleString()
                    : "—"}
                </span>
              </div>
              <div className="drand-kv-row">
                <span className="drand-kv-label">Period</span>
                <span className="drand-kv-value">{drand.chain?.period ?? "—"} seconds</span>
              </div>
              <div className="drand-kv-row">
                <span className="drand-kv-label">Scheme</span>
                <span className="drand-kv-value">
                  <code>{drand.chain?.schemeID ?? "—"}</code>
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Column 2: round search & recent history */}
        <div className="drand-column">
          {/* Round search */}
          <section className="drand-card drand-search-card">
            <header className="drand-card-header">
              <h2>Look up a round</h2>
            </header>
            <div className="drand-search-body">
              <p className="drand-muted">
                Enter a round number to fetch its beacon data. Rounds are published every 3s —
                query any past or future round.
              </p>
              <div className="drand-search-row">
                <div className="drand-search-input">
                  <span className="drand-search-prefix">#</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={
                      currentRound
                        ? `e.g. ${currentRound}`
                        : "round number"
                    }
                    value={searchRound}
                    onChange={(e) =>
                      setSearchRound(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && searchRound.trim()) {
                        void handleSearch();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="primary-action compact"
                  onClick={handleSearch}
                  disabled={!searchRound.trim() || searchResult.loading}
                >
                  {searchResult.loading ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : null}
                  Look up
                </button>
              </div>

              {searchResult.error ? (
                <div className="drand-search-error" role="alert">
                  {searchResult.error}
                </div>
              ) : null}

              {searchResult.data ? (
                <div className="drand-search-result">
                  <div className="drand-result-badge">
                    Round #{searchResult.data.round.toLocaleString()}
                  </div>
                  <div className="drand-result-details">
                    <div className="drand-kv">
                      <dt>Randomness</dt>
                      <dd>
                        <code title={searchResult.data.randomness}>
                          {shortHash(searchResult.data.randomness, 20)}
                        </code>
                      </dd>
                    </div>
                    <div className="drand-kv">
                      <dt>Signature</dt>
                      <dd>
                        <code title={searchResult.data.signature}>
                          {shortHash(searchResult.data.signature, 20)}
                        </code>
                      </dd>
                    </div>
                    {drand.chain ? (
                      <div className="drand-kv">
                        <dt>Expected time</dt>
                        <dd>
                          {new Date(
                            (drand.chain.genesisTime +
                              drand.chain.period * searchResult.data.round) *
                              1000,
                          ).toLocaleString()}
                        </dd>
                      </div>
                    ) : null}
                    {currentRound != null &&
                    searchResult.data.round > currentRound ? (
                      <div className="drand-kv">
                        <dt>Status</dt>
                        <dd>
                          <span className="drand-status-tag future">
                            Future · round not yet published
                          </span>
                        </dd>
                      </div>
                    ) : (
                      <div className="drand-kv">
                        <dt>Status</dt>
                        <dd>
                          <span className="drand-status-tag published">
                            Published
                          </span>
                        </dd>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* Recent round history */}
          <section className="drand-card drand-history-card">
            <header className="drand-card-header">
              <h2>Recent rounds</h2>
            </header>
            <div className="drand-history-body">
              <p className="drand-muted">
                The last few quicknet rounds. Each is a publicly-verifiable BLS signature
                anyone can check against the chain's public key.
              </p>
              <div className="drand-timeline">
                {currentRound ? (
                  <>
                    {/* Future round pill (next) */}
                    <div className="drand-timeline-row future">
                      <span className="drand-timeline-dot" aria-hidden="true" />
                      <div className="drand-timeline-info">
                        <strong>#{drand.nextRound?.toLocaleString() ?? "—"}</strong>
                        <span className="drand-timeline-label">Next · ~{formatDrandCountdown(drand.secondsUntilNext)}</span>
                      </div>
                    </div>

                    {/* Current round pill */}
                    <div className="drand-timeline-row current">
                      <span className="drand-timeline-dot" aria-hidden="true" />
                      <div className="drand-timeline-info">
                        <strong>#{currentRound.toLocaleString()}</strong>
                        <span className="drand-timeline-label">
                          {drand.latest && drand.latest.round >= currentRound
                            ? "Published"
                            : "Publishing..."}
                        </span>
                      </div>
                      {drand.latest && drand.latest.round >= currentRound ? (
                        <code className="drand-timeline-hash" title={drand.latest.randomness}>
                          {shortHash(drand.latest.randomness, 10)}
                        </code>
                      ) : null}
                    </div>

                    {/* Past rounds */}
                    {beaconHistory
                      .filter((b) => b.round < currentRound)
                      .reverse()
                      .map((b) => (
                        <div key={b.round} className="drand-timeline-row past">
                          <span className="drand-timeline-dot" aria-hidden="true" />
                          <div className="drand-timeline-info">
                            <strong>#{b.round.toLocaleString()}</strong>
                            <span className="drand-timeline-label">Published</span>
                          </div>
                          {b.randomness !== "—" ? (
                            <code className="drand-timeline-hash" title={b.randomness}>
                              {shortHash(b.randomness, 10)}
                            </code>
                          ) : null}
                        </div>
                      ))}
                  </>
                ) : (
                  <p className="drand-muted">No round data yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Latency timeline chart */}
      <DrandLatencyChart history={drand.latencyHistory} period={drand.chain?.period ?? 3} />

      {/* Info callout */}
      <section className="drand-info-section">
        <div className="drand-info-card">
          <h3>How Drand integrates with this project</h3>
          <p>
            The Round contract uses Drand quicknet's BLS threshold signature as its
            cryptographic gate. Bidders seal their entries with timelock encryption
            (tlock) to a specific future round <strong>R</strong>. The sealed data is
            undecryptable until quicknet publishes round <strong>R</strong>'s BLS
            signature — at which point anyone can submit it to open_reveal, which
            verifies the signature on-chain via Soroban host functions.
          </p>
          <p>
            This means the operator never holds a key that can read sealed bids. Every
            entry stays encrypted until the public beacon forces simultaneous disclosure.
          </p>
        </div>
      </section>
    </main>
  );
}
