import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEY_PREFIX } from "../lib/settings";

/**
 * Generic hook for persisting values to localStorage with JSON serialization.
 * Updates are synced across tabs via the 'storage' event.
 *
 * Usage:
 *   const [autoRefresh, setAutoRefresh] = useLocalStorage("auto-refresh", true);
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = useMemo(
    () => `${STORAGE_KEY_PREFIX}${key}`,
    [key],
  );

  const [value, setValueState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Ignore JSON parse errors — fall through to default
    }

    return defaultValue;
  });

  // Persist to localStorage whenever value changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // localStorage might be full or disabled
    }
  }, [storageKey, value]);

  // Listen for changes from other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue !== null) {
        try {
          setValueState(JSON.parse(e.newValue) as T);
        } catch {
          // Ignore
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => (typeof next === "function" ? (next as (p: T) => T)(prev) : next));
    },
    [],
  );

  return [value, setValue];
}
