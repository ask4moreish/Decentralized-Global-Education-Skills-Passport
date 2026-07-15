import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { SavedReceipt } from "./types";

// ── State ────────────────────────────────────────────────────────────────────

interface ReceiptStoreState {
  receipts: SavedReceipt[];
}

// ── Actions ───────────────────────────────────────────────────────────────────

type ReceiptStoreAction =
  | { type: "SAVE"; receipt: SavedReceipt }
  | { type: "DELETE"; id: string }
  | { type: "UPDATE"; id: string; patch: Partial<Pick<SavedReceipt, "label" | "tags" | "notes">> }
  | { type: "CLEAR_ALL" }
  | { type: "HYDRATE"; receipts: SavedReceipt[] };

// ── Reducer ───────────────────────────────────────────────────────────────────

function receiptStoreReducer(state: ReceiptStoreState, action: ReceiptStoreAction): ReceiptStoreState {
  switch (action.type) {
    case "SAVE": {
      const exists = state.receipts.some((r) => r.fingerprint === action.receipt.fingerprint);
      if (exists) return state;
      return { receipts: [action.receipt, ...state.receipts] };
    }
    case "DELETE":
      return { receipts: state.receipts.filter((r) => r.id !== action.id) };
    case "UPDATE":
      return {
        receipts: state.receipts.map((r) =>
          r.id === action.id ? { ...r, ...action.patch } : r,
        ),
      };
    case "CLEAR_ALL":
      return { receipts: [] };
    case "HYDRATE":
      return { receipts: action.receipts };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ReceiptStoreContextValue {
  receipts: SavedReceipt[];
  saveReceipt: (receipt: SavedReceipt) => void;
  deleteReceipt: (id: string) => void;
  updateReceipt: (id: string, patch: Partial<Pick<SavedReceipt, "label" | "tags" | "notes">>) => void;
  clearAll: () => void;
  hydrate: (receipts: SavedReceipt[]) => void;
  hasReceipt: (fingerprint: string) => boolean;
}

const ReceiptStoreContext = createContext<ReceiptStoreContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

const initialState: ReceiptStoreState = { receipts: [] };

export function ReceiptStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(receiptStoreReducer, initialState);

  const saveReceipt = useCallback(
    (receipt: SavedReceipt) => dispatch({ type: "SAVE", receipt }),
    [],
  );
  const deleteReceipt = useCallback((id: string) => dispatch({ type: "DELETE", id }), []);
  const updateReceipt = useCallback(
    (id: string, patch: Partial<Pick<SavedReceipt, "label" | "tags" | "notes">>) =>
      dispatch({ type: "UPDATE", id, patch }),
    [],
  );
  const clearAll = useCallback(() => dispatch({ type: "CLEAR_ALL" }), []);
  const hydrate = useCallback(
    (receipts: SavedReceipt[]) => dispatch({ type: "HYDRATE", receipts }),
    [],
  );
  const hasReceipt = useCallback(
    (fingerprint: string) => state.receipts.some((r) => r.fingerprint === fingerprint),
    [state.receipts],
  );

  const value = useMemo(
    () => ({ receipts: state.receipts, saveReceipt, deleteReceipt, updateReceipt, clearAll, hydrate, hasReceipt }),
    [state.receipts, saveReceipt, deleteReceipt, updateReceipt, clearAll, hydrate, hasReceipt],
  );

  return (
    <ReceiptStoreContext.Provider value={value}>
      {children}
    </ReceiptStoreContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useReceiptStore() {
  const ctx = useContext(ReceiptStoreContext);
  if (!ctx) throw new Error("useReceiptStore must be used within ReceiptStoreProvider");
  return ctx;
}
