import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { getUseCase } from "./config/useCases";
import type { UseCaseId } from "./config/useCases";
import { hashFor, routeFromHash, type RouteState } from "./config/routing";
import { ConfigBanner } from "./components/ConfigBanner";
import { ToastProvider } from "./ui/Toast";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { SkipToContent } from "./ui/SkipToContent";
import { ScrollToTop } from "./hooks/useScrollToTop";
import { MobileNav } from "./ui/MobileNav";
import { ThemeToggle } from "./ui/ThemeToggle";
import { SettingsPanel } from "./ui/SettingsPanel";
import { NetworkStatus } from "./ui/NetworkStatus";
import { KeyboardShortcutsModal } from "./ui/KeyboardShortcutsModal";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import type { Shortcut } from "./hooks/useKeyboardShortcuts";
import { NotificationProvider } from "./notifications";
import { NotificationPanel } from "./notifications";

/* Route-level code splitting — each page loads only when navigated to.
   React.lazy requires a default export, so we map named exports with .then(). */
const ArchitecturePage = lazy(() =>
  import("./pages/ArchitecturePage").then((m) => ({ default: m.ArchitecturePage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const DemoPage = lazy(() =>
  import("./pages/DemoPage").then((m) => ({ default: m.DemoPage })),
);
const DrandPage = lazy(() =>
  import("./pages/DrandPage").then((m) => ({ default: m.DrandPage })),
);
const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const VerifyPage = lazy(() =>
  import("./pages/VerifyPage").then((m) => ({ default: m.VerifyPage })),
);

function PageFallback() {
  return (
    <div className="page-skeleton">
      <div className="page-skeleton-spinner" aria-hidden="true" />
      <span>Loading section…</span>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(routeFromHash);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shortcuts = useKeyboardShortcuts();

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function navigate(page: RouteState["page"], useCase: UseCaseId = route.useCase) {
    window.location.hash = hashFor(page, useCase);
    setRoute({ page, useCase });
  }

  const active = getUseCase(route.useCase);

  // Register global keyboard shortcuts
  const globalShortcuts = useMemo<Shortcut[]>(
    () => [
      {
        id: "shortcuts-help",
        label: "Toggle keyboard shortcuts",
        keys: "?",
        combo: "?",
        handler: () => shortcuts.openModal(),
        scope: "global",
        preventDefault: false,
      },
      {
        id: "shortcuts-help-ctrl",
        label: "Toggle keyboard shortcuts",
        keys: "⌘/" + " or " + "Ctrl+/",
        combo: "cmd+/",
        handler: () => shortcuts.openModal(),
        scope: "global",
      },
      {
        id: "nav-home",
        label: "Go to home",
        keys: "G then H",
        combo: "g h",
        handler: () => navigate("landing"),
        scope: "global",
      },
      {
        id: "nav-demo",
        label: "Go to demo",
        keys: "G then D",
        combo: "g d",
        handler: () => navigate("demo", route.useCase),
        scope: "global",
      },
      {
        id: "nav-verify",
        label: "Go to receipt verifier",
        keys: "G then V",
        combo: "g v",
        handler: () => navigate("verify"),
        scope: "global",
      },
      {
        id: "nav-dashboard",
        label: "Go to dashboard",
        keys: "G then B",
        combo: "g b",
        handler: () => navigate("dashboard"),
        scope: "global",
      },
      {
        id: "nav-drand",
        label: "Go to Drand beacon",
        keys: "G then R",
        combo: "g r",
        handler: () => navigate("drand"),
        scope: "global",
      },
      {
        id: "nav-arch",
        label: "Go to architecture",
        keys: "G then A",
        combo: "g a",
        handler: () => navigate("architecture"),
        scope: "global",
      },
      {
        id: "settings",
        label: "Toggle settings",
        keys: "⌘,",
        combo: "cmd+,",
        handler: () => setSettingsOpen((v) => !v),
        scope: "global",
      },
    ],
    [navigate, route.useCase],
  );

  // Register global shortcuts — stable across renders
  useEffect(() => {
    const unsubs = globalShortcuts.map((s) => shortcuts.register(s));
    return () => unsubs.forEach((u) => u());
  }, [globalShortcuts]);

  // Determine current page scope for keyboard shortcut modal highlighting
  const currentScope = useMemo(() => {
    switch (route.page) {
      case "demo":
      case "architecture":
        return "demo";
      case "verify":
        return "verify";
      case "drand":
        return "drand";
      case "dashboard":
        return "dashboard";
      default:
        return "global";
    }
  }, [route.page]);

  return (
    <NotificationProvider>
    <ToastProvider>
      <SkipToContent />
      <ScrollToTop deps={[route.page, route.useCase]} />
      <ErrorBoundary name="App">
        {/* Mobile navigation — visible on small screens */}
        <div className="mobile-nav-bar">
          <div className="mobile-nav-bar-left">
            <MobileNav route={route} onNavigate={navigate} />
          </div>
          <div className="mobile-nav-bar-right">
            <NetworkStatus />
            <NotificationPanel />
            <ThemeToggle />
            <button
              type="button"
              className="settings-btn"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              type="button"
              className="shortcuts-help-btn"
              onClick={() => shortcuts.openModal()}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Single Suspense boundary covers all lazy-loaded pages */}
        <Suspense fallback={<PageFallback />}>
          {route.page === "landing" ? (
            <LandingPage
              onDemo={() => navigate("demo", "grants")}
              onCase={(id) => navigate("demo", id)}
            />
          ) : route.page === "dashboard" ? (
            <DashboardPage goHome={() => navigate("landing")} />
          ) : route.page === "verify" ? (
            <VerifyPage goHome={() => navigate("landing")} />
          ) : route.page === "drand" ? (
            <DrandPage goHome={() => navigate("landing")} />
          ) : (
            <>
              <ConfigBanner />
              {route.page === "architecture" ? (
                <ArchitecturePage goHome={() => navigate("landing")} />
              ) : (
                <DemoPage
                  active={active}
                  setActive={(id) => navigate("demo", id)}
                  goHome={() => navigate("landing")}
                />
              )}
            </>
          )}
        </Suspense>

        {/* Global overlay components */}
        <KeyboardShortcutsModal
          open={shortcuts.isModalOpen}
          onClose={() => shortcuts.closeModal()}
          shortcuts={[...globalShortcuts, ...shortcuts.shortcuts.filter((s) => s.id !== "shortcuts-help" && s.id !== "shortcuts-help-ctrl" && s.id !== "nav-home" && s.id !== "nav-demo" && s.id !== "nav-verify" && s.id !== "nav-dashboard" && s.id !== "nav-drand" && s.id !== "nav-arch" && s.id !== "settings")]}
          currentScope={currentScope}
        />
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </ErrorBoundary>
    </ToastProvider>
    </NotificationProvider>
  );
}
