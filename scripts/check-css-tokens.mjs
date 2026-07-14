#!/usr/bin/env node
/**
 * scripts/check-css-tokens.mjs
 *
 * CI guard that checks two things:
 *
 *   1. CSS custom properties: every `var(--token-name)` reference has a
 *      corresponding `--token-name: value` definition (no undefined refs,
 *      no unused definitions).
 *
 *   2. CSS class names: every static `className="foo"` or static part of a
 *      template-literal className in TSX/TS files has a matching `.foo`
 *      selector somewhere in the stylesheet bundle (no orphaned classes).
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
const COMPONENTS_DIR = resolve(__dirname, "../apps/web/src");

// ---------------------------------------------------------------------------
// Allowlists — tokens
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
// Allowlist — class names
// ---------------------------------------------------------------------------

/**
 * CSS class names that are used in component files but NOT defined in any
 * stylesheet.  Most state modifiers (`.active`, `.selected`, `.pass`, etc.)
 * are already defined via compound selectors in CSS (e.g.
 * `.option-card.selected`) so they are picked up automatically.  Only add
 * entries here when a class is genuinely not written in CSS.
 *
 * The entries below are component-wrapper identifiers used alongside a base
 * class like `.panel` or `.card` — the specific suffix is for DOM selection /
 * future use only and has no CSS rules of its own.
 *
 * DO NOT add classes here to silence the linter — add CSS instead.
 */
const CLASSNAME_ALLOWLIST = new Set([
  // Panel wrappers: used as className="panel {noun}-panel"
  "attack-panel",
  "auditor-panel",
  "lifecycle-panel",
  "mainnet-proof-panel",
  "cap-panel",
  "passkey-panel",
  "settlement-panel",
  "receipt-input",
  "receipt-explorer-section",

  // Card wrappers: used as className="card {noun}-card"
  "bidder-progress-card",
  "keeper-status-card",
  "round-status-card",
  "settlement-card",

  // Drand page card wrappers
  "drand-chain-card",
  "drand-search-card",
  "drand-history-card",

  // Table variant identifier
  "table-x402",
]);

// ---------------------------------------------------------------------------
// Helpers — tokens (from original script)
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
// Helpers — class names
// ---------------------------------------------------------------------------

/**
 * Regex to match CSS class definitions: `.classname` in selectors.
 * Requires the class name to start with a letter (avoids matching `.5rem`).
 */
const CSS_CLASS_RE = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;

/** Regex to match static className string literals: className="foo bar". */
const STATIC_CLASS_RE = /className="([^"]+)"/g;

/** Regex to match template-literal className: className={`foo ${x} bar`}. */
const TEMPLATE_CLASS_RE = /className={`([^`]*)`}/g;

/**
 * Regex to match className JSX expressions that are NOT template literals:
 * className={cond ? "a" : "b"}.
 */
const EXPR_CLASS_RE = /className=\{([^}]+)\}/g;

// ---------------------------------------------------------------------------
// Extraction: CSS custom property definitions (from original script)
// ---------------------------------------------------------------------------

/**
 * Extract all `--name:` definitions with their line numbers.
 * Scans line-by-line for accurate line reporting.
 */
function extractDefinitionsByLine(cssText) {
  const defs = [];
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
// Extraction: var() references (from original script)
// ---------------------------------------------------------------------------

/**
 * Extract all `var(--name)` references with their line numbers.
 * Scans line-by-line for accurate line reporting.
 */
function extractReferencesByLine(cssText) {
  const refs = [];
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
// Extraction: CSS class definitions
// ---------------------------------------------------------------------------

/**
 * Strip CSS comments from text so we don't extract classes from them.
 */
function stripComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Extract all `.classname` definitions from CSS text.
 * Returns a Set of unique class names.
 */
function extractCSSClasses(cssText) {
  const stripped = stripComments(cssText);
  const classes = new Set();
  CSS_CLASS_RE.lastIndex = 0;
  for (const m of stripped.matchAll(CSS_CLASS_RE)) {
    classes.add(m[1]);
  }
  return classes;
}

// ---------------------------------------------------------------------------
// Extraction: className references from component files
// ---------------------------------------------------------------------------

/**
 * Extract static class names from a "className" string value.
 * Splits on whitespace, filters empty strings.
 */
function splitClasses(str) {
  return str.split(/\s+/).filter((c) => c.length > 0);
}

/**
 * Extract static class names from a component file's text content.
 *
 * Handles three patterns:
 *   1. `className="foo bar"` — static string literals
 *   2. `className={\`foo \${x} bar\`}` — template literals (static parts only)
 *   3. `className={cond ? "a" : "b"}` — expression string literals
 *
 * Returns an array of { name, line } objects.
 */
function extractComponentClasses(text) {
  const results = [];
  const lines = text.split("\n");

  function extractFromLine(line, lineNum) {
    // Pattern 1: static className="..."
    STATIC_CLASS_RE.lastIndex = 0;
    for (const m of line.matchAll(STATIC_CLASS_RE)) {
      for (const cls of splitClasses(m[1])) {
        results.push({ name: cls, line: lineNum });
      }
    }

    // Pattern 2: template literal className={`...`}
    TEMPLATE_CLASS_RE.lastIndex = 0;
    for (const m of line.matchAll(TEMPLATE_CLASS_RE)) {
      const template = m[1];
      // Replace interpolations with empty string to extract static parts
      const staticParts = template.replace(/\$\{[^}]*\}/g, " ");
      for (const cls of splitClasses(staticParts)) {
        // Filter out names that look like incomplete prefixes (end with - or _)
        if (/[a-zA-Z0-9]$/.test(cls)) {
          results.push({ name: cls, line: lineNum });
        }
      }
    }

    // Pattern 3: expression className={...} NOT containing backticks
    // (backtick = template literal, already handled above).
    //
    // For ternaries (cond ? "result1" : "result2"), we only want the
    // result-branch strings, not comparison values like `"live"` in
    // className={mode === "live" ? "active" : ""}.
    if (line.includes("className={") && !line.includes("`")) {
      EXPR_CLASS_RE.lastIndex = 0;
      for (const m of line.matchAll(EXPR_CLASS_RE)) {
        const expr = m[1];

        // If the expression contains `?`, only extract strings from
        // the result branches (after the first `?`).
        const qPos = expr.indexOf("?");
        if (qPos !== -1) {
          const afterQ = expr.slice(qPos + 1);
          const strRe = /"([^"]+)"/g;
          for (const sm of afterQ.matchAll(strRe)) {
            for (const cls of splitClasses(sm[1])) {
              results.push({ name: cls, line: lineNum });
            }
          }
        } else {
          // No ternary — extract all double-quoted strings.
          // This covers patterns like className={"static-class"}
          // or className={someVar || "fallback"}.
          const strRe = /"([^"]+)"/g;
          for (const sm of expr.matchAll(strRe)) {
            for (const cls of splitClasses(sm[1])) {
              results.push({ name: cls, line: lineNum });
            }
          }
        }
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    extractFromLine(lines[i], i + 1);
  }

  return results;
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
  }
  return results;
}

/** Walk a directory recursively but skip common directories. */
function walkComponents(dir, predicate) {
  const SKIP = new Set(["node_modules", "dist", ".git", "__pycache__"]);
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        results.push(...walkComponents(full, predicate));
      } else if (predicate(entry)) {
        results.push(full);
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------

/**
 * Style an issue list for console output.
 *
 * @param {string} label
 * @param {[file: string, items: { name: string; line: number }[]][]} grouped
 */
function printGrouped(label, grouped) {
  console.error(`\n  ${label}:\n`);
  for (const [file, items] of grouped) {
    console.error(`    ${file}`);
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

  // =====================================================================
  // PART 1: CSS custom property validation (from original script)
  // =====================================================================

  let exitCode = 0;

  if (cssFiles.length === 0) {
    console.log(`  [SKIP] No CSS files found in ${STYLES_DIR}`);
  } else {
    console.log(`\nCSS custom property lint for ${STYLES_DIR}`);
    console.log(`  ${cssFiles.length} CSS files found`);
    console.log("=".repeat(72));

    const definitionRegistry = new Map();
    const referenceRegistry = new Map();

    for (const file of cssFiles) {
      const cssText = readFileSync(file, "utf8");

      for (const { name, line } of extractDefinitionsByLine(cssText)) {
        const list = definitionRegistry.get(name);
        if (list) list.push({ file, line });
        else definitionRegistry.set(name, [{ file, line }]);
      }

      for (const { name, line } of extractReferencesByLine(cssText)) {
        const list = referenceRegistry.get(name);
        if (list) list.push({ file, line });
        else referenceRegistry.set(name, [{ file, line }]);
      }
    }

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

    const undefinedFailures = [];
    for (const [name, locations] of referenceRegistry) {
      if (!definitionRegistry.has(name)) {
        for (const { file, line } of locations) {
          undefinedFailures.push({ name, file, line });
        }
      }
    }

    const unusedDefinitions = [];
    for (const [name, locations] of definitionRegistry) {
      if (DYNAMIC_TOKENS.has(name)) continue;
      if (INTENTIONALLY_UNUSED.has(name)) continue;
      if (!referenceRegistry.has(name)) {
        for (const { file, line } of locations) {
          unusedDefinitions.push({ name, file, line });
        }
      }
    }

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

    if (undefinedFailures.length > 0) {
      exitCode = 1;
      printGrouped(
        `Undefined token references (${undefinedFailures.length})`,
        undefinedByFile,
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
      );
      console.error(
        "  Either:\n" +
          "    - delete the unused definition from the CSS file, or\n" +
          "    - add it to INTENTIONALLY_UNUSED in scripts/check-css-tokens.mjs\n" +
          "      with a comment explaining why it is needed.\n",
      );
    }

    if (undefinedFailures.length === 0 && unusedDefinitions.length === 0) {
      console.log(`\n  [PASS] All token checks passed.\n`);
    }
  }

  // =====================================================================
  // PART 2: CSS class name validation (new)
  // =====================================================================

  console.log(`\nCSS class name lint for ${COMPONENTS_DIR}`);
  console.log("=".repeat(72));

  // Phase 4: collect all CSS class definitions from stylesheets
  const cssClassDefs = new Set();
  for (const file of cssFiles) {
    const cssText = readFileSync(file, "utf8");
    const fileClasses = extractCSSClasses(cssText);
    for (const cls of fileClasses) {
      cssClassDefs.add(cls);
    }
  }
  console.log(`  CSS class definitions found   : ${cssClassDefs.size}`);

  // Phase 5: scan component files for className references
  const componentFiles = walkComponents(COMPONENTS_DIR, (name) =>
    (name.endsWith(".tsx") || name.endsWith(".ts")) &&
    !name.endsWith(".test.ts") &&
    !name.endsWith(".test.tsx") &&
    !name.endsWith(".spec.ts") &&
    !name.endsWith(".spec.tsx"),
  ).sort();

  console.log(`  Component files scanned       : ${componentFiles.length}`);

  /** @type {{ name: string; file: string; line: number }[]} */
  const orphanedClasses = [];

  for (const file of componentFiles) {
    const text = readFileSync(file, "utf8");
    const refs = extractComponentClasses(text);

    for (const { name, line } of refs) {
      if (cssClassDefs.has(name)) continue;
      if (CLASSNAME_ALLOWLIST.has(name)) continue;
      if (!/[a-zA-Z0-9]$/.test(name)) continue;
      if (/^\d+$/.test(name)) continue;
      if (/^(center|flex|grid|block|inline|none|auto|initial|inherit|unset|left|right|top|bottom|middle|baseline|stretch|nowrap|wrap|hidden|visible|scroll|absolute|relative|fixed|static|pointer|cursor|default|text|contain|cover|fill|fit|clip|ellipsis)$/.test(name)) continue;

      orphanedClasses.push({ name, file, line });
    }
  }

  // Phase 6: group by file & report
  const orphanedByFile = new Map();
  for (const { name, file, line } of orphanedClasses) {
    const list = orphanedByFile.get(file);
    if (list) list.push({ name, line });
    else orphanedByFile.set(file, [{ name, line }]);
  }

  if (orphanedClasses.length === 0) {
    console.log(`\n  [PASS] All className references match CSS definitions.\n`);
  } else {
    exitCode = 1;
    printGrouped(
      `Orphaned className references (${orphanedClasses.length})`,
      orphanedByFile,
    );
    console.error(
      "  Either:\n" +
        "    - add the missing CSS class definition to the appropriate stylesheet, or\n" +
        "    - add the class name to CLASSNAME_ALLOWLIST in\n" +
        "      scripts/check-css-tokens.mjs if it is intentionally dynamic.\n",
    );
  }

  // =====================================================================
  // Summary
  // =====================================================================

  if (exitCode === 0) {
    console.log(`\n  [PASS] All checks passed.\n`);
  }

  return exitCode;
}

process.exit(main());
