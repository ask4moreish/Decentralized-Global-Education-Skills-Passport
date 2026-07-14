import { useEffect, useState } from "react";

/**
 * Configuration for relative time formatting.
 */
interface RelativeTimeOptions {
  /** Auto-update interval in ms. Default: 60_000 (1 minute). */
  updateIntervalMs?: number;
  /** Whether to show a full date for old timestamps. Default: true (shows date if > 30 days). */
  preferFullDate?: boolean;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Returns a human-readable relative time string (e.g., "5 min ago", "just now")
 * that auto-updates at the specified interval.
 *
 * Usage:
 *   const timeAgo = useRelativeTime(new Date("2024-01-15"));
 *   // => "2 weeks ago"
 */
export function useRelativeTime(
  timestamp: Date | number | string | null | undefined,
  options: RelativeTimeOptions = {},
): string {
  const { updateIntervalMs = 60_000, preferFullDate = true } = options;

  const [label, setLabel] = useState<string>(() =>
    timestamp ? formatRelativeTime(timestamp, preferFullDate) : "",
  );

  useEffect(() => {
    if (!timestamp) {
      setLabel("");
      return;
    }

    const update = () => setLabel(formatRelativeTime(timestamp, preferFullDate));
    update();

    const interval = setInterval(update, updateIntervalMs);
    return () => clearInterval(interval);
  }, [timestamp, updateIntervalMs, preferFullDate]);

  return label;
}

/**
 * Returns a human-readable relative time string.
 * "just now" for < 30s, "X min ago", "X hr ago", "X days ago", "X weeks ago", etc.
 */
export function formatRelativeTime(
  timestamp: Date | number | string,
  preferFullDate = true,
): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = Date.now();
  const diff = now - date.getTime();

  if (Number.isNaN(diff)) return "invalid date";

  // Future dates
  if (diff < 0) {
    const abs = Math.abs(diff);
    if (abs < MINUTE) return "in a few seconds";
    if (abs < HOUR) return `in ${Math.round(abs / MINUTE)} min`;
    if (abs < DAY) return `in ${Math.round(abs / HOUR)} hr`;
    if (abs < WEEK) return `in ${Math.round(abs / DAY)} days`;
    return date.toLocaleDateString();
  }

  // Past dates
  if (diff < 30 * SECOND) return "just now";
  if (diff < MINUTE) return `${Math.round(diff / SECOND)}s ago`;
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} hr ago`;
  if (diff < WEEK) return `${Math.round(diff / DAY)} days ago`;
  if (diff < MONTH) return `${Math.round(diff / WEEK)} weeks ago`;
  if (diff < YEAR) return `${Math.round(diff / MONTH)} months ago`;

  if (preferFullDate) {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return `${Math.round(diff / YEAR)} years ago`;
}

/**
 * Format a Unix timestamp (seconds) to a relative time string.
 */
export function formatUnixRelativeTime(unixSeconds: number): string {
  return formatRelativeTime(new Date(unixSeconds * 1000));
}
