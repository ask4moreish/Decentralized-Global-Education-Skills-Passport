import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useTheme } from "../hooks/useTheme";
import { DEFAULT_REFRESH_INTERVAL_SEC } from "../lib/settings";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/** Refresh interval presets in seconds. 0 = off. */
const REFRESH_PRESETS = [
  { seconds: 0, label: "Off", helper: "manual only" },
  { seconds: 10, label: "10s", helper: "live" },
  { seconds: 30, label: "30s", helper: "balanced" },
  { seconds: 60, label: "1 min", helper: "relaxed" },
  { seconds: 300, label: "5 min", helper: "sporadic" },
] as const;

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { isDark, toggle } = useTheme();
  const [refreshInterval, setRefreshInterval] = useLocalStorage<number>(
    "refresh-interval",
    DEFAULT_REFRESH_INTERVAL_SEC,
  );
  const [reduceMotion, setReduceMotion] = useLocalStorage("reduce-motion", false);
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, { active: open, onEscape: onClose });

  // Export the raw seconds value for the consumer hook via the DOM
  // so the hooks can read it from the shared localStorage key.
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

  function formatLabel(seconds: number): string {
    const preset = REFRESH_PRESETS.find((p) => p.seconds === seconds);
    if (preset) return preset.label;
    if (seconds <= 0) return "Off";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)} min`;
  }

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
                    <span>
                      Poll interval for dashboard and live pages · current:{" "}
                      {formatLabel(refreshInterval)}
                    </span>
                  </div>
                </div>
                <div
                  className="settings-chip-row"
                  role="radiogroup"
                  aria-label="Refresh interval"
                >
                  {REFRESH_PRESETS.map((preset) => {
                    const selected = refreshInterval === preset.seconds;
                    return (
                      <button
                        key={preset.seconds}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`settings-chip ${selected ? "selected" : ""}`}
                        onClick={() => setRefreshInterval(preset.seconds)}
                      >
                        <strong>{preset.label}</strong>
                        <small>{preset.helper}</small>
                      </button>
                    );
                  })}
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
