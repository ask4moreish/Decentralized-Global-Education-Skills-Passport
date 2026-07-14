import { useEffect, useState } from "react";
import { quicknet, fetchRoundBeacon } from "@decentralized-global-education-skills-passport/tlock";
import { useLocalStorage } from "./useLocalStorage";

export interface DrandChainInfo {
  publicKey: string;
  period: number;
  genesisTime: number;
  hash: string;
  schemeID: string;
}

export interface DrandBeaconData {
  round: number;
  randomness: string;
  signature: string;
}

export interface RoundLatencyEntry {
  round: number;
  /** Expected publish unix timestamp (genesis + period * round). */
  expectedAt: number;
  /** Wall-clock time (ms) when we observed the round published. */
  observedAt: number;
  /** Latency in seconds (observedAt/1000 - expectedAt). */
  latencyMs: number;
}

export interface DrandBeaconState {
  loading: boolean;
  error: string | null;
  /** Cached chain info (fetched once). */
  chain: DrandChainInfo | null;
  /** Latest published beacon (fetched on each poll). */
  latest: DrandBeaconData | null;
  /** Current live round number derived from chain info. */
  currentRound: number | null;
  /** Next round number = current + 1. */
  nextRound: number | null;
  /** Unix seconds until the next round is expected. */
  secondsUntilNext: number;
  /** The precise unix timestamp when the next round publishes. */
  nextRoundTime: number | null;
  /** Rolling log of observed round latencies (most recent first, max 30). */
  latencyHistory: RoundLatencyEntry[];
}

const MAX_LATENCY_ENTRIES = 30;

export function useDrandBeacon(): DrandBeaconState {
  const [state, setState] = useState<DrandBeaconState>({
    loading: true,
    error: null,
    chain: null,
    latest: null,
    currentRound: null,
    nextRound: null,
    secondsUntilNext: 0,
    nextRoundTime: null,
    latencyHistory: [],
  });

  const [refreshIntervalSec] = useLocalStorage("refresh-interval", 30);

  // Resolve poll interval: use stored value; 0 = off
  const pollMs = refreshIntervalSec > 0 ? refreshIntervalSec * 1000 : 0;

  useEffect(() => {
    let cancelled = false;
    const client = quicknet();

    async function tick() {
      try {
        const info = await client.chain().info();
        const genesis = info.genesis_time;
        const period = info.period;
        const now = Math.floor(Date.now() / 1000);

        const info_: DrandChainInfo = {
          publicKey: info.public_key,
          period: info.period,
          genesisTime: info.genesis_time,
          hash: info.hash,
          schemeID: info.schemeID,
        };

        // Current round = how many periods have elapsed since genesis
        const current = Math.max(1, Math.floor((now - genesis) / period) + 1);
        const nextRoundTime = genesis + period * (current + 1);
        const secondsUntil = Math.max(0, nextRoundTime - now);
        const nextRound = current + 1;

        // Fetch the latest published beacon using the drand-client library
        // (consistent with the rest of the codebase). We fetch "latest"
        // directly since fetchBeacon may not expose a "latest" convenience.
        let latest: DrandBeaconData | null = null;
        try {
          const beacon = await fetch(
            `https://api.drand.sh/${info.hash}/public/latest`,
          );
          if (beacon.ok) {
            const json = (await beacon.json()) as {
              round: number;
              randomness: string;
              signature: string;
            };
            latest = {
              round: json.round,
              randomness: json.randomness,
              signature: json.signature,
            };
          }
        } catch {
          // Non-critical — latest is best-effort
        }

        if (!cancelled) {
          setState((prev) => {
            // If we got a new beacon and it's different from the previous one,
            // record its observed timestamp for latency tracking.
            let latencyHistory = prev.latencyHistory;
            if (latest && latest.round !== prev.latest?.round) {
              const expectedAt = genesis + period * latest.round;
              const observedAt = Date.now();
              const entry: RoundLatencyEntry = {
                round: latest.round,
                expectedAt,
                observedAt,
                latencyMs: Math.round(observedAt - expectedAt * 1000),
              };
              latencyHistory = [entry, ...prev.latencyHistory].slice(
                0,
                MAX_LATENCY_ENTRIES,
              );
            }
            return {
              loading: false,
              error: null,
              chain: info_,
              latest,
              currentRound: current,
              nextRound,
              secondsUntilNext: secondsUntil,
              nextRoundTime,
              latencyHistory,
            };
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          }));
        }
      }
    }

    void tick();

    // Poll at the user-selected interval (0 = off)
    let id: number | undefined;
    if (pollMs > 0) {
      id = window.setInterval(() => void tick(), pollMs);
    }

    return () => {
      cancelled = true;
      if (id !== undefined) {
        window.clearInterval(id);
      }
    };
  }, [pollMs]);

  return state;
}

/** Fetch a specific Drand beacon by round number using the drand-client. */
export async function fetchDrandBeaconByRound(
  round: number,
): Promise<DrandBeaconData | null> {
  try {
    const client = quicknet();
    const beacon = await fetchRoundBeacon(client, round);
    return {
      round: beacon.round,
      randomness: beacon.randomness,
      signature: beacon.signature,
    };
  } catch {
    return null;
  }
}

export function formatDrandCountdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
