import { useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

type NetworkState = "checking" | "connected" | "disconnected" | "slow";

interface NetworkStatusProps {
  /** Optional RPC URL to check connectivity against. */
  rpcUrl?: string;
  /** Optional className override. */
  className?: string;
}

const CHECK_INTERVAL_MS = 30_000;
const SLOW_THRESHOLD_MS = 2000;

/**
 * A small network status indicator that periodically checks connectivity
 * by fetching the RPC endpoint (or a simple connectivity check).
 */
export function NetworkStatus({ rpcUrl, className = "" }: NetworkStatusProps) {
  const [state, setState] = useState<NetworkState>("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useLocalStorage("network-status-visible", false);

  const check = useCallback(async () => {
    setState("checking");
    const url = rpcUrl || "https://soroban-testnet.stellar.org";
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getHealth",
          params: [],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const elapsed = performance.now() - start;
      setLatencyMs(Math.round(elapsed));

      if (res.ok) {
        setState(elapsed > SLOW_THRESHOLD_MS ? "slow" : "connected");
      } else {
        setState("disconnected");
      }
    } catch {
      setState("disconnected");
      setLatencyMs(null);
    }
  }, [rpcUrl]);

  useEffect(() => {
    if (!showDetails) return;
    void check();
    const interval = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [showDetails, check]);

  if (!showDetails) return null;

  const icon = state === "connected" ? "●" : state === "checking" ? "○" : "○";
  const label =
    state === "connected"
      ? `Network ${latencyMs != null ? `${latencyMs}ms` : "ok"}`
      : state === "checking"
        ? "Checking..."
        : state === "slow"
          ? `Slow (${latencyMs}ms)`
          : "Disconnected";

  const tone =
    state === "connected"
      ? "connected"
      : state === "slow"
        ? "slow"
        : state === "checking"
          ? "checking"
          : "disconnected";

  return (
    <div className={`network-status ${tone} ${className}`} title={`RPC: ${rpcUrl ?? "default"}`}>
      <span className={`network-status-dot ${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="network-status-label">{label}</span>
      <button
        type="button"
        className="network-status-close"
        onClick={() => setShowDetails(false)}
        aria-label="Dismiss network status"
      >
        &times;
      </button>
    </div>
  );
}
