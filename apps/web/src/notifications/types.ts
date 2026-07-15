export type NotificationType =
  | "commit"
  | "reveal"
  | "settle"
  | "error"
  | "warning"
  | "info"
  | "success";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  detail?: string;
  timestamp: number;
  read: boolean;
  /** Optional link to navigate to (e.g. "#/dashboard") */
  link?: string;
  /** Optional data payload for contextual actions */
  roundId?: bigint;
}

export type NotificationFilter = NotificationType | "all" | "unread";
