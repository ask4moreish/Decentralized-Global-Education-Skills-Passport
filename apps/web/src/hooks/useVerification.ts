import { useEffect, useMemo, useState } from "react";
import {
  serializeReceipt,
  verifyReceipt,
  type RoundReceipt,
  type VerificationResult,
} from "skills-passport-sdk";
import { sha256Hex } from "../verify/hashFingerprint";

export interface UseVerificationResult {
  /** null while no receipt is loaded or verification threw. */
  result: VerificationResult | null;
  /** Canonical sha256 of the receipt JSON; computed asynchronously. */
  fingerprint: string | null;
  /** Round id echoed for the verdict banner. */
  roundId: string | null;
}

export function useVerification(receipt: RoundReceipt | null): UseVerificationResult {
  // verifyReceipt is pure and synchronous — it runs on every receipt change.
  const result = useMemo<VerificationResult | null>(() => {
    if (!receipt) return null;
    try {
      return verifyReceipt(receipt);
    } catch {
      return null;
    }
  }, [receipt]);

  // sha256 of the canonical JSON is cryptographically cheap but the digest
  // API is async, so we hydrate the fingerprint via an effect.
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    if (!receipt) {
      setFingerprint(null);
      return;
    }
    let cancelled = false;
    void sha256Hex(serializeReceipt(receipt))
      .then((hex) => {
        if (!cancelled) setFingerprint(hex);
      })
      .catch(() => {
        if (!cancelled) setFingerprint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [receipt]);

  if (!receipt || !result) {
    return { result: null, fingerprint: null, roundId: null };
  }
  return { result, fingerprint, roundId: receipt.roundId };
}
