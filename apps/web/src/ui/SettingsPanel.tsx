import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../hooks/useTheme";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { theme, isDark, toggle } = useTheme();
  const [autoRefresh, setAutoRefresh] = useLocalStorage("auto-refresh", true);
  const [reduceMotion, setReduceMotion] = useLocalStorage("reduce-motion", false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Trap focus
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", trap);
    first?.focus();
    return () => document.removeEventListener("keydown", trap);
  }, [open]);

  // Reset reduced motion preference
  useEffect(() => {
    if (reduceMotion) {
      document.documentElement.classList.add("user-reduce-motion");
    } else {
      document.documentElement.classList.remove("user-reduce-motion");
    }
    return () => {
      document.documentElement.classList.remove("user-reduce-motion");
    };
  }, [reduceMotion]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="settings-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
        >
          <motion.div
            ref={panelRef}
            className="settings-panel"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="settings-header">
              <h2>Settings</h2>
              <button
                type="button"
                className="settings-close"
                onClick={onClose}
                aria-label="Close settings"
              >
                &times;
              </button>
            </header>

            <div className="settings-body">
              {/* Appearance */}
              <div className="settings-group">
                <span className="settings-group-label">Appearance</span>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <strong>Dark theme</strong>
                    <span>Switch between dark and light mode</span>
                  </div>
                  <button
                    type="button"
                    className={`settings-toggle ${isDark ? "active" : ""}`}
                    onClick={toggle}
                    role="switch"
                    aria-checked={isDark}
                    aria-label="Toggle dark theme"
                  >
                    <span className="settings-toggle-handle" />
                  </button>
                </div>
              </div>

              {/* Behavior */}
              <div className="settings-group">
                <span className="settings-group-label">Behavior</span>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <strong>Auto-refresh</strong>
                    <span>Automatically refresh data on dashboard and live pages</span>
                  </div>
                  <button
                    type="button"
                    className={`settings-toggle ${autoRefresh ? "active" : ""}`}
                    onClick={() => setAutoRefresh((v) => !v)}
                    role="switch"
                    aria-checked={autoRefresh}
                    aria-label="Toggle auto-refresh"
                  >
                    <span className="settings-toggle-handle" />
                  </button>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <strong>Reduce motion</strong>
                    <span>Minimize animations and transitions</span>
                  </div>
                  <button
                    type="button"
                    className={`settings-toggle ${reduceMotion ? "active" : ""}`}
                    onClick={() => setReduceMotion((v) => !v)}
                    role="switch"
                    aria-checked={reduceMotion}
                    aria-label="Toggle reduced motion"
                  >
                    <span className="settings-toggle-handle" />
                  </button>
                </div>
              </div>
            </div>

            <footer className="settings-footer">
              <kbd>Esc</kbd>
              <span style={{ marginLeft: 8, fontSize: "0.78rem", color: "var(--faint)" }}>
                Close
              </span>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
