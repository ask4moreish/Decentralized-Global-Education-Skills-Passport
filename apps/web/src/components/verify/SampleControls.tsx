import { useToast } from "../../ui/Toast";
import { VERIFIER_FIXTURES, type VerifierFixture } from "../../verify/fixtures";
import type { UseReceiptInputResult } from "../../hooks/useReceiptInput";

export interface SampleControlsProps {
  input: UseReceiptInputResult;
}

export function SampleControls({ input }: SampleControlsProps) {
  const toast = useToast();
  return (
    <div className="sample-controls" role="group" aria-label="Sample receipts">
      <span className="sample-controls-label" aria-hidden="true">
        Try a sample
      </span>
      {VERIFIER_FIXTURES.map((fixture) => (
        <SampleButton
          key={fixture.id}
          fixture={fixture}
          onClick={() => {
            input.load(fixture.raw);
            toast.push(
              "info",
              `Loaded fixture "${fixture.label}"`,
              fixture.expected === "pass"
                ? "Verification is expected to PASS."
                : `Verification is expected to FAIL with: ${fixture.expectedCodes}`,
            );
          }}
        />
      ))}
    </div>
  );
}

interface SampleButtonProps {
  fixture: VerifierFixture;
  onClick: () => void;
}

function SampleButton({ fixture, onClick }: SampleButtonProps) {
  return (
    <button
      type="button"
      className={`sample-button ${fixture.expected}`}
      onClick={onClick}
      title={`${fixture.hint} • expects ${fixture.expected === "pass" ? "PASS" : `FAIL: ${fixture.expectedCodes}`}`}
    >
      <span className={`sample-bullet ${fixture.expected}`} aria-hidden="true" />
      {fixture.label}
    </button>
  );
}
