// The registry card (server.json) and everything that must agree with it.
// Two copies exist on purpose: the root one is what `mcp-publisher publish`
// reads, the public/ one is what Vercel serves. They must be identical, and
// the version in them must be the version the live server reports.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, SITE } from '../lib/data.js';
import { createDevServer } from '../scripts/dev.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));
const card = readJson('server.json');

describe('server.json registry card', () => {
  it('root and public copies are identical', () => {
    expect(readJson('public/server.json')).toEqual(card);
  });
  it('one version everywhere: server.json, package.json, lib/data.js', () => {
    expect(card.version).toBe(VERSION);
    expect(readJson('package.json').version).toBe(VERSION);
  });
  it('fits the registry limits and names the right remote', () => {
    expect(card.name).toBe('io.github.socraticstatic/micah-boswell');
    expect(card.description.length).toBeLessThanOrEqual(100);
    expect(card.title.length).toBeLessThanOrEqual(100);
    expect(card.remotes).toEqual([{ type: 'streamable-http', url: `${SITE}/mcp` }]);
    expect(card.websiteUrl).toBe(`${SITE}/`);
  });
  it('declares https icons that this site actually serves', () => {
    expect(Array.isArray(card.icons) && card.icons.length > 0).toBe(true);
    for (const icon of card.icons) {
      expect(icon.src.startsWith(`${SITE}/`)).toBe(true);
      expect(['image/png', 'image/svg+xml']).toContain(icon.mimeType);
      const rel = icon.src.slice(SITE.length + 1);
      expect(existsSync(path.join(ROOT, 'public', rel)), `public/${rel} missing`).toBe(true);
    }
  });
});

describe('discovery document (.well-known)', () => {
  let srv, base;
  beforeAll(async () => {
    srv = createDevServer();
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${srv.address().port}`;
  });
  afterAll(() => new Promise((r) => srv.close(r)));

  it('vercel.json rewrites both well-known paths to the card', () => {
    const rewrites = readJson('vercel.json').rewrites;
    for (const p of ['/.well-known/mcp', '/.well-known/mcp/server-card.json']) {
      expect(rewrites.find((r) => r.source === p)?.destination).toBe('/server.json');
    }
  });
  it('the dev server mirrors them and serves the card as JSON', async () => {
    for (const p of ['/.well-known/mcp', '/.well-known/mcp/server-card.json']) {
      const r = await fetch(`${base}${p}`);
      expect(r.status, p).toBe(200);
      expect(r.headers.get('content-type')).toContain('application/json');
      expect(await r.json()).toEqual(card);
    }
  });
});
