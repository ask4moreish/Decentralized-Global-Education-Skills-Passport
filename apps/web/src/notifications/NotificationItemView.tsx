import { motion } from "framer-motion";
import type { NotificationItem } from "./types";

const TONE_ICONS: Record<string, string> = {
  commit: "🔒",
  reveal: "🔓",
  settle: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  success: "🎉",
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NotificationItemViewProps {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export function NotificationItemView({ item, onMarkRead, onDismiss }: NotificationItemViewProps) {
  const handleClick = () => {
    if (!item.read) onMarkRead(item.id);
  };

  const content = (
    <motion.button
      type="button"
      className={`notification-item ${item.read ? "read" : "unread"} notification-item-${item.type}`}
      onClick={handleClick}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <span className="notification-item-icon" aria-hidden="true">
        {TONE_ICONS[item.type] ?? "📌"}
      </span>
      <div className="notification-item-body">
        <strong>{item.title}</strong>
        {item.detail ? <p>{item.detail}</p> : null}
        <small>{relativeTime(item.timestamp)}</small>
      </div>
      {!item.read ? <span className="notification-item-dot" aria-label="Unread" /> : null}
      {onDismiss ? (
        <button
          type="button"
          className="notification-item-dismiss"
          aria-label="Dismiss notification"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDismiss(item.id);
          }}
        >
          ×
        </button>
      ) : null}
    </motion.button>
  );

  if (item.link) {
    return <a href={item.link}>{content}</a>;
  }

  return content;
}
