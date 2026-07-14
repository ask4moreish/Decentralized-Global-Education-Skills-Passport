/**
 * Shared settings constants for the web app.
 *
 * Centralising defaults here ensures all hooks and UI components
 * reference the same values and prevents drift when defaults change.
 */

/** Default refresh interval in seconds (30s). 0 = off. */
export const DEFAULT_REFRESH_INTERVAL_SEC = 30;

/**
 * Namespace prefix for all storage keys (localStorage and sessionStorage).
 * All consumers MUST use this constant to ensure naming consistency.
 */
export const STORAGE_KEY_PREFIX = "decentralized-global-education-skills-passport:";

/** The old theme key used a hyphen separator instead of a colon — kept for migration. */
export const OLD_THEME_STORAGE_KEY = "decentralized-global-education-skills-passport-theme";
