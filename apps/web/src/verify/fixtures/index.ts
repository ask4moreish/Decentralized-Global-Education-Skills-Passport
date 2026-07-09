// Sample fixture gallery used by the verifier's "SampleControls" toolbar.
//
// These are byte-for-byte copies of services/receipt-cli/src/fixtures/*.json
// — kept here so the web bundle has no dependency on CLI source paths. The
// `expected` field documents what the verifier should report and is used to
// drive the bullet colour next to each button.

import goldenJson from "./golden.json";
import tamperedCommitmentJson from "./tampered-commitment.json";
import tamperedNetworkJson from "./tampered-network.json";
import tamperedWinnerJson from "./tampered-winner.json";
import tamperedOrderJson from "./tampered-order.json";
import tamperedValuesJson from "./tampered-values.json";
import tamperedEvidenceJson from "./tampered-evidence.json";

export type ExpectedSeverity = "pass" | "fail";

export interface VerifierFixture {
  /** Stable id used as React key. */
  id: string;
  /** Display label for the gallery button. */
  label: string;
  /** Short description shown beneath the label. */
  hint: string;
  /** Whether verification should pass for this fixture. */
  expected: ExpectedSeverity;
  /** Issue code(s) the verifier is expected to flag, comma-separated. */
  expectedCodes: string;
  /** Raw JSON, as a string identical to what the user would paste. */
  raw: string;
}

function load(id: string, label: string, hint: string, expected: ExpectedSeverity, codes: string, body: unknown): VerifierFixture {
  return {
    id,
    label,
    hint,
    expected,
    expectedCodes: codes,
    raw: `${JSON.stringify(body, null, 2)}\n`,
  };
}

export const VERIFIER_FIXTURES: VerifierFixture[] = [
  load("golden", "Golden", "Baseline receipt; verifyReceipt should report PASS", "pass", "—", goldenJson),
  load(
    "tampered-commitment",
    "Tampered commitment",
    "GA's commitment hash was overwritten. Should fail with `commitment_mismatch`.",
    "fail",
    "commitment_mismatch",
    tamperedCommitmentJson,
  ),
  load(
    "tampered-network",
    "Tampered network",
    "Network passphrase changed but the fingerprint wasn't. Should fail with `network_mismatch`.",
    "fail",
    "network_mismatch",
    tamperedNetworkJson,
  ),
  load(
    "tampered-winner",
    "Tampered winner",
    "Declared winner changed without revealing a higher bid. Should fail with `winner_mismatch`.",
    "fail",
    "winner_mismatch",
    tamperedWinnerJson,
  ),
  load(
    "tampered-order",
    "Tampered bidder order",
    "Bidder array reordered without bumping roundId. Should still PASS — proves order isn't bound.",
    "pass",
    "—",
    tamperedOrderJson,
  ),
  load(
    "tampered-values",
    "Tampered revealed values",
    "GA's revealed value bumped. Should fail because the recomputed commitment no longer matches.",
    "fail",
    "commitment_mismatch",
    tamperedValuesJson,
  ),
  load(
    "tampered-evidence",
    "Tampered evidence",
    "GA's ciphertext is not valid hex. Should fail with `invalid_evidence_hex`.",
    "fail",
    "invalid_evidence_hex",
    tamperedEvidenceJson,
  ),
];

export function findFixture(id: string): VerifierFixture | undefined {
  return VERIFIER_FIXTURES.find((f) => f.id === id);
}
