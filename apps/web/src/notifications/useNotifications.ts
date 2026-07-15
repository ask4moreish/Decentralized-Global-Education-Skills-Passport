import { useEffect } from "react";
import { STORAGE_KEY_PREFIX } from "../lib/settings";
import { useNotificationContext } from "./NotificationContext";
import type { NotificationItem, NotificationType } from "./types";

const STORAGE_KEY = `${STORAGE_KEY_PREFIX}notifications`;

function loadFromStorage(): { items: NotificationItem[]; nextId: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.items) && typeof parsed?.nextId === "number") {
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveToStorage(items: NotificationItem[], nextId: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, nextId }));
  } catch {
    // localStorage may be full or disabled
  }
}

/**
 * Hook that wraps NotificationContext with localStorage persistence.
 * Automatically hydrates from storage on mount and persists on every change.
 */
export function useNotifications() {
  const ctx = useNotificationContext();

  // Hydrate from localStorage on first mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      ctx.hydrate(stored.items, stored.nextId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(ctx.items, ctx.items.length > 0 ? ctx.items.length + 1 : 1);
  }, [ctx.items]);

  return ctx;
}
