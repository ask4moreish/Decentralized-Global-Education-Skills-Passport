import { motion } from "framer-motion";
import type { UseCase } from "../config/useCases";

export interface OutcomePeer {
  /** display label (e.g. "Member alpha" or shortened on-chain address) */
  name: string;
  value: number;
}

function ballotBucket(value: number): "yes" | "no" | "abstain" {
  if (value >= 75) return "yes";
  if (value <= 25) return "no";
  return "abstain";
}

function formatPct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function TallyOutcome({
  useCase,
  peers,
  userValue,
}: {
  useCase: UseCase;
  peers: OutcomePeer[];
  userValue: number;
}) {
  void useCase;
  const all = [...peers.map((p) => p.value), userValue];
  const counts = { yes: 0, no: 0, abstain: 0 };
  for (const v of all) counts[ballotBucket(v)] += 1;
  const total = all.length;
  const winner = (Object.entries(counts) as Array<["yes" | "no" | "abstain", number]>)
    .sort((a, b) => b[1] - a[1])[0];
  const winnerLabel = winner[0] === "yes" ? "Yes" : winner[0] === "no" ? "No" : "Abstain";

  const rows: Array<{
    key: "yes" | "abstain" | "no";
    label: string;
    tone: "for" | "neutral" | "against";
  }> = [
    { key: "yes", label: "Yes", tone: "for" },
    { key: "abstain", label: "Abstain", tone: "neutral" },
    { key: "no", label: "No", tone: "against" },
  ];

  return (
    <div className="outcome-tally">
      <div className="outcome-headline">
        <span>
          Proposal {winner[0] === "yes" ? "passes" : winner[0] === "no" ? "fails" : "deadlocks"}
        </span>
        <strong>
          {winnerLabel} · {winner[1]} / {total}
        </strong>
      </div>
      <ul className="tally-bars">
        {rows.map((row, i) => {
          const value = counts[row.key];
          const pct = total === 0 ? 0 : (value / total) * 100;
          return (
            <li key={row.key} className={`tally-row ${row.tone}`}>
              <div className="tally-label">
                <span>{row.label}</span>
                <b>
                  {value} · {formatPct(value, total)}
                </b>
              </div>
              <div className="tally-track">
                <motion.div
                  className="tally-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, delay: 0.1 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="outcome-foot">
        Drand R verifies all {total} ballots opened from the same sealed set — no one could see
        the running tally before reveal.
      </p>
    </div>
  );
}

function LeaderboardOutcome({
  useCase,
  peers,
  userValue,
}: {
  useCase: UseCase;
  peers: OutcomePeer[];
  userValue: number;
}) {
  type Row = { name: string; value: number; isYou: boolean };
  const rows: Row[] = [
    ...peers.map((p) => ({ name: p.name, value: p.value, isYou: false })),
    { name: "You", value: userValue, isYou: true },
  ].sort((a, b) => b.value - a.value);
  const avg = rows.reduce((acc, r) => acc + r.value, 0) / rows.length;

  return (
    <div className="outcome-leaderboard">
      <div className="outcome-headline">
        <span>Sealed panel result</span>
        <strong>
          Average{" "}
          {avg.toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}{" "}
          / 10
        </strong>
      </div>
      <ol className="leaderboard" aria-label="Revealed judge scores">
        {rows.map((row, i) => (
          <motion.li
            key={`${row.name}-${i}`}
            className={`leaderboard-row ${row.isYou ? "you" : ""} ${i === 0 ? "top" : ""}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.32 }}
          >
            <span className="rank">#{i + 1}</span>
            <strong>{row.name}</strong>
            <b>{useCase.formatValue(row.value)}</b>
          </motion.li>
        ))}
      </ol>
      <p className="outcome-foot">
        All {rows.length} sealed scores opened in the same reveal — no judge could anchor the next.
      </p>
    </div>
  );
}

function HighestOutcome({
  useCase,
  peers,
  userValue,
}: {
  useCase: UseCase;
  peers: OutcomePeer[];
  userValue: number;
}) {
  type Row = { name: string; value: number; isYou: boolean };
  const rows: Row[] = [
    ...peers.map((p) => ({ name: p.name, value: p.value, isYou: false })),
    { name: "You", value: userValue, isYou: true },
  ].sort((a, b) => b.value - a.value);
  const winner = rows[0];
  const max = winner.value;

  return (
    <div className="outcome-highest">
      <div className="outcome-headline">
        <span>{winner.isYou ? "You won the bid" : `Winner · ${winner.name}`}</span>
        <strong>{useCase.formatValue(winner.value)}</strong>
      </div>
      <ul className="bid-list">
        {rows.map((row, i) => {
          const pct = max === 0 ? 0 : (row.value / max) * 100;
          return (
            <li
              key={`${row.name}-${i}`}
              className={`bid-row ${row.isYou ? "you" : ""} ${i === 0 ? "top" : ""}`}
            >
              <div className="bid-label">
                <strong>{row.name}</strong>
                <b>{useCase.formatValue(row.value)}</b>
              </div>
              <div className="bid-track">
                <motion.div
                  className="bid-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="outcome-foot">
        Highest sealed bid clears. No one saw the leading number before Drand R published the
        signature.
      </p>
    </div>
  );
}

function DistributionOutcome({
  useCase,
  peers,
  userValue,
}: {
  useCase: UseCase;
  peers: OutcomePeer[];
  userValue: number;
}) {
  type Row = { name: string; value: number; isYou: boolean };
  const rows: Row[] = [
    ...peers.map((p) => ({ name: p.name, value: p.value, isYou: false })),
    { name: "You", value: userValue, isYou: true },
  ];
  const total = rows.reduce((acc, r) => acc + r.value, 0);

  return (
    <div className="outcome-distribution">
      <div className="outcome-headline">
        <span>Total demand</span>
        <strong>{useCase.formatValue(total)}</strong>
      </div>
      <div className="distribution-stack" role="img" aria-label="Allocation share by participant">
        {rows.map((row, i) => {
          const pct = total === 0 ? 0 : (row.value / total) * 100;
          return (
            <motion.div
              key={`${row.name}-${i}`}
              className={`distribution-segment ${row.isYou ? "you" : ""}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              title={`${row.name}: ${useCase.formatValue(row.value)} (${pct.toFixed(1)}%)`}
            >
              {pct >= 12 ? <span>{row.name.split(" ").slice(-1)[0]}</span> : null}
            </motion.div>
          );
        })}
      </div>
      <ul className="distribution-list">
        {rows.map((row, i) => {
          const pct = total === 0 ? 0 : (row.value / total) * 100;
          return (
            <li key={`${row.name}-${i}`} className={row.isYou ? "you" : ""}>
              <span>{row.name}</span>
              <b>{useCase.formatValue(row.value)}</b>
              <small>{pct.toFixed(1)}%</small>
            </li>
          );
        })}
      </ul>
      <p className="outcome-foot">
        Pro-rata clearing on the full sealed set — demand stayed hidden until R, so no one could
        front-run the allocation.
      </p>
    </div>
  );
}

export function OutcomePanel({
  useCase,
  userValue,
  peers,
  isReal,
}: {
  useCase: UseCase;
  /** user's revealed numeric value */
  userValue: number;
  /** participants other than the user (real on-chain or simulated cohort) */
  peers: OutcomePeer[];
  /** whether `peers` were sourced from real on-chain bidders */
  isReal: boolean;
}) {
  return (
    <motion.section
      className="outcome-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <header>
        <span className="outcome-badge">
          {isReal ? "On-chain reveal" : "Round revealed"}
        </span>
        <h2>{useCase.tagline} · final result</h2>
      </header>
      {useCase.outcomeKind === "tally" ? (
        <TallyOutcome useCase={useCase} peers={peers} userValue={userValue} />
      ) : useCase.outcomeKind === "leaderboard" ? (
        <LeaderboardOutcome useCase={useCase} peers={peers} userValue={userValue} />
      ) : useCase.outcomeKind === "highest" ? (
        <HighestOutcome useCase={useCase} peers={peers} userValue={userValue} />
      ) : (
        <DistributionOutcome useCase={useCase} peers={peers} userValue={userValue} />
      )}
    </motion.section>
  );
}
