import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { Shortcut } from "../hooks/useKeyboardShortcuts";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
  /** Current page scope to highlight active shortcuts. */
  currentScope?: string;
}

function groupShortcuts(shortcuts: Shortcut[]): Record<string, Shortcut[]> {
  const groups: Record<string, Shortcut[]> = {};
  for (const s of shortcuts) {
    const scope = s.scope ?? "global";
    if (!groups[scope]) groups[scope] = [];
    groups[scope].push(s);
  }
  return groups;
}

const SCOPE_LABELS: Record<string, string> = {
  global: "Global",
  demo: "Demo / Live Round",
  verify: "Receipt Verifier",
  drand: "Drand Beacon",
  dashboard: "Dashboard",
};

export function KeyboardShortcutsModal({
  open,
  onClose,
  shortcuts,
  currentScope,
}: KeyboardShortcutsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, { active: open, onEscape: onClose });

  const groups = groupShortcuts(shortcuts);
  const scopeKeys = Object.keys(groups);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="shortcuts-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <motion.div
            ref={panelRef}
            className="shortcuts-panel"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shortcuts-header">
              <h2>Keyboard shortcuts</h2>
              <button
                type="button"
                className="shortcuts-close"
                onClick={onClose}
                aria-label="Close shortcuts"
              >
                &times;
              </button>
            </header>

            {scopeKeys.length === 0 ? (
              <p className="shortcuts-empty">No shortcuts registered.</p>
            ) : (
              <div className="shortcuts-body">
                {scopeKeys.map((scope) => (
                  <section
                    key={scope}
                    className={`shortcuts-group ${scope === currentScope ? "active-scope" : ""}`}
                  >
                    <span className="shortcuts-scope-label">
                      {SCOPE_LABELS[scope] ?? scope}
                    </span>
                    <div className="shortcuts-list">
                      {groups[scope].map((s) => (
                        <div key={s.id} className="shortcuts-row">
                          <span className="shortcuts-label">{s.label}</span>
                          <kbd className="shortcuts-keys">{s.keys}</kbd>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <footer className="shortcuts-footer">
              <kbd>Esc</kbd>
              <span>Close</span>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
