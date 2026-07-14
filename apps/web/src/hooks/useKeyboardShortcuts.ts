import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface Shortcut {
  /** Unique id for the shortcut (used for dedup). */
  id: string;
  /** Human-readable label for the help modal. */
  label: string;
  /** Keys to display in the help modal (e.g. "G then D"). */
  keys: string;
  /** The raw key combination(s) to match. Supports: "ctrl+k", "g d", "escape", etc. */
  combo: string;
  /** Handler callback. */
  handler: () => void;
  /** Where this shortcut is active. Default: "global". */
  scope?: "global" | "demo" | "verify" | "drand" | "dashboard";
  /** Whether to prevent default browser behavior. Default: true. */
  preventDefault?: boolean;
}

interface ShortcutStore {
  shortcuts: Shortcut[];
  register: (shortcut: Shortcut) => () => void;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const GLOBAL_SCOPE = "global";

/**
 * Client-side keyboard shortcut manager.
 *
 * Usage:
 *   const shortcuts = useKeyboardShortcuts();
 *   useEffect(() => {
 *     const unsub = shortcuts.register({ id: "my-shortcut", label: "Do something", keys: "⌘K", combo: "ctrl+k", handler: () => {} });
 *     return unsub;
 *   }, []);
 */
export function useKeyboardShortcuts(): ShortcutStore {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const bufferRef = useRef<string[]>([]);
  const bufferTimeoutRef = useRef<number | null>(null);

  const register = useCallback((shortcut: Shortcut): (() => void) => {
    setShortcuts((prev) => {
      // Dedup by id — replace if exists
      const existing = prev.findIndex((s) => s.id === shortcut.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = shortcut;
        return updated;
      }
      return [...prev, shortcut];
    });

    return () => {
      setShortcuts((prev) => prev.filter((s) => s.id !== shortcut.id));
    };
  }, []);

  const matchCombo = useCallback((combo: string, event: KeyboardEvent, buffer: string[]): boolean => {
    // Simple single-key combos: "escape", "enter", "tab", "delete", "a"..."z", "0"..."9"
    const simple = combo.toLowerCase().trim();
    const key = event.key.toLowerCase();

    // Check modifier combos: "ctrl+k", "cmd+k", "shift+a", etc.
    const parts = simple.split("+").map((p) => p.trim());
    if (parts.length > 1) {
      const hasCtrl = parts.includes("ctrl");
      const hasCmd = parts.includes("cmd") || parts.includes("meta");
      const hasShift = parts.includes("shift");
      const hasAlt = parts.includes("alt");
      const mainKey = parts[parts.length - 1];

      const modMatch =
        (hasCtrl ? event.ctrlKey : !event.ctrlKey && !event.metaKey) &&
        (hasCmd ? event.metaKey : true) &&
        (hasShift ? event.shiftKey : !event.shiftKey) &&
        (hasAlt ? event.altKey : !event.altKey);

      if (modMatch && key === mainKey) return true;
    }

    // Sequence combos: "g d", "g g" — stored in buffer
    if (!simple.includes("+") && simple.includes(" ")) {
      const sequence = simple.split(" ").map((p) => p.trim());
      if (buffer.length === sequence.length) {
        return sequence.every((s, i) => buffer[i] === s);
      }
    }

    // Simple single key
    if (!simple.includes("+") && !simple.includes(" ")) {
      return key === simple;
    }

    return false;
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // If modal is open, only handle escape to close it
      if (isModalOpen) {
        if (event.key === "Escape") {
          setIsModalOpen(false);
          event.preventDefault();
        }
        return;
      }

      const key = event.key.toLowerCase();
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement as HTMLElement)?.isContentEditable;

      // Skip single-character shortcuts when focus is in an input field
      // (still allow ctrl/cmd combos in inputs)
      if (isInput && key.length === 1 && !event.ctrlKey && !event.metaKey) {
        return;
      }

      // Manage sequence buffer
      const isLetter = key.length === 1 && key >= "a" && key <= "z";
      if (isLetter && !event.ctrlKey && !event.metaKey && !event.altKey) {
        bufferRef.current.push(key);
        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
        }
        bufferTimeoutRef.current = window.setTimeout(() => {
          bufferRef.current = [];
        }, 800);
      } else {
        bufferRef.current = [];
        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
          bufferTimeoutRef.current = null;
        }
      }

      // Try to match a shortcut
      for (const shortcut of [...shortcuts].sort((a, b) => {
        // More specific (longer combo) first
        return b.combo.length - a.combo.length;
      })) {
        if (matchCombo(shortcut.combo, event, bufferRef.current)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
            event.stopPropagation();
          }
          shortcut.handler();
          bufferRef.current = [];
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts, isModalOpen, matchCombo]);

  // Clear buffer on blur
  useEffect(() => {
    const onBlur = () => {
      bufferRef.current = [];
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
        bufferTimeoutRef.current = null;
      }
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  return useMemo(
    () => ({
      shortcuts,
      register,
      isModalOpen,
      openModal: () => setIsModalOpen(true),
      closeModal: () => setIsModalOpen(false),
    }),
    [shortcuts, register, isModalOpen],
  );
}
