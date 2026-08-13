## Summary

What does this change do and why?

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] CI / tooling

## Checklist

- [ ] Typecheck passes for affected workspaces (`pnpm -r run typecheck`)
- [ ] Tests pass for affected workspaces
- [ ] New or changed behavior has tests
- [ ] Commit messages follow [Conventional Commits](./CONTRIBUTING.md#commit-messages)
- [ ] SDK public API snapshot updated if exports changed
- [ ] Bindings regenerated (`pnpm bindings:generate`) if the contract changed
- [ ] Docs updated (`pnpm docs:check-links`)

## Notes for reviewers

Anything in particular you want eyes on (e.g. security-sensitive paths, TTL
changes, settlement logic)?
