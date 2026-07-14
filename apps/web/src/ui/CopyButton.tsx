import { useClipboard } from "../hooks/useClipboard";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  /** Show the button as a simple icon-only button. */
  iconOnly?: boolean;
  /** Override the default copied label. */
  copiedLabel?: string;
}

/**
 * A button that copies text to clipboard with visual feedback.
 * Shows checkmark briefly after copying.
 */
export function CopyButton({
  text,
  label = "Copy",
  className = "",
  iconOnly = false,
  copiedLabel = "Copied!",
}: CopyButtonProps) {
  const { copied, copy, error } = useClipboard();

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? "copied" : ""} ${error ? "error" : ""} ${className}`}
      onClick={() => copy(text)}
      title={error ?? `Copy to clipboard`}
      aria-label={copied ? copiedLabel : `Copy ${label}`}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      {!iconOnly ? <span>{copied ? copiedLabel : label}</span> : null}
    </button>
  );
}

/**
 * A small inline copy icon button for truncated text (addresses, hashes, etc.).
 */
export function InlineCopyButton({
  text,
  ariaLabel,
}: {
  text: string;
  ariaLabel?: string;
}) {
  const { copied, copy } = useClipboard(1500);

  return (
    <button
      type="button"
      className={`inline-copy-btn ${copied ? "copied" : ""}`}
      onClick={() => copy(text)}
      title="Copy to clipboard"
      aria-label={ariaLabel ?? `Copy ${text.slice(0, 8)}…`}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
