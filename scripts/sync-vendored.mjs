#!/usr/bin/env node
// tik-choco vendored reference-file sync
//
// Copies the canonical reference modules under
// protocol/docs/data-contracts/reference/ (sharedBus.ts/js, appManifest.ts/js)
// out to each app's vendored copy, substituting the per-app APP_NAME
// placeholder in sharedBus. This replaces hand-copying those files between
// app repos on every edit — apps still have zero *runtime* dependency on this
// protocol repo (nothing here is imported at build/run time; the files are
// just source-copied).
//
// Run from the workspace root that contains this repo (`protocol/`) as a
// sibling of the app checkouts (`tc-note/`, `tc-storage/`, ...):
//
//   node protocol/scripts/sync-vendored.mjs <app...|all> [--check]
//
// `--check` prints a per-file changed/unchanged/missing report without
// writing anything, and exits 1 if any vendored file would change.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOCOL_ROOT = path.resolve(__dirname, '..');
const WORKSPACE = path.resolve(PROTOCOL_ROOT, '..');
const REFERENCE_DIR = path.join(PROTOCOL_ROOT, 'docs', 'data-contracts', 'reference');

const PLACEHOLDER = '__APP_NAME__';

// Which vendored files each app carries, and where. `dir` is relative to the
// app's own repo root. `lang` selects the .ts or .js reference rendering.
// `sharedBus: false` (tc-vrm-viewer) means: vendor appManifest only — that
// app doesn't carry the shared bus yet.
const APPS = [
  { name: 'tc-note', dir: 'src/lib', lang: 'ts', sharedBus: true },
  { name: 'tc-storage', dir: 'src/storage', lang: 'ts', sharedBus: true },
  { name: 'tc-pdf-viewer', dir: 'src/services', lang: 'js', sharedBus: true },
  { name: 'tc-translate', dir: 'src/lib', lang: 'ts', sharedBus: true },
  { name: 'tc-chat', dir: 'src/lib', lang: 'ts', sharedBus: true },
  { name: 'tc-news', dir: 'src/lib', lang: 'ts', sharedBus: true },
  { name: 'tc-town', dir: 'src/lib', lang: 'ts', sharedBus: true },
  { name: 'tc-travel', dir: 'src/lib/drive', lang: 'ts', sharedBus: true },
  { name: 'tc-vrm-viewer', dir: 'src/lib', lang: 'ts', sharedBus: false },
];
const APP_BY_NAME = new Map(APPS.map((a) => [a.name, a]));

function usageAndExit(code) {
  console.log('Usage: node protocol/scripts/sync-vendored.mjs <app...|all> [--check]\n');
  console.log('Known apps:');
  for (const a of APPS) {
    const files = a.sharedBus ? 'sharedBus + appManifest' : 'appManifest only';
    console.log(`  ${a.name.padEnd(16)} ${a.dir.padEnd(16)} (${a.lang})  ${files}`);
  }
  process.exit(code);
}

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const requested = argv.filter((a) => a !== '--check');
if (requested.length === 0) usageAndExit(0);

const targetApps = requested.includes('all') ? APPS.map((a) => a.name) : requested;

function readReference(baseName, lang) {
  const file = path.join(REFERENCE_DIR, `${baseName}.${lang}`);
  return fs.readFileSync(file, 'utf8');
}

// Minimal LCS-based line diff, just to report an added/removed line count per
// changed file (not a full unified diff renderer — the repo has no diff
// dependency and files here are small, so an O(n*m) LCS is plenty fast).
function lineDiffCounts(a, b) {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const n = linesA.length;
  const m = linesB.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = linesA[i] === linesB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lcsLen = dp[0][0];
  return { removed: n - lcsLen, added: m - lcsLen };
}

function syncOneFile({ appDir, appName, targetDir, baseName, lang, substitutePlaceholder }) {
  let content = readReference(baseName, lang);
  if (substitutePlaceholder) content = content.split(PLACEHOLDER).join(appName);

  const targetPath = path.join(targetDir, `${baseName}.${lang}`);
  const exists = fs.existsSync(targetPath);
  const existing = exists ? fs.readFileSync(targetPath, 'utf8') : null;
  const unchanged = exists && existing === content;

  if (checkOnly) {
    const rel = path.relative(WORKSPACE, targetPath);
    if (!exists) {
      console.log(`  [missing]   ${rel}`);
      return { status: 'missing' };
    }
    if (unchanged) {
      console.log(`  [unchanged] ${rel}`);
      return { status: 'unchanged' };
    }
    const { added, removed } = lineDiffCounts(existing, content);
    console.log(`  [changed]   ${rel}  (+${added} -${removed} lines vs. reference)`);
    return { status: 'changed' };
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
  const rel = path.relative(WORKSPACE, targetPath);
  console.log(`  [written]   ${rel}`);
  return { status: unchanged ? 'unchanged' : exists ? 'changed' : 'missing' };
}

let anyDiff = false;
const summary = [];

for (const rawName of targetApps) {
  const app = APP_BY_NAME.get(rawName);
  if (!app) {
    console.error(`Unknown app "${rawName}" — known apps: ${APPS.map((a) => a.name).join(', ')}`);
    anyDiff = true;
    continue;
  }

  const appDir = path.join(WORKSPACE, app.name);
  console.log(`${app.name}:`);
  if (!fs.existsSync(appDir)) {
    console.log(`  [missing]   app directory not found: ${path.relative(WORKSPACE, appDir)} — skipping`);
    anyDiff = true;
    summary.push({ app: app.name, changed: 0, missing: 2, unchanged: 0 });
    continue;
  }

  const targetDir = path.join(appDir, app.dir);
  if (!fs.existsSync(targetDir)) {
    console.log(`  [missing]   target dir not found: ${path.relative(WORKSPACE, targetDir)} — skipping`);
    anyDiff = true;
    summary.push({ app: app.name, changed: 0, missing: app.sharedBus ? 2 : 1, unchanged: 0 });
    continue;
  }

  const counts = { changed: 0, missing: 0, unchanged: 0 };

  if (app.sharedBus) {
    const r = syncOneFile({
      appDir,
      appName: app.name,
      targetDir,
      baseName: 'sharedBus',
      lang: app.lang,
      substitutePlaceholder: true,
    });
    counts[r.status] += 1;
  }

  const r = syncOneFile({
    appDir,
    appName: app.name,
    targetDir,
    baseName: 'appManifest',
    lang: app.lang,
    substitutePlaceholder: false,
  });
  counts[r.status] += 1;

  if (counts.changed > 0 || counts.missing > 0) anyDiff = true;
  summary.push({ app: app.name, ...counts });
}

console.log('\nSummary:');
for (const s of summary) {
  console.log(`  ${s.app.padEnd(16)} changed=${s.changed} missing=${s.missing} unchanged=${s.unchanged}`);
}

if (checkOnly && anyDiff) process.exit(1);
