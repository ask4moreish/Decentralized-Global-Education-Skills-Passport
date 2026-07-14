import { useCallback, useRef, useState } from "react";

export interface UseClipboardResult {
  /** Whether the last copy was successful. */
  copied: boolean;
  /** Copy a string to the clipboard. Returns true on success. */
  copy: (text: string) => Promise<boolean>;
  /** The error message if the last copy failed. */
  error: string | null;
  /** Whether a copy is currently in progress. */
  copying: boolean;
  /** Reset the copied/error state. */
  reset: () => void;
}

/**
 * Hook for copying text to the clipboard with visual feedback state.
 *
 * Usage:
 *   const { copied, copy, error } = useClipboard();
 *   <button onClick={() => copy("text to copy")}>
 *     {copied ? "Copied!" : "Copy"}
 *   </button>
 */
export function useClipboard(resetAfterMs = 2000): UseClipboardResult {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setCopied(false);
    setError(null);
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      // Clear any pending reset timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setCopying(true);
      setError(null);

      try {
        // Try the modern clipboard API first
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for older browsers or non-secure contexts
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }

        setCopied(true);
        setCopying(false);

        // Auto-reset after the specified delay
        timeoutRef.current = window.setTimeout(() => {
          setCopied(false);
          timeoutRef.current = null;
        }, resetAfterMs);

        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to copy";
        setError(message);
        setCopied(false);
        setCopying(false);
        return false;
      }
    },
    [resetAfterMs],
  );

  return { copied, copy, error, copying, reset };
}
