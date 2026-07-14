import { useEffect, useState } from "react";
import type { Round, BidState } from "@decentralized-global-education-skills-passport/sdk";
import { useLocalStorage } from "./useLocalStorage";

const RPC = import.meta.env.VITE_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK =
  import.meta.env.VITE_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const CONTRACT = import.meta.env.VITE_CONTRACT_ID as string | undefined;
const ROUND_ID = import.meta.env.VITE_ROUND_ID
  ? BigInt(import.meta.env.VITE_ROUND_ID)
  : undefined;

export interface LiveSnapshot {
  round: Round;
  bidders: string[];
  bidStates: Record<string, BidState>;
  polledAt: number;
}

/** Default refresh interval in seconds when no preference is stored. */
const DEFAULT_REFRESH_INTERVAL_SEC = 30;

export function useLiveRound(enabled: boolean, pollMs?: number) {
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshIntervalSec] = useLocalStorage(
    "refresh-interval",
    DEFAULT_REFRESH_INTERVAL_SEC,
  );

  // Resolve pollMs: explicit parameter wins, otherwise use the setting
  const effectivePollMs =
    pollMs ?? (refreshIntervalSec > 0 ? refreshIntervalSec * 1000 : 0);

  useEffect(() => {
    if (!enabled || !CONTRACT || ROUND_ID === undefined) return;

    let cancelled = false;

    async function poll() {
      try {
        const { SkillsPassportClient } = await import("@decentralized-global-education-skills-passport/sdk");
        const reader = new SkillsPassportClient({
          rpcUrl: RPC,
          networkPassphrase: NETWORK,
          contractId: CONTRACT!,
          publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        });
        const round = await reader.getRound(ROUND_ID!);
        const bidders = await reader.getBidders(ROUND_ID!);
        const bidStates: Record<string, BidState> = {};
        for (const b of bidders) {
          bidStates[b] = await reader.getBidState(ROUND_ID!, b);
        }
        if (!cancelled) {
          setLive({ round, bidders, bidStates, polledAt: Date.now() });
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    void poll();

    // Poll at the user-selected interval (0 = off)
    let id: ReturnType<typeof setInterval> | undefined;
    if (effectivePollMs > 0) {
      id = setInterval(poll, effectivePollMs);
    }

    return () => {
      cancelled = true;
      if (id !== undefined) clearInterval(id);
    };
  }, [enabled, effectivePollMs]);

  return { live, error, configured: Boolean(CONTRACT && ROUND_ID !== undefined) };
}
