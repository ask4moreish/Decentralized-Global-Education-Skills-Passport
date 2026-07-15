import { describe, it } from "node:test";
import { deepEqual } from "node:assert/strict";
import type { NotificationItem } from "./types";

// Inline the reducer for testing (pure function, no React needed)
import { notificationReducer } from "./reducer";

describe("notificationReducer", () => {
  const emptyState = { items: [] as NotificationItem[], nextId: 1 };

  it("ADD creates a new notification with id and timestamp", () => {
    const state = notificationReducer(emptyState, {
      type: "ADD",
      payload: { type: "commit", title: "Test", detail: "detail" },
    });
    deepEqual(state.items.length, 1);
    deepEqual(state.items[0].type, "commit");
    deepEqual(state.items[0].title, "Test");
    deepEqual(state.items[0].read, false);
    deepEqual(typeof state.items[0].id, "string");
    deepEqual(state.items[0].id.startsWith("notif-"), true);
    deepEqual(typeof state.items[0].timestamp, "number");
    deepEqual(state.nextId, 2);
  });

  it("ADD caps at MAX_ITEMS (100)", () => {
    let state = { items: [] as NotificationItem[], nextId: 1 };
    for (let i = 0; i < 110; i++) {
      state = notificationReducer(state, {
        type: "ADD",
        payload: { type: "info", title: `Item ${i}` },
      });
    }
    deepEqual(state.items.length, 100);
  });

  it("DISMISS removes a notification by id", () => {
    const state = notificationReducer(
      { items: [{ id: "notif-1", type: "info", title: "x", timestamp: 1, read: false }], nextId: 2 },
      { type: "DISMISS", id: "notif-1" },
    );
    deepEqual(state.items.length, 0);
  });

  it("MARK_READ sets read to true", () => {
    const state = notificationReducer(
      { items: [{ id: "notif-1", type: "info", title: "x", timestamp: 1, read: false }], nextId: 2 },
      { type: "MARK_READ", id: "notif-1" },
    );
    deepEqual(state.items[0].read, true);
  });

  it("MARK_ALL_READ marks all as read", () => {
    const state = notificationReducer(
      {
        items: [
          { id: "notif-1", type: "info", title: "a", timestamp: 1, read: false },
          { id: "notif-2", type: "error", title: "b", timestamp: 2, read: false },
        ],
        nextId: 3,
      },
      { type: "MARK_ALL_READ" },
    );
    deepEqual(state.items.every((i) => i.read), true);
  });

  it("CLEAR_ALL removes all items", () => {
    const state = notificationReducer(
      { items: [{ id: "notif-1", type: "info", title: "x", timestamp: 1, read: false }], nextId: 2 },
      { type: "CLEAR_ALL" },
    );
    deepEqual(state.items.length, 0);
  });

  it("CLEAR_BY_TYPE removes only matching type", () => {
    const state = notificationReducer(
      {
        items: [
          { id: "notif-1", type: "commit", title: "a", timestamp: 1, read: false },
          { id: "notif-2", type: "error", title: "b", timestamp: 2, read: false },
          { id: "notif-3", type: "commit", title: "c", timestamp: 3, read: true },
        ],
        nextId: 4,
      },
      { type: "CLEAR_BY_TYPE", notificationType: "commit" },
    );
    deepEqual(state.items.length, 1);
    deepEqual(state.items[0].type, "error");
  });

  it("HYDRATE replaces state completely", () => {
    const state = notificationReducer(emptyState, {
      type: "HYDRATE",
      items: [
        { id: "notif-5", type: "reveal", title: "hydrated", timestamp: 100, read: true },
      ],
      nextId: 6,
    });
    deepEqual(state.items.length, 1);
    deepEqual(state.items[0].title, "hydrated");
    deepEqual(state.nextId, 6);
  });
});
