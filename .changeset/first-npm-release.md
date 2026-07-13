---
'@decentralized-global-education-skills-passport/round-bindings': minor
'@decentralized-global-education-skills-passport/tlock': minor
'@decentralized-global-education-skills-passport/sdk': minor
---

Initial npm publish setup — build pipeline, documentation, CI, security hardening

### Build & publish infrastructure

- Added `tsconfig.build.json` for production emits (declarations + sourcemaps)
- Added `clean` + `build` scripts to each package
- Added `publishConfig` with `access: public` and dist-path overrides
- Added `sideEffects: false` for tree-shaking
- Configured `@changesets/cli` for version management with fixed version group
- Added `changeset`, `version-packages`, and `release` scripts to root package.json
- Added `npm-publish.yml` GitHub Actions workflow using `changesets/action@v1`

### Package documentation

- Added per-package READMEs with install guides, quick starts, full API references
- Added consistent npm-style header badges (npm version, license, build status)
- Added root `CHANGELOG.md` covering project history

### Security hardening

- Removed over-permissive Vite `fs.allow` rule (security fix)
- Added `_headers` file for Netlify/Cloudflare Pages CSP + HSTS
- Added `vercel.json` with security headers + SPA rewrites
- Added security headers to Vite dev server
- Added deployment security docs to `docs/DEPLOY.md`
- Removed unused `stream-browserify` and `events` polyfills (-11 kB gzip)

### Other

- Fixed `round-bindings` build by adding `rootDir: "./src"`
- Added receipt schema version rejection documentation
