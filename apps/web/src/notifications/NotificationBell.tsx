import { motion, AnimatePresence } from "framer-motion";

interface NotificationBellProps {
  unreadCount: number;
  hasNotifications: boolean;
  onClick: () => void;
  open: boolean;
}

export function NotificationBell({ unreadCount, hasNotifications, onClick, open }: NotificationBellProps) {
  return (
    <button
      type="button"
      className={`notification-bell ${open ? "open" : ""} ${hasNotifications ? "has-notifications" : ""}`}
      onClick={onClick}
      aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
      title="Notifications"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <AnimatePresence>
        {unreadCount > 0 ? (
          <motion.span
            key="badge"
            className="notification-bell-badge"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}
