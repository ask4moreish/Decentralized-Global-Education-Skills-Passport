import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEY_PREFIX } from "../lib/settings";

// Legacy key name for the old binary auto-refresh setting (replaced by refresh-interval)
const OLD_AUTO_REFRESH_KEY = `${STORAGE_KEY_PREFIX}auto-refresh`;

/**
 * One-time migration from the old binary `auto-refresh` key to the new
 * `refresh-interval` numeric key. Reads and removes the old key, returning
 * a numeric interval (0 for off, `defaultSeconds` for on) or null if no
 * old key exists.
 */
export function migrateAutoRefresh(defaultSeconds: number = 30): number | null {
  const old = localStorage.getItem(OLD_AUTO_REFRESH_KEY);
  if (old !== null) {
    localStorage.removeItem(OLD_AUTO_REFRESH_KEY);
    return JSON.parse(old) === false ? 0 : defaultSeconds;
  }
  return null;
}

/**
 * Generic hook for persisting values to localStorage with JSON serialization.
 * Updates are synced across tabs via the 'storage' event.
 *
 * Usage:
 *   const [autoRefresh, setAutoRefresh] = useLocalStorage("auto-refresh", true);
 *
 * @param migrate Optional callback that runs once when no stored value exists.
 *   Return a value to migrate an old key, or null to use the default.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  migrate?: () => T | null,
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

    // If no stored value exists, run the one-time migration callback
    if (migrate) {
      try {
        const migrated = migrate();
        if (migrated !== null) {
          return migrated;
        }
      } catch {
        // Migration failed — fall through to default
      }
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
