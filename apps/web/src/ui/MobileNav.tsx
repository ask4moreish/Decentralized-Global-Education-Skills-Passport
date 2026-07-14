import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RouteState } from "../config/routing";
import type { UseCaseId } from "../config/useCases";

interface MobileNavProps {
  route: RouteState;
  onNavigate: (page: RouteState["page"], useCase?: UseCaseId) => void;
}

export function MobileNav({ route, onNavigate }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [route]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Trap focus
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const focusable = menuRef.current.querySelectorAll<HTMLElement>(
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

  const isDemo = route.page === "demo" || route.page === "architecture";

  return (
    <div className="mobile-nav">
      <button
        type="button"
        className="mobile-nav-hamburger"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <span className={`hamburger-line ${open ? "open" : ""}`} />
        <span className={`hamburger-line ${open ? "open" : ""}`} />
        <span className={`hamburger-line ${open ? "open" : ""}`} />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="mobile-nav-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              ref={menuRef}
              className="mobile-nav-drawer"
              initial={{ opacity: 0, x: "60%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "60%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
            >
              <div className="mobile-nav-drawer-header">
                <strong>Navigation</strong>
                <button
                  type="button"
                  className="mobile-nav-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  &times;
                </button>
              </div>

              <div className="mobile-nav-links">
                <button
                  type="button"
                  className={`mobile-nav-link ${route.page === "landing" ? "active" : ""}`}
                  onClick={() => onNavigate("landing")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  Home
                </button>

                <button
                  type="button"
                  className={`mobile-nav-link ${isDemo ? "active" : ""}`}
                  onClick={() => onNavigate("demo", "grants")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Demo
                </button>

                <button
                  type="button"
                  className={`mobile-nav-link ${route.page === "verify" ? "active" : ""}`}
                  onClick={() => onNavigate("verify")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Verify
                </button>

                <button
                  type="button"
                  className={`mobile-nav-link ${route.page === "dashboard" ? "active" : ""}`}
                  onClick={() => onNavigate("dashboard")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  Dashboard
                </button>

                <button
                  type="button"
                  className={`mobile-nav-link ${route.page === "drand" ? "active" : ""}`}
                  onClick={() => onNavigate("drand")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Drand
                </button>

                <button
                  type="button"
                  className={`mobile-nav-link ${route.page === "architecture" ? "active" : ""}`}
                  onClick={() => onNavigate("architecture")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Architecture
                </button>
              </div>

              <div className="mobile-nav-external">
                <a
                  href="https://github.com/ask4moreish/Decentralized-Global-Education-Skills-Passport"
                  target="_blank"
                  rel="noreferrer"
                  className="mobile-nav-link external"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub
                </a>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
