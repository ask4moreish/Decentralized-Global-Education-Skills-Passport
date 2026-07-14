#!/usr/bin/env node
/**
 * scripts/check-css-tokens.mjs
 *
 * CI guard that ensures every `var(--token-name)` reference in the web app's
 * CSS files has a corresponding `--token-name: value` declaration somewhere in
 * the stylesheet bundle, AND that every defined token is actually referenced
 * (no dead definitions).
 *
 * The script:
 *   1. Reads all `.css` files under apps/web/src/styles/
 *   2. Builds a registry of all defined custom properties (`--name: …`) with
 *      their originating file and line number
 *   3. Scans every `var(--name)` reference and checks it against the registry
 *   4. Checks every definition against the set of all references to find unused
 *      tokens
 *   5. Exits 0 if all references are valid and no definitions are unused,
 *      1 if any issues are found
 *
 * Tokens set dynamically via JavaScript (e.g. React inline styles) are listed
 * in DYNAMIC_TOKENS below so the check does not flag them as undefined.
 * Tokens that are intentionally defined but not yet consumed (planned API,
 * future feature) go into INTENTIONALLY_UNUSED.
 *
 * Usage (from repo root):
 *   node scripts/check-css-tokens.mjs
 *
 * Exit codes:
 *   0  all checks pass
 *   1  one or more issues found
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = resolve(__dirname, "../apps/web/src/styles");

// ---------------------------------------------------------------------------
// Allowlists
// ---------------------------------------------------------------------------

/**
 * Tokens that are intentionally set at runtime via JavaScript (e.g. React
 * inline styles, scroll-driven animations, etc.) rather than defined in CSS.
 * Add any such tokens here so the CI check does not flag them as undefined
 * references.
 */
const DYNAMIC_TOKENS = new Set([
  "--commit-progress", // Set dynamically in PhaseGuide (DemoPage.tsx) inline style
]);

/**
 * Tokens that are intentionally defined in CSS but not yet consumed by any
 * `var()` reference. Use this for planned API surfaces, future features, or
 * design-token files that other tools consume directly.
 *
 * DO NOT add tokens here to silence the linter — prefer removing dead code.
 */
const INTENTIONALLY_UNUSED = new Set([
  // Palette design tokens — defined for the full color system even if the
  // current UI doesn't reference every grade. Kept so the palette is
  // complete for theming, future use, and design-system documentation.
  "--bg-2",
  "--green-deep",
  "--amber-glow",
  "--violet-glow",
  "--cyan",
  "--cyan-glow",
  "--red-glow",
  "--radius-xl",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Regex to match `--name:` custom property definitions.
 *
 * We match just `--name:` (not the value) because CSS custom property
 * values can span multiple lines (e.g. gradients). The original simple
 * regex is more robust than trying to find the terminating semicolon.
 *
 * The known limitation is that this can match `--name:` inside CSS
 * comments, but the broader check (reference vs. definition) catches
 * false positives since unused comment-definitions would be reported
 * as unused — a distinct, actionable issue.
 */
const DEF_RE = /(--[a-z][a-z0-9_-]*)\s*:/gi;

/** Regex to match `var(--name, fallback)` references (case-insensitive). */
const VAR_RE = /var\(\s*(--[a-z][a-z0-9_-]*)\s*(?:,\s*[^)]*)?\)/gi;

// ---------------------------------------------------------------------------
// Extraction: definitions
// ---------------------------------------------------------------------------

/**
 * Extract all `--name:` definitions with their line numbers.
 * Scans line-by-line for accurate line reporting.
 */
function extractDefinitionsByLine(cssText) {
  const defs = []; // [{ name: string, line: number }]
  const lines = cssText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    DEF_RE.lastIndex = 0;
    for (const m of lines[i].matchAll(DEF_RE)) {
      defs.push({ name: m[1].toLowerCase(), line: i + 1 });
    }
  }
  return defs;
}

// ---------------------------------------------------------------------------
// Extraction: var() references
// ---------------------------------------------------------------------------

/**
 * Extract all `var(--name)` references with their line numbers.
 * Scans line-by-line for accurate line reporting.
 */
function extractReferencesByLine(cssText) {
  const refs = []; // [{ name: string, line: number }]
  const lines = cssText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    VAR_RE.lastIndex = 0;
    for (const m of lines[i].matchAll(VAR_RE)) {
      refs.push({ name: m[1].toLowerCase(), line: i + 1 });
    }
  }
  return refs;
}

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

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

/**
 * Normalise a file path relative to the styles directory for display.
 */
function relPath(file) {
  return file.replace(STYLES_DIR + "/", "");
}

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------

/**
 * Style an issue list for console output.
 *
 * @param {string} label
 * @param {[file: string, items: { name: string; line: number }[]][]} grouped
 * @param {string} prefix  e.g. "undefined" or "unused"
 */
function printGrouped(label, grouped, prefix) {
  console.error(`\n  ${label}:\n`);
  for (const [file, items] of grouped) {
    console.error(`    ${relPath(file)}`);
    for (const { name, line } of items) {
      console.error(`      L${line}  ${name}`);
    }
    console.error("");
  }
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

  // ── Phase 0: scan every file for definitions and references ────────────
  //
  // We collect two registries:
  //   definitions[name] = [{ file, line }]   (all locations)
  //   references[name]  = [{ file, line }]   (all locations)
  //
  // This avoids re-reading files in later phases.

  /** @type {Map<string, { file: string; line: number }[]>} */
  const definitionRegistry = new Map();
  /** @type {Map<string, { file: string; line: number }[]>} */
  const referenceRegistry = new Map();

  for (const file of cssFiles) {
    const cssText = readFileSync(file, "utf8");

    // Definitions
    for (const { name, line } of extractDefinitionsByLine(cssText)) {
      const list = definitionRegistry.get(name);
      if (list) {
        list.push({ file, line });
      } else {
        definitionRegistry.set(name, [{ file, line }]);
      }
    }

    // References
    for (const { name, line } of extractReferencesByLine(cssText)) {
      const list = referenceRegistry.get(name);
      if (list) {
        list.push({ file, line });
      } else {
        referenceRegistry.set(name, [{ file, line }]);
      }
    }
  }

  // Merge DYNAMIC_TOKENS into the definition registry so they're treated
  // as valid definitions for the reference-check phase.
  for (const token of DYNAMIC_TOKENS) {
    if (!definitionRegistry.has(token)) {
      definitionRegistry.set(token, [{ file: "__dynamic__", line: 0 }]);
    }
  }

  const totalDefinitions = definitionRegistry.size;
  const totalReferences = referenceRegistry.size;
  const unusedCount = INTENTIONALLY_UNUSED.size;

  console.log(`\n  Defined tokens               : ${totalDefinitions}`);
  console.log(`  Referenced tokens            : ${totalReferences}`);
  if (DYNAMIC_TOKENS.size > 0) {
    console.log(`  Dynamic (JS-set)             : ${DYNAMIC_TOKENS.size}`);
  }
  if (unusedCount > 0) {
    console.log(`  Intentionally unused         : ${unusedCount}`);
  }
  console.log("=".repeat(72));

  // ── Phase 1: Check for undefined references ───────────────────────────
  // A reference is undefined if its name is NOT in the definition registry.

  const undefinedFailures = []; // [{ name, file, line }]
  for (const [name, locations] of referenceRegistry) {
    if (!definitionRegistry.has(name)) {
      for (const { file, line } of locations) {
        undefinedFailures.push({ name, file, line });
      }
    }
  }

  // ── Phase 2: Check for unused definitions ─────────────────────────────
  // A definition is unused if its name is NOT in the reference registry AND
  // NOT in the INTENTIONALLY_UNUSED set.

  const unusedDefinitions = []; // [{ name, file, line }]
  for (const [name, locations] of definitionRegistry) {
    if (DYNAMIC_TOKENS.has(name)) continue; // dynamic tokens are definition-only
    if (INTENTIONALLY_UNUSED.has(name)) continue;
    if (!referenceRegistry.has(name)) {
      for (const { file, line } of locations) {
        unusedDefinitions.push({ name, file, line });
      }
    }
  }

  // ── Phase 3: Group by file for pretty printing ────────────────────────

  const undefinedByFile = new Map();
  for (const { name, file, line } of undefinedFailures) {
    const list = undefinedByFile.get(file);
    if (list) list.push({ name, line });
    else undefinedByFile.set(file, [{ name, line }]);
  }

  const unusedByFile = new Map();
  for (const { name, file, line } of unusedDefinitions) {
    const list = unusedByFile.get(file);
    if (list) list.push({ name, line });
    else unusedByFile.set(file, [{ name, line }]);
  }

  // ── Phase 4: Report ──────────────────────────────────────────────────

  let exitCode = 0;

  if (undefinedFailures.length === 0 && unusedDefinitions.length === 0) {
    console.log(`\n  [PASS] All checks passed.\n`);
    return 0;
  }

  if (undefinedFailures.length > 0) {
    exitCode = 1;
    printGrouped(
      `Undefined token references (${undefinedFailures.length})`,
      undefinedByFile,
      "undefined",
    );
    console.error(
      "  Either:\n" +
        "    - add the missing token to tokens.css, or\n" +
        "    - add it to the DYNAMIC_TOKENS set in scripts/check-css-tokens.mjs\n" +
        "      if it is set via JavaScript at runtime.\n",
    );
  }

  if (unusedDefinitions.length > 0) {
    exitCode = 1;
    printGrouped(
      `Unused token definitions (${unusedDefinitions.length})`,
      unusedByFile,
      "unused",
    );
    console.error(
      "  Either:\n" +
        "    - delete the unused definition from the CSS file, or\n" +
        "    - add it to INTENTIONALLY_UNUSED in scripts/check-css-tokens.mjs\n" +
        "      with a comment explaining why it is needed.\n",
    );
  }

  return exitCode;
}

process.exit(main());
