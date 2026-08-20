#!/usr/bin/env node
/**
 * Fails with a non-zero exit code if a feature directory contains a raw hex color or a raw
 * rgb()/rgba()/hsl() literal. Owned by Agent 1, wired into `npm run lint` (see package.json) so it
 * runs on every CI lint pass, not just when someone remembers to run it directly. See
 * docs/contracts/design.md "V3: dual-theme glass": every component consumes semantic tokens only,
 * a hardcoded hex or a light-only style is a build error.
 *
 * Scans src/app and src/components, excluding the directories Agent 1 owns (styles/, the ui/
 * illustration/ layout/ primitive libraries, tailwind.config.ts) where token values and their few
 * intentional literal colors (e.g. the toggle thumb's fixed white knob) legitimately live.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/app", "src/components"];
const OWNED_PREFIXES = [
  "src/components/ui",
  "src/components/layout",
  "src/components/illustration",
  "src/styles",
];
/**
 * Exact files that structurally cannot consume a CSS custom property, so a literal color there is
 * correct code, not migration debt: @vercel/og's satori renderer and the OG/PWA-icon route
 * handlers only understand literal values (no DOM, no stylesheet), web app manifests are static
 * JSON per spec, and print stylesheets intentionally strip to plain black/white (see that file's
 * own header comment). Flagged by Agent 5 in docs/contracts/requests.md before `check:colors` gets
 * wired into `npm run lint`, so this list exists before that switch flips, not after. Exact paths
 * only, deliberately not a directory prefix: a new file under `src/app/api/og/` that CAN read a
 * token later should not silently inherit an exemption it doesn't need.
 */
const EXEMPT_FILES = new Set([
  "src/app/api/og/[token]/route.tsx",
  "src/app/apple-icon.tsx",
  "src/app/icon-192.png/route.tsx",
  "src/app/icon-512.png/route.tsx",
  "src/app/manifest.ts",
  "src/components/public/print.css",
]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".next", ".git"]);
const SCANNABLE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

const HEX_PATTERN = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RGB_FUNCTION_PATTERN = /\b(?:rgba?|hsla?)\(\s*\d/g;

/** A short allowlist of non-color hex-ish false positives (git SHAs in comments, etc.) is
 * deliberately NOT here: if a match fires on a real false positive, fix the source line to not
 * look like a color literal (e.g. wrap a SHA in backticks on its own line) rather than growing
 * this script's exception list, which is exactly how such lists rot. */

function isOwnedPath(relPath) {
  return OWNED_PREFIXES.some((prefix) => relPath === prefix || relPath.startsWith(`${prefix}/`));
}

function walk(dir, results) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, results);
      continue;
    }
    results.push(fullPath);
  }
}

function main() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    const abs = join(ROOT, dir);
    try {
      walk(abs, files);
    } catch {
      continue;
    }
  }

  const violations = [];

  for (const file of files) {
    const relPath = relative(ROOT, file).split("\\").join("/");
    if (isOwnedPath(relPath) || EXEMPT_FILES.has(relPath)) continue;
    const ext = relPath.slice(relPath.lastIndexOf("."));
    if (!SCANNABLE_EXTENSIONS.has(ext)) continue;

    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const hexMatches = line.match(HEX_PATTERN);
      const rgbMatches = line.match(RGB_FUNCTION_PATTERN);
      if (!hexMatches && !rgbMatches) return;
      violations.push({ file: relPath, line: index + 1, text: line.trim() });
    });
  }

  if (violations.length === 0) {
    console.log("check-hardcoded-colors: no raw hex/rgb literals found outside the design system.");
    return;
  }

  console.error(`check-hardcoded-colors: ${violations.length} raw color literal(s) found in feature directories.`);
  console.error("Consume a semantic token from src/styles/tokens.css via Tailwind instead (see docs/contracts/design.md).\n");
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}  ${violation.text}`);
  }
  process.exitCode = 1;
}

main();
