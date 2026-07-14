import { useTheme } from "../hooks/useTheme";

interface ThemeToggleProps {
  className?: string;
}

/**
 * A toggle button for switching between dark and light mode.
 * Renders a sun/moon icon and has a tooltip.
 */
export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode (current: ${theme})`}
    >
      {isDark ? (
        /* Sun icon for dark mode (switch to light) */
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon icon for light mode (switch to dark) */
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

/**
 * A larger theme toggle with label, intended for use in settings/panels.
 */
export function ThemeToggleLabelled() {
  const { theme, isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle labelled"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
      <span className="theme-toggle-indicator">{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}
