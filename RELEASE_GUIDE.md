# Release Guide

How to publish the Skills Passport packages to npm.

---

## Prerequisites (one-time setup)

### 1. Create npm organization

The publishable packages (`round-bindings`, `skills-passport-sdk`, `skills-passport-tlock`)
are unscoped and published under your personal or org npm account.

### 2. Generate an npm automation token

An **automation token** is required so CI can publish without an interactive login:

1. Go to https://www.npmjs.com/settings/<your-username>/tokens
2. Click **"Generate New Token"** → **"Automation"**
3. Copy the token (starts with `npm_`)

### 3. Add the token to GitHub Secrets

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Name: `NPM_TOKEN`
4. Value: paste the npm automation token

### 4. Create the `npm-publish` GitHub Environment (optional)

The publish workflow uses `environment: npm-publish` for deploy protection.
If you want:

1. Go to your repo → **Settings** → **Environments** → **New environment**
2. Name: `npm-publish`
3. Optionally add required reviewers before deployment

If you skip this step, the workflow will fall back to using secrets from the
repo level (still secure, just no manual approval gate).

---

## First release (v0.1.0)

> **Important:** The packages are already at version `0.1.0` in their `package.json` files.
> **Do NOT** run `pnpm version-packages` — that would consume the changeset and bump
> to `0.2.0`. The existing changeset (`first-npm-release.md`) documents the session work
> and will be consumed on the *next* release cycle.

### 1. Commit the current changes

```bash
git add -A
git commit -m "chore: prepare v0.1.0 release"
```

### 2. Tag and push

```bash
git tag v0.1.0
git push origin main --tags
```

### 3. Watch CI

The `Release` workflow in `.github/workflows/npm-publish.yml` will:

1. Run on the push to `main`
2. Detect that there **is** a changeset file (`.changeset/first-npm-release.md`)
3. Trigger the **create Version Packages PR** path (not a publish)

This is **intentional** — the GitHub PR workflow lets you review the changelog and
version bumps before publishing. Once you merge that PR, the second CI run will
publish to npm.

To skip the PR step and publish immediately, first delete the changeset:

```bash
rm .changeset/first-npm-release.md
git add -A && git commit -m "chore: discard changeset for immediate publish"
```

Then push: the workflow will detect no changesets and publish directly to npm.

> **Tradeoff:** The `CHANGELOG.md` already has a manually written `v0.1.0` entry covering
> all session changes. Deleting the changeset just means the auto-generated CHANGELOG
> entry (which would include build pipeline, CI, and security hardening details) won't
> appear — the manual entry covers it. For subsequent releases, always keep changesets.

Check the workflow run at: https://github.com/<org>/<repo>/actions

---

## Subsequent releases

For future releases, the changesets flow is:

```bash
# 1. During development, create a changeset for each meaningful change
pnpm changeset
# Follow the prompts — select packages and describe the change

# 2. Commit the changeset file
git add .changeset/
git commit -m "chore: add changeset"

# 3. Push to main
git push origin main

# 4. The Release workflow will create a "Version Packages" PR automatically
#    Merge that PR when ready → CI publishes to npm
```

---

## Manual release (without CI)

If you need to publish locally (e.g., for testing):

```bash
# Ensure you're logged in to npm
npm login

# Bump versions and generate changelogs
pnpm version-packages

# Build everything
pnpm --filter round-bindings build
pnpm --filter skills-passport-tlock build
pnpm --filter skills-passport-sdk build

# Publish in dependency order
pnpm publish:all
```

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `403 Forbidden` on publish | npm org doesn't exist or token lacks scope access | Create the org and regenerate the token with proper scope |
| `WORKFLOW NOT TRIGGERED` on merge of Version Packages PR | `GITHUB_TOKEN` can't trigger downstream workflows | Merge via the GitHub UI (not bot) — or switch to a PAT |
| Build fails in CI with `stream`/`events` not found | A new dependency imported a Node.js built-in | Update `apps/web/vite.config.ts` to re-add the polyfill alias |
| `changeset status` complains about missing changesets | You have uncommitted changes but no changeset file | Run `pnpm changeset` to create one, or `pnpm changeset --empty` |
