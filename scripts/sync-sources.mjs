#!/usr/bin/env node
// Refresh the bundled copies of the two sites' llms files, cut to this server's
// content rules (test/server.test.js, "content rules"): no em dashes, and no
// line or list item that names anything on the forbidden list.
// Usage: node scripts/sync-sources.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = [
  ['https://micahboswell.vercel.app/llms.txt', 'data/llms.txt'],
  ['https://micahboswell.vercel.app/llms-full.txt', 'data/llms-full.txt'],
  ['https://conscious-shell.com/llms.txt', 'data/conscious-shell-llms.txt'],
];
// Keep in step with FORBIDDEN in test/server.test.js. Lives here, not in lib/,
// because the content-rules test reads every file under lib/.
const FORBIDDEN = [/arrest/i, /Dallas Morning News/i, /What the Article Left Out/i, /Fundamentally Yours/i, /Substack/i, /Goodreads/i, /\(Book\)/, /SustainableUX/i, /\/talks\b/i, /talk video/i, /Haiku/i];
// The 2026-10-11 Vercel firewall answers Node's bare "node" UA with 429.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 micah-boswell-mcp-sync';

export function sanitize(text) {
  const lines = text.replace(/ — /g, ' - ').replace(/—/g, '-').replace(/ \(Book\)/g, '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; ) {
    let j = i + 1;
    // A list item owns the indented lines under it.
    if (/^\s*- /.test(lines[i])) while (j < lines.length && /^\s{2,}\S/.test(lines[j]) && !/^\s*- /.test(lines[j])) j++;
    const block = lines.slice(i, j);
    if (!FORBIDDEN.some((re) => re.test(block.join('\n')))) out.push(...block);
    i = j;
  }
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [url, file] of SOURCES) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const body = sanitize(await res.text());
    writeFileSync(path.join(ROOT, file), body);
    console.log(`${file}: ${body.split('\n').length} lines from ${url}`);
  }
}
