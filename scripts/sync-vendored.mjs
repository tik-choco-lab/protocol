#!/usr/bin/env node
// tik-choco vendored reference-file sync
//
// Copies the canonical reference modules under
// protocol/docs/data-contracts/reference/ (sharedBus.ts/js, appManifest.ts/js,
// llmConfig.ts/js, mistSignaling.ts/js) out to each app's vendored copy,
// substituting the per-app APP_NAME placeholder in sharedBus (appManifest,
// llmConfig, and mistSignaling have no per-app placeholder — they're
// byte-identical everywhere). This replaces
// hand-copying those files between app repos on every edit — apps still have
// zero *runtime* dependency on this protocol repo (nothing here is imported
// at build/run time; the files are just source-copied).
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
// Each entry declares per-file flags: `sharedBus`, `appManifest`,
// `llmConfig`, `mistSignaling`. `sharedBus: false` (tc-vrm-viewer, tc-vrsns2,
// tc-mistllm) means: that app doesn't carry the shared bus (yet).
// `appManifest: false` means: don't touch that file for this app — used when
// an app's manifest implementation is hand-written/diverged and syncing
// would clobber or duplicate it. `llmConfig: true` opts an app into the
// shared LLM/TTS/STT connection config
// (protocol/docs/data-contracts/docs/llm-config.md); llmConfig has no
// per-app placeholder, so it defaults to false and must be enabled
// explicitly per app. `mistSignaling: true` opts an app into the shared
// Nostr signaling namespace config
// (protocol/docs/data-contracts/docs/mist-signaling.md) — only apps that
// actually construct a mistlib `MistNode` need it; like llmConfig it has no
// per-app placeholder. tc-storage and tc-vrm-viewer don't use the mistlib
// web wrapper at all (they call the wasm module directly from a different
// vendor directory), so they stay `mistSignaling: false` and are handled
// separately, not through this contract.
const APPS = [
  { name: 'tc-note', dir: 'src/lib', lang: 'ts', sharedBus: true, appManifest: true, llmConfig: true, mistSignaling: true },
  { name: 'tc-storage', dir: 'src/storage', lang: 'ts', sharedBus: true, appManifest: true, llmConfig: false, mistSignaling: false },
  { name: 'tc-pdf-viewer', dir: 'src/services', lang: 'js', sharedBus: true, appManifest: true, llmConfig: true, mistSignaling: false },
  { name: 'tc-translate', dir: 'src/lib', lang: 'ts', sharedBus: true, appManifest: true, llmConfig: true, mistSignaling: true },
  { name: 'tc-chat', dir: 'src/lib', lang: 'ts', sharedBus: true, appManifest: true, llmConfig: false, mistSignaling: true },
  { name: 'tc-news', dir: 'src/lib', lang: 'ts', sharedBus: true, appManifest: true, llmConfig: true, mistSignaling: true },
  { name: 'tc-town', dir: 'src/lib', lang: 'ts', sharedBus: true, appManifest: true, llmConfig: true, mistSignaling: true },
  { name: 'tc-travel', dir: 'src/lib/drive', lang: 'ts', sharedBus: true, appManifest: true, llmConfig: true, mistSignaling: true },
  { name: 'tc-vrm-viewer', dir: 'src/lib', lang: 'ts', sharedBus: false, appManifest: true, llmConfig: false, mistSignaling: false },
  { name: 'tc-vrsns2', dir: 'src/lib', lang: 'ts', sharedBus: false, appManifest: true, llmConfig: false, mistSignaling: true },
  // tc-mistllm's src/lib/appManifest.ts is already a byte-identical copy of
  // the reference (written by hand before this app was added to this table),
  // so vendoring it is a safe no-op — not "hand-written/diverged", just
  // previously unmanaged. It doesn't carry sharedBus yet.
  { name: 'tc-mistllm', dir: 'src/lib', lang: 'ts', sharedBus: false, appManifest: true, llmConfig: true, mistSignaling: true },
  { name: 'tc-books', dir: 'src/lib', lang: 'ts', sharedBus: true, appManifest: true, llmConfig: true, mistSignaling: true },
  { name: 'tc-lingo', dir: 'src/lib', lang: 'ts', sharedBus: true, appManifest: true, llmConfig: true, mistSignaling: true },
  // tc-presenter's copies predate this script. The divergence is now understood:
  //   sharedBus   — was only the missing "tc-presenter" entry in SharedAppName,
  //                 fixed in the reference, so this one is synced normally.
  //   appManifest — identical apart from semicolons; tc-presenter's source style
  //                 omits them, and syncing would fight that for no gain.
  //   llmConfig   — genuinely diverged: it writes through this app's own
  //                 ./safeStorage instead of localStorage directly. Syncing would
  //                 silently revert that, so it stays opt-out until safeSetItem
  //                 either lands in the reference or is dropped here.
  { name: 'tc-presenter', dir: 'src/lib', lang: 'ts', sharedBus: true, appManifest: false, llmConfig: false, mistSignaling: true },
  // tc-home takes no other contract module — it only needs the shared signaling
  // namespace so its node lands in the same one as its siblings.
  { name: 'tc-home', dir: 'src/lib', lang: 'ts', sharedBus: false, appManifest: false, llmConfig: false, mistSignaling: true },
];
const APP_BY_NAME = new Map(APPS.map((a) => [a.name, a]));

function usageAndExit(code) {
  console.log('Usage: node protocol/scripts/sync-vendored.mjs <app...|all> [--check]\n');
  console.log('Known apps:');
  for (const a of APPS) {
    const files = ['appManifest', 'sharedBus', 'llmConfig', 'mistSignaling'].filter((f) => a[f]);
    console.log(`  ${a.name.padEnd(16)} ${a.dir.padEnd(16)} (${a.lang})  ${files.join(' + ') || '(none)'}`);
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

  const fileCount = ['sharedBus', 'appManifest', 'llmConfig', 'mistSignaling'].filter((f) => app[f]).length;

  const appDir = path.join(WORKSPACE, app.name);
  console.log(`${app.name}:`);
  if (!fs.existsSync(appDir)) {
    console.log(`  [missing]   app directory not found: ${path.relative(WORKSPACE, appDir)} — skipping`);
    anyDiff = true;
    summary.push({ app: app.name, changed: 0, missing: fileCount, unchanged: 0 });
    continue;
  }

  const targetDir = path.join(appDir, app.dir);
  if (!fs.existsSync(targetDir)) {
    console.log(`  [missing]   target dir not found: ${path.relative(WORKSPACE, targetDir)} — skipping`);
    anyDiff = true;
    summary.push({ app: app.name, changed: 0, missing: fileCount, unchanged: 0 });
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

  if (app.appManifest) {
    const r = syncOneFile({
      appDir,
      appName: app.name,
      targetDir,
      baseName: 'appManifest',
      lang: app.lang,
      substitutePlaceholder: false,
    });
    counts[r.status] += 1;
  }

  if (app.llmConfig) {
    const r = syncOneFile({
      appDir,
      appName: app.name,
      targetDir,
      baseName: 'llmConfig',
      lang: app.lang,
      substitutePlaceholder: false,
    });
    counts[r.status] += 1;
  }

  if (app.mistSignaling) {
    const r = syncOneFile({
      appDir,
      appName: app.name,
      targetDir,
      baseName: 'mistSignaling',
      lang: app.lang,
      substitutePlaceholder: false,
    });
    counts[r.status] += 1;
  }

  if (counts.changed > 0 || counts.missing > 0) anyDiff = true;
  summary.push({ app: app.name, ...counts });
}

console.log('\nSummary:');
for (const s of summary) {
  console.log(`  ${s.app.padEnd(16)} changed=${s.changed} missing=${s.missing} unchanged=${s.unchanged}`);
}

if (checkOnly && anyDiff) process.exit(1);
