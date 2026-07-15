import { useCallback, useMemo, useState } from "react";
import { parseReceipt, type RoundReceipt } from "skills-passport-sdk";

export interface UseReceiptInputResult {
  /** Raw textarea contents — what the user typed, dropped, or pasted. */
  rawJson: string;
  /** Parsed receipt, or null if the input is empty/invalid. */
  receipt: RoundReceipt | null;
  /** Last parse error, or null when the receipt parses cleanly. */
  parseError: string | null;
  /** Update the textarea contents (re-parses automatically). */
  setRawJson: (next: string) => void;
  /** Wipe input + parse state. */
  clear: () => void;
  /** Imperatively set the textarea (e.g. from a sample button). */
  load: (next: string) => void;
}

export function useReceiptInput(initialJson: string = ""): UseReceiptInputResult {
  const [rawJson, setRawJsonState] = useState<string>(initialJson);

  // Parse is fully synchronous — keeps the input → verdict flow linear and
  // avoids a useEffect-stale-state race with the UI.
  const { receipt, parseError } = useMemo(() => {
    if (!rawJson.trim()) {
      return { receipt: null, parseError: null };
    }
    try {
      return { receipt: parseReceipt(rawJson), parseError: null };
    } catch (e) {
      return { receipt: null, parseError: humaniseParseError(e) };
    }
  }, [rawJson]);

  const setRawJson = useCallback((next: string) => setRawJsonState(next), []);
  const clear = useCallback(() => setRawJsonState(""), []);
  const load = useCallback((next: string) => setRawJsonState(next), []);

  return { rawJson, receipt, parseError, setRawJson, clear, load };
}

function humaniseParseError(e: unknown): string {
  if (e instanceof Error) {
    // V8's SyntaxError appends "(line N column M)" — strip it so the toast
    // stays read-friendly.
    return e.message.replace(/\s*\(\d+:\d+\)\s*$/, "").trim();
  }
  return "Could not parse receipt JSON.";
}
