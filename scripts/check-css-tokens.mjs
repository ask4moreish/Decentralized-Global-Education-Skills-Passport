#!/usr/bin/env node
/**
 * scripts/check-css-tokens.mjs
 *
 * CI guard that ensures every `var(--token-name)` reference in the web app's
 * CSS files has a corresponding `--token-name: value` declaration somewhere in
 * the stylesheet bundle.
 *
 * The script:
 *   1. Reads all `.css` files under apps/web/src/styles/
 *   2. Builds a registry of all defined custom properties (`--name: …`)
 *   3. Scans every `var(--name)` reference and checks it against the registry
 *   4. Exits 0 if all references are valid, 1 if any are orphaned
 *
 * Tokens set dynamically via JavaScript (e.g. React inline styles) are
 * listed in DYNAMIC_TOKENS below so the check does not flag them.
 *
 * Usage (from repo root):
 *   node scripts/check-css-tokens.mjs
 *
 * Exit codes:
 *   0  all var() references have matching definitions
 *   1  one or more undefined tokens found
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = resolve(__dirname, "../apps/web/src/styles");

// ---------------------------------------------------------------------------
// Tokens that are intentionally set at runtime via JavaScript (e.g. React
// inline styles, scroll-driven animations, etc.) rather than defined in CSS.
// Add any such tokens here so the CI check does not flag them.
// ---------------------------------------------------------------------------
const DYNAMIC_TOKENS = new Set([
  "--commit-progress", // Set dynamically in PhaseGuide (DemoPage.tsx) inline style
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Regex to match `--name:` custom property definitions. */
const DEF_RE = /(--[a-z][a-z0-9_-]*)\s*:/gi;

/** Regex to match `var(--name)` references (with or without fallback). */
const VAR_RE = /var\(\s*(--[a-z][a-z0-9_-]*)\s*(?:,\s*[^)]*)?\)/gi;

/** Extract all `--name:` definitions from CSS text. */
function extractDefinitions(cssText) {
  const defs = new Set();
  for (const m of cssText.matchAll(DEF_RE)) {
    defs.add(m[1].toLowerCase());
  }
  return defs;
}

/**
 * Extract all `var(--name)` references with their line numbers.
 * Scans line-by-line for accurate line reporting.
 */
function extractReferencesByLine(cssText) {
  const refs = []; // [{ ref: string, line: number }]
  const lines = cssText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    // Reset lastIndex on each line for the global regex
    VAR_RE.lastIndex = 0;
    const lineMatches = [...lines[i].matchAll(VAR_RE)];
    for (const m of lineMatches) {
      refs.push({ ref: m[1].toLowerCase(), line: i + 1 });
    }
  }
  return refs;
}

/** Walk a directory recursively and return paths matching a predicate. */
function walk(dir, predicate) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        results.push(...walk(full, predicate));
      } else if (predicate(entry)) {
        results.push(full);
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    // Directory doesn't exist — skip
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const cssFiles = walk(STYLES_DIR, (name) => name.endsWith(".css")).sort();

  if (cssFiles.length === 0) {
    console.log(`  [SKIP] No CSS files found in ${STYLES_DIR}`);
    return 0;
  }

  console.log(`\nCSS custom property lint for ${STYLES_DIR}`);
  console.log(`  ${cssFiles.length} CSS files found`);
  console.log("=".repeat(72));

  // Phase 1: Build the full definition registry from all CSS files
  const allDefinitions = new Set(DYNAMIC_TOKENS); // start with dynamic tokens

  for (const file of cssFiles) {
    const cssText = readFileSync(file, "utf8");
    const defs = extractDefinitions(cssText);
    for (const d of defs) allDefinitions.add(d);
  }

  console.log(`\n  Defined tokens        : ${allDefinitions.size}`);
  console.log(`  Dynamic (JS-set)      : ${DYNAMIC_TOKENS.size}`);
  console.log("=".repeat(72));

  // Phase 2: Check every reference in every file
  let totalFailures = 0;
  const failuresByFile = new Map(); // file -> [{ ref, line }]

  for (const file of cssFiles) {
    const cssText = readFileSync(file, "utf8");
    const refLines = extractReferencesByLine(cssText);

    const fileFailures = refLines.filter(({ ref }) => !allDefinitions.has(ref));
    if (fileFailures.length > 0) {
      failuresByFile.set(file, fileFailures);
      totalFailures += fileFailures.length;
    }
  }

  // Phase 3: Report results
  if (totalFailures === 0) {
    console.log(
      `\n  [PASS] All var() references have matching definitions.\n`,
    );
    return 0;
  }

  console.error(
    `\n  [FAIL] ${totalFailures} undefined token reference(s) found:\n`,
  );
  for (const [file, failures] of failuresByFile) {
    const relPath = file.replace(STYLES_DIR + "/", "");
    console.error(`    ${relPath}`);
    for (const { ref, line } of failures) {
      console.error(`      L${line}  var(${ref})  — no matching definition`);
    }
    console.error("");
  }

  console.error(
    "  Either:\n" +
      "    - add the missing token to tokens.css, or\n" +
      "    - add it to the DYNAMIC_TOKENS set in scripts/check-css-tokens.mjs\n" +
      "      if it is set via JavaScript at runtime.\n",
  );
  return 1;
}

process.exit(main());
