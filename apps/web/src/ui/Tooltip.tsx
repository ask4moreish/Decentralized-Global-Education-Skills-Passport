import { useCallback, useRef, useState, type ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Position relative to the trigger element. Default: "top". */
  position?: "top" | "bottom" | "left" | "right";
  /** Delay in ms before showing the tooltip. Default: 300. */
  delay?: number;
  /** Maximum width of the tooltip. Default: "280px". */
  maxWidth?: string;
  /** Optional class name for the tooltip content. */
  className?: string;
}

/**
 * A lightweight CSS-based tooltip component.
 * Shows on hover after a configurable delay.
 *
 * Usage:
 *   <Tooltip content="The full text that's truncated">
 *     <span>{shortAddr(longAddress)}</span>
 *   </Tooltip>
 */
export function Tooltip({
  content,
  children,
  position = "top",
  delay = 300,
  maxWidth = "280px",
  className = "",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <span
      className={`tooltip-wrapper ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible ? (
        <span
          className={`tooltip-content tooltip-${position}`}
          style={{ maxWidth }}
          role="tooltip"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
