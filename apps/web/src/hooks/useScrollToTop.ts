import { useEffect } from "react";

/**
 * Scrolls to the top of the page when any of the dependencies change.
 * Useful for navigating between pages/views.
 *
 * Usage:
 *   useScrollToTop([route.page, route.useCase]);
 */
export function useScrollToTop(deps: unknown[]): void {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Also try scrolling the main content area if it exists
    const main = document.querySelector("main");
    if (main) {
      main.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * ScrollToTop component that auto-scrolls to top on mount and on dependency changes.
 * Renders nothing — just a side-effect wrapper.
 */
export function ScrollToTop({ deps }: { deps: unknown[] }) {
  useScrollToTop(deps);
  return null;
}
