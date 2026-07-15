import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "../dashboard/types";
import { DASHBOARD_FIXTURE } from "../dashboard/fixture";
import { assertDashboardData } from "../dashboard/fixture-health-check";
import { DEFAULT_REFRESH_INTERVAL_SEC } from "../lib/settings";
import { useLocalStorage } from "./useLocalStorage";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface UseDashboardDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  refetch: () => void;
}

function isStale(fetchedAt: string): boolean {
  const fetchedTime = new Date(fetchedAt).getTime();
  return Date.now() - fetchedTime > STALE_THRESHOLD_MS;
}

export function useDashboardData(): UseDashboardDataResult {
  const endpoint = import.meta.env.VITE_DASHBOARD_ENDPOINT as string | undefined;
  const useFixture = !endpoint?.trim();
  const [refreshIntervalSec] = useLocalStorage<number>(
    "refresh-interval",
    DEFAULT_REFRESH_INTERVAL_SEC,
  );

  const [state, setState] = useState<UseDashboardDataResult>(() => ({
    data: null,
    loading: true,
    error: null,
    stale: false,
    refetch: () => {},
  }));

  const fetchData = useCallback(async () => {
    if (useFixture) {
      setState((s) => ({
        ...s,
        data: DASHBOARD_FIXTURE,
        loading: false,
        error: null,
        stale: isStale(DASHBOARD_FIXTURE.meta.fetchedAt),
      }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const response = await fetch(endpoint!);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json: unknown = await response.json();
      assertDashboardData(json);

      setState((s) => ({
        ...s,
        data: json,
        loading: false,
        error: null,
        stale: isStale(json.meta.fetchedAt),
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState((s) => ({
        ...s,
        loading: false,
        error: `Failed to fetch dashboard data: ${message}`,
      }));
    }
  }, [endpoint, useFixture]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await fetchData();
    };

    void tick();

    // Poll at the user-selected interval (0 = off)
    const pollMs = refreshIntervalSec > 0 ? refreshIntervalSec * 1000 : 0;
    let intervalId: number | undefined;
    if (!useFixture && pollMs > 0) {
      intervalId = window.setInterval(() => void tick(), pollMs);
    }

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [fetchData, useFixture, refreshIntervalSec]);

  // Update stale status periodically
  useEffect(() => {
    if (!state.data) return;

    const checkStale = () => {
      setState((s) => {
        if (!s.data) return s;
        const nowStale = isStale(s.data.meta.fetchedAt);
        return nowStale !== s.stale ? { ...s, stale: nowStale } : s;
      });
    };

    const id = window.setInterval(checkStale, 60_000); // Check every minute
    return () => window.clearInterval(id);
  }, [state.data]);

  return {
    ...state,
    refetch: fetchData,
  };
}
