import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationFilter } from "./types";
import { NotificationBell } from "./NotificationBell";
import { NotificationDropdown } from "./NotificationDropdown";
import { useNotificationContext } from "./NotificationContext";

export function NotificationPanel() {
  const { items, unreadCount, markRead, markAllRead, clearAll } = useNotificationContext();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    // Delay to avoid the toggle click itself triggering close
    const id = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", handler);
    };
  }, [open, close]);

  return (
    <div className="notification-panel" ref={containerRef}>
      <NotificationBell
        unreadCount={unreadCount}
        hasNotifications={items.length > 0}
        onClick={toggle}
        open={open}
      />
      <NotificationDropdown
        open={open}
        items={items}
        filter={filter}
        onClose={close}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onClearAll={clearAll}
        onFilterChange={setFilter}
      />
    </div>
  );
}
