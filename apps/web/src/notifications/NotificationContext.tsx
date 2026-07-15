import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { NotificationFilter, NotificationItem, NotificationType } from "./types";

// ── State ────────────────────────────────────────────────────────────────────

interface NotificationState {
  items: NotificationItem[];
  nextId: number;
}

// ── Actions ───────────────────────────────────────────────────────────────────

type NotificationAction =
  | { type: "ADD"; payload: Omit<NotificationItem, "id" | "timestamp" | "read"> }
  | { type: "DISMISS"; id: string }
  | { type: "MARK_READ"; id: string }
  | { type: "MARK_ALL_READ" }
  | { type: "CLEAR_ALL" }
  | { type: "CLEAR_BY_TYPE"; notificationType: NotificationType }
  | { type: "HYDRATE"; items: NotificationItem[]; nextId: number };

// ── Reducer ───────────────────────────────────────────────────────────────────

const MAX_ITEMS = 100;

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case "ADD": {
      const id = `notif-${state.nextId}`;
      const item: NotificationItem = {
        ...action.payload,
        id,
        timestamp: Date.now(),
        read: false,
      };
      return {
        items: [item, ...state.items].slice(0, MAX_ITEMS),
        nextId: state.nextId + 1,
      };
    }
    case "DISMISS":
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
      };
    case "MARK_READ":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, read: true } : item,
        ),
      };
    case "MARK_ALL_READ":
      return {
        ...state,
        items: state.items.map((item) => ({ ...item, read: true })),
      };
    case "CLEAR_ALL":
      return { ...state, items: [] };
    case "CLEAR_BY_TYPE":
      return {
        ...state,
        items: state.items.filter((item) => item.type !== action.notificationType),
      };
    case "HYDRATE":
      return { items: action.items, nextId: action.nextId };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface NotificationContextValue {
  items: NotificationItem[];
  unreadCount: number;
  add: (type: NotificationType, title: string, detail?: string, link?: string, roundId?: bigint) => string;
  dismiss: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  clearByType: (notificationType: NotificationType) => void;
  hydrate: (items: NotificationItem[], nextId: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

const initialState: NotificationState = { items: [], nextId: 1 };

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  const unreadCount = useMemo(
    () => state.items.filter((item) => !item.read).length,
    [state.items],
  );

  const add: NotificationContextValue["add"] = useCallback(
    (type, title, detail, link, roundId) => {
      dispatch({ type: "ADD", payload: { type, title, detail, link, roundId } });
      return `notif-${state.nextId}`;
    },
    [state.nextId],
  );

  const dismiss = useCallback((id: string) => dispatch({ type: "DISMISS", id }), []);
  const markRead = useCallback((id: string) => dispatch({ type: "MARK_READ", id }), []);
  const markAllRead = useCallback(() => dispatch({ type: "MARK_ALL_READ" }), []);
  const clearAll = useCallback(() => dispatch({ type: "CLEAR_ALL" }), []);
  const clearByType = useCallback(
    (notificationType: NotificationType) => dispatch({ type: "CLEAR_BY_TYPE", notificationType }),
    [],
  );
  const hydrate = useCallback(
    (items: NotificationItem[], nextId: number) => dispatch({ type: "HYDRATE", items, nextId }),
    [],
  );

  const value = useMemo(
    () => ({ items: state.items, unreadCount, add, dismiss, markRead, markAllRead, clearAll, clearByType, hydrate }),
    [state.items, unreadCount, add, dismiss, markRead, markAllRead, clearAll, clearByType, hydrate],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotificationContext must be used within NotificationProvider");
  return ctx;
}
