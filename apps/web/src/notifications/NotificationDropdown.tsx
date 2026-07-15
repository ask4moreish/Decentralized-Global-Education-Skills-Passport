import { motion, AnimatePresence } from "framer-motion";
import type { NotificationItem } from "./types";
import { NotificationItemView } from "./NotificationItemView";

interface NotificationDropdownProps {
  open: boolean;
  items: NotificationItem[];
  filter: string;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onClearByType: (type: string) => void;
  onFilterChange: (filter: string) => void;
}

export function NotificationDropdown({
  open,
  items,
  filter,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onClearByType,
  onFilterChange,
}: NotificationDropdownProps) {
  const filtered = filter === "all"
    ? items
    : filter === "unread"
      ? items.filter((i) => !i.read)
      : items.filter((i) => i.type === filter);

  const hasItems = filtered.length > 0;
  const hasUnread = items.some((i) => !i.read);

  const FILTERS = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "commit", label: "Commits" },
    { value: "reveal", label: "Reveals" },
    { value: "settle", label: "Settlements" },
    { value: "error", label: "Errors" },
  ] as const;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            className="notification-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            key="dropdown"
            className="notification-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="notification-dropdown-header">
              <strong>Notifications</strong>
            <div className="notification-dropdown-actions">
              {hasUnread ? (
                <button type="button" className="notification-action-btn" onClick={onMarkAllRead}>
                  Mark all read
                </button>
              ) : null}
              {filter !== "all" && hasItems ? (
                <button type="button" className="notification-action-btn" onClick={() => onClearByType(filter)}>
                  Clear visible
                </button>
              ) : null}
              {hasItems ? (
                <button type="button" className="notification-action-btn" onClick={onClearAll}>
                  Clear all
                </button>
              ) : null}
            </div>
            </div>

            <div className="notification-filter-chips">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`notification-filter-chip ${filter === f.value ? "active" : ""}`}
                  onClick={() => onFilterChange(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="notification-list">
              {!hasItems ? (
                <div className="notification-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <p>No notifications{filter !== "all" ? " for this filter" : ""}</p>
                </div>
              ) : (
                filtered.map((item) => (
                  <NotificationItemView
                    key={item.id}
                    item={item}
                    onMarkRead={onMarkRead}
                    onDismiss={onClearByType ? (id) => onClearByType(item.type) : undefined}
                  />
                ))
              )}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
