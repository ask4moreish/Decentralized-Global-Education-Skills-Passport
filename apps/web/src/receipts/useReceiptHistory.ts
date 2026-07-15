import { useEffect } from "react";
import { STORAGE_KEY_PREFIX } from "../lib/settings";
import { useReceiptStore } from "./ReceiptStore";
import type { SavedReceipt } from "./types";

const STORAGE_KEY = `${STORAGE_KEY_PREFIX}receipts`;

function loadFromStorage(): SavedReceipt[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveToStorage(receipts: SavedReceipt[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    // localStorage may be full or disabled
  }
}

export function useReceiptHistory() {
  const store = useReceiptStore();

  // Hydrate from localStorage on first mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored && stored.length > 0) {
      store.hydrate(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(store.receipts);
  }, [store.receipts]);

  return store;
}
