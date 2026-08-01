#!/usr/bin/env node
// tik-choco protocol — static site index generator
//
// Scans the repository's published content and writes `site-index.json` at the
// repo root. `index.html` fetches that file to build its navigation, its
// cross-app key catalog, and its search index — the site stays a single static
// page with no bundler, and GitHub Pages keeps serving the repo verbatim
// (see .github/workflows/deploy-pages.yml, which rsyncs the whole tree).
//
// What gets indexed:
//   docs/data-contracts/docs/*.md       -> cross-app contract specs
//   docs/data-contracts/docs/keys/*.md  -> per-app localStorage key catalogs
//                                          (the first GFM table of each file is
//                                          parsed into structured key rows)
//   docs/data-contracts/reference/*     -> canonical reference implementations
//   docs/data-contracts/types/*.d.ts    -> reference type definitions
//   output/strict/manifest.json         -> binary packet definitions
//
// Run after editing any of the above:
//
//   node scripts/gen-site-index.mjs [--check]
//
// `--check` reports whether site-index.json is stale without writing, and
// exits 1 if it is — suitable for CI.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTRACTS_DIR = path.join(ROOT, 'docs', 'data-contracts', 'docs');
const KEYS_DIR = path.join(CONTRACTS_DIR, 'keys');
const REFERENCE_DIR = path.join(ROOT, 'docs', 'data-contracts', 'reference');
const TYPES_DIR = path.join(ROOT, 'docs', 'data-contracts', 'types');
const MANIFEST = path.join(ROOT, 'output', 'strict', 'manifest.json');
const OUT = path.join(ROOT, 'site-index.json');

const checkOnly = process.argv.includes('--check');

/** Repo-relative, forward-slashed path — used as the id/URL of every entry. */
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const listFiles = (dir, filter) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => fs.statSync(path.join(dir, f)).isFile() && filter(f))
        .sort()
    : [];

/**
 * Strip inline Markdown down to plain text, for summaries and search.
 * Link text is kept, the target dropped; code fences never reach here.
 *
 * Underscores are deliberately left alone: nothing in these docs uses `_` for
 * emphasis, while key names (`mist_ocr_markdown_index`) and filenames
 * (`SHARED_BUS.md`) are full of them.
 */
function plain(md) {
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/\\\|/g, '|')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First `# ` heading, or the filename as a fallback. */
function title(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? plain(m[1]) : fallback;
}

/**
 * First prose paragraph after the H1. Non-prose blocks (tables, code fences,
 * lists, quotes, headings) are skipped *whole* — up to the next blank line —
 * rather than line by line, so a continuation line of a bullet can never be
 * mistaken for the opening sentence. Docs that go straight from the H1 into
 * sections (conventions.md) legitimately yield an empty summary.
 */
function summary(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^#\s+/.test(l));
  const buf = [];
  let inFence = false;
  let skippingBlock = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      skippingBlock = inFence;
      continue;
    }
    if (inFence) continue;
    if (/^\s*$/.test(line)) {
      if (buf.length) break;
      skippingBlock = false;
      continue;
    }
    if (skippingBlock) continue;
    if (/^\s*(#|\||[-*+]\s|\d+\.\s|>)/.test(line)) {
      if (buf.length) break;
      // Swallow the rest of this block, including its wrapped lines.
      skippingBlock = true;
      continue;
    }
    buf.push(line.trim());
  }
  const text = plain(buf.join(' '));
  return text.length > 260 ? `${text.slice(0, 259)}…` : text;
}

/**
 * Split one GFM table row into cells. Pipes inside cell text are escaped as
 * `\|` in these docs (schemas are full of TypeScript unions), so the split
 * must ignore escaped pipes and unescape them afterwards.
 */
function splitRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));
}

/**
 * Parse the first GFM table of a keys doc into structured rows. The catalogs
 * all share the `キー | スキーマ | 書き手 | 読み手 | 出典` header; anything
 * else (the per-schema tables further down each file) is ignored.
 */
function parseKeyTable(md) {
  const lines = md.split('\n');
  const header = lines.findIndex((l) => /^\|\s*キー\s*\|/.test(l));
  if (header === -1) return [];
  const rows = [];
  // header + 1 is the `|---|---|` separator.
  for (let i = header + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) break;
    const cells = splitRow(line);
    if (cells.length < 4) continue;
    const [key, schema, writers, readers, source] = cells;
    rows.push({
      key: plain(key),
      schema: plain(schema),
      // A bold app name marks a cross-app reader/writer; the plain-text pass
      // drops the emphasis, so `shared` is derived before it is applied.
      writers: splitApps(writers),
      readers: splitApps(readers),
      source: plain(source ?? ''),
      crossApp: /\*\*/.test(writers) || /\*\*/.test(readers),
    });
  }
  return rows;
}

/**
 * Split a writers/readers cell into app names. Parenthetical notes are removed
 * *before* splitting — they frequently contain their own commas
 * (`tc-note (読み取り専用、フォールバック)`), which would otherwise be torn
 * into bogus app names.
 */
function splitApps(cell) {
  return plain(cell ?? '')
    .replace(/[(（][^)）]*[)）]/g, '')
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const contracts = listFiles(CONTRACTS_DIR, (f) => f.endsWith('.md')).map((f) => {
  const md = read(path.join(CONTRACTS_DIR, f));
  return {
    path: rel(path.join(CONTRACTS_DIR, f)),
    slug: f.replace(/\.md$/, ''),
    title: title(md, f),
    summary: summary(md),
  };
});

const apps = listFiles(KEYS_DIR, (f) => f.endsWith('.md')).map((f) => {
  const md = read(path.join(KEYS_DIR, f));
  const app = f.replace(/\.md$/, '');
  return {
    app,
    path: rel(path.join(KEYS_DIR, f)),
    title: title(md, f),
    summary: summary(md),
    keys: parseKeyTable(md),
  };
});

const reference = listFiles(REFERENCE_DIR, (f) => /\.(ts|js)$/.test(f)).map((f) => ({
  path: rel(path.join(REFERENCE_DIR, f)),
  name: f.replace(/\.(ts|js)$/, ''),
  lang: f.endsWith('.ts') ? 'ts' : 'js',
}));

const types = listFiles(TYPES_DIR, (f) => f.endsWith('.d.ts')).map((f) => ({
  path: rel(path.join(TYPES_DIR, f)),
  app: f.replace(/\.d\.ts$/, ''),
}));

const protocols = fs.existsSync(MANIFEST) ? JSON.parse(read(MANIFEST)).protocols ?? [] : [];

const index = {
  // Regenerate with `node scripts/gen-site-index.mjs` after editing docs.
  generator: 'scripts/gen-site-index.mjs',
  repo: 'https://github.com/tik-choco-lab/protocol',
  contracts,
  apps,
  reference,
  types,
  protocols,
};

const json = `${JSON.stringify(index, null, 2)}\n`;
const current = fs.existsSync(OUT) ? read(OUT) : null;

if (checkOnly) {
  if (current === json) {
    console.log('site-index.json is up to date');
    process.exit(0);
  }
  console.error('site-index.json is stale — run: node scripts/gen-site-index.mjs');
  process.exit(1);
}

if (current === json) {
  console.log('site-index.json unchanged');
} else {
  fs.writeFileSync(OUT, json);
  const keyCount = apps.reduce((n, a) => n + a.keys.length, 0);
  console.log(
    `wrote site-index.json — ${contracts.length} contracts, ${apps.length} apps, ` +
      `${keyCount} keys, ${reference.length} reference files, ${types.length} types, ` +
      `${protocols.length} protocols`
  );
}
