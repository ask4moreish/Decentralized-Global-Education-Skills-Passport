import { AgentActivity, KeeperPanel, X402Logs } from "./AgentPanels";
import { AttackDemo } from "./AttackDemo";
import { AuditorView } from "./AuditorView";
import { LifecycleView } from "./LifecycleView";
import { MainnetProofCard } from "./MainnetProofCard";
import { MandateCapLab } from "./MandateCapLab";
import { ObserverView } from "./ObserverView";
import { SettlementRail } from "./SettlementRail";
import type { DemoTrace } from "../demo/trace";
import { DEMO_TRACE } from "../demo/trace";

/**
 * Recorded evidence panel — shows when the demo page is in "evidence" mode.
 * Extracted into its own file so DemoPage can import it lazily, keeping the
 * initial live-round payload smaller.
 */
export function EvidencePanel() {
  return (
    <div className="evidence-stack">
      <p className="evidence-intro">
        Recorded testnet proof from <code>pnpm agents:e2e</code>. Scroll for lifecycle, attack
        demo, agents, and auditor tools.
      </p>
      <MainnetProofCard />
      <LifecycleView trace={DEMO_TRACE} />
      <AttackDemo />
      <SettlementRail trace={DEMO_TRACE} />
      <AgentActivity trace={DEMO_TRACE} />
      <X402Logs trace={DEMO_TRACE} />
      <KeeperPanel trace={DEMO_TRACE} />
      <ObserverView trace={DEMO_TRACE} live={null} />
      <AuditorView trace={DEMO_TRACE} />
      <MandateCapLab />
    </div>
  );
}
