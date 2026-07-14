import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  /** Default open state. Default: false. */
  defaultOpen?: boolean;
  /** Optional badge/count to show next to the title. */
  badge?: string | number;
  /** Optional className override. */
  className?: string;
  /** Optional id for accessibility / anchor linking. */
  id?: string;
}

/**
 * A collapsible section with animated expand/collapse.
 * Useful for organizing evidence panels, logs, and detail views.
 *
 * Usage:
 *   <CollapsibleSection title="Agent Activity" badge={3}>
 *     ... content ...
 *   </CollapsibleSection>
 */
export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  badge,
  className = "",
  id,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`collapsible-section ${open ? "open" : ""} ${className}`} id={id}>
      <button
        type="button"
        className="collapsible-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id ? `collapsible-content-${id}` : undefined}
      >
        <span className="collapsible-chevron" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
        <strong className="collapsible-title">{title}</strong>
        {badge != null ? <span className="collapsible-badge">{badge}</span> : null}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="collapsible-content"
            id={id ? `collapsible-content-${id}` : undefined}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
