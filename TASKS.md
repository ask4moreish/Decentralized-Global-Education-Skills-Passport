# ✅ Issue #114 Receipt Schema Version Rejection — Complete

- [x] Phase 1: Locate offline receipt verifier and inspect current error handling
- [x] Phase 2: Create version-modified inline receipt fixture or clone
- [x] Phase 3: Implement deterministic version check and validation rules
- [x] Phase 4: Run typecheck and test suites via pnpm filter gates

---

# ⏳ Low Priority — Clean up `migrateAutoRefresh` helper (delete after migration window)

When enough time has passed for all active users to have run the one-time
migration from the old `auto-refresh` localStorage key to `refresh-interval`,
remove the migration code.

**What to delete:**
- [ ] Export `migrateAutoRefresh` function in `apps/web/src/hooks/useLocalStorage.ts`
- [ ] `OLD_AUTO_REFRESH_KEY` constant in `apps/web/src/hooks/useLocalStorage.ts`
- [ ] `migrate` callback parameter from `useLocalStorage` calls in all 4 consumers:
  - `apps/web/src/hooks/useDashboardData.ts`
  - `apps/web/src/hooks/useLiveRound.ts`
  - `apps/web/src/hooks/useDrandBeacon.ts`
  - `apps/web/src/ui/SettingsPanel.tsx`
- [ ] `migrateAutoRefresh` imports from all 4 files above
- [ ] Clear the now-unused `migrate` logic inside `useLocalStorage` (the try-catch block that calls `migrate()`)

**Context:** The migration was added in commit `24c08dd` (July 2026). It reads the
old binary `auto-refresh` key, deletes it, and returns 0 (Off) or 30s (default).
Since the migration runs up to 4 times per page load (once per consumer), every
user who opens the web app after the migration commit will have their old value
consumed and the key cleaned up. After a reasonable window (e.g. next major
release), this code becomes dead weight.
