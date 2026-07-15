# ✅ Issue #114 Receipt Schema Version Rejection — Complete

- [x] Phase 1: Locate offline receipt verifier and inspect current error handling
- [x] Phase 2: Create version-modified inline receipt fixture or clone
- [x] Phase 3: Implement deterministic version check and validation rules
- [x] Phase 4: Run typecheck and test suites via pnpm filter gates

---

# ✅ Low Priority — Clean up `migrateAutoRefresh` helper (deleted)

The migration window has passed. All cleanup items are complete:

- [x] Export `migrateAutoRefresh` function in `apps/web/src/hooks/useLocalStorage.ts`
- [x] `OLD_AUTO_REFRESH_KEY` constant in `apps/web/src/hooks/useLocalStorage.ts`
- [x] `migrate` callback parameter from `useLocalStorage` calls in all 4 consumers:
  - `apps/web/src/hooks/useDashboardData.ts`
  - `apps/web/src/hooks/useLiveRound.ts`
  - `apps/web/src/hooks/useDrandBeacon.ts`
  - `apps/web/src/ui/SettingsPanel.tsx`
- [x] `migrateAutoRefresh` imports from all 4 files above
- [x] Clear the now-unused `migrate` logic inside `useLocalStorage` (the try-catch block that calls `migrate()`)

---

# 📋 Done
