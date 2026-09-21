import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer, TOOL_NAMES } from '../lib/server.js';
import { fetchPoem, extractJsonLd } from '../lib/poem.js';
import { createDevServer } from '../scripts/dev.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function connect() {
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const server = buildServer();
  await server.connect(serverT);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientT);
  return { client, server };
}
const call = async (client, name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  return { raw: r, text: r.content[0].text, json: () => JSON.parse(r.content[0].text) };
};

describe('tool registry', () => {
  it('lists all nine tools and three resources', async () => {
    const { client } = await connect();
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual([...TOOL_NAMES].sort());
    const res = (await client.listResources()).resources.map((r) => r.uri).sort();
    expect(res).toEqual(['micah://facts.json', 'micah://llms-full.txt', 'micah://llms.txt']);
  });
});

describe('tools return non-empty, correct results', () => {
  let client;
  beforeAll(async () => { ({ client } = await connect()); });

  it('about_micah_boswell', async () => {
    const { text } = await call(client, 'about_micah_boswell');
    expect(text).toContain('Micah Boswell is a product design leader in Dallas, Texas');
    expect(text).toContain('Key facts:');
    expect(text).toContain('Lima, Peru');
    expect(text).toContain('https://micahboswell.vercel.app/');
  });
  it('micah_boswell_facts', async () => {
    const f = (await call(client, 'micah_boswell_facts')).json();
    expect(f.name).toBe('Micah Boswell');
    expect(f.identity.role).toBe('Lead Product Designer');
    expect(f.identity.employer).toBe('AT&T');
    expect(f.mentoring.designersMentored).toBe(47);
  });
  it('micah_boswell_profiles', async () => {
    const p = (await call(client, 'micah_boswell_profiles')).json();
    expect(p.profiles.length).toBe(23);
    expect(p.profiles.map((x) => x.url)).toContain('https://www.linkedin.com/in/micahboswell/');
    for (const x of p.profiles) { expect(x.label).toBeTruthy(); expect(x.url).toMatch(/^https:\/\//); }
  });
  it('micah_boswell_work', async () => {
    const w = (await call(client, 'micah_boswell_work')).json();
    expect(w.roles.length).toBe(13);
    expect(w.roles[0]).toMatchObject({ title: 'Lead Product Designer', org: 'AT&T', start: 2021 });
    expect(w.roles[12].start).toBe(1998);
  });
  it('micah_boswell_writing', async () => {
    const w = (await call(client, 'micah_boswell_writing')).json();
    expect(w.essays.length).toBe(3);
    expect(w.poems.length).toBe(29);
    expect(w.poems.find((p) => p.slug === 'dreams').url).toBe('https://conscious-shell.com/poems/dreams');
    expect(w.medium.profile).toBe('https://medium.com/@micahboswell');
  });
  it('micah_boswell_photography respects limit', async () => {
    const p = (await call(client, 'micah_boswell_photography', { limit: 3 })).json();
    expect(p).toMatchObject({ photographs: 104, views: 53380492, downloads: 362001 });
    expect(p.collections.length).toBe(6);
    expect(p.topPhotos.length).toBe(3);
    expect(p.topPhotos[0]).toMatchObject({ title: 'blue and black wooden board', views: 36403140 });
    expect(p.topPhotos[0].url).toMatch(/^https:\/\/unsplash\.com\/photos\//);
    const d = (await call(client, 'micah_boswell_photography')).json();
    expect(d.topPhotos.length).toBe(10);
  });
  it('micah_boswell_faq with and without query', async () => {
    const all = (await call(client, 'micah_boswell_faq')).json();
    expect(all.count).toBe(16);
    const q = (await call(client, 'micah_boswell_faq', { query: 'unsplash' })).json();
    expect(q.count).toBeGreaterThan(0);
    expect(q.results.every((r) => /unsplash/i.test(r.question + r.answer))).toBe(true);
  });
  it('search_micah_boswell returns paragraphs with URLs', async () => {
    const s = (await call(client, 'search_micah_boswell', { query: 'Lima Peru' })).json();
    expect(s.count).toBeGreaterThan(0);
    expect(s.results[0].url).toMatch(/^https:\/\//);
    expect(s.results[0].text.toLowerCase()).toContain('lima');
    const ge = (await call(client, 'search_micah_boswell', { query: 'GE Nuclear', limit: 2 })).json();
    expect(ge.results.length).toBe(2);
  });
  it('resources/read facts.json parses', async () => {
    const r = await client.readResource({ uri: 'micah://facts.json' });
    expect(JSON.parse(r.contents[0].text).name).toBe('Micah Boswell');
    const l = await client.readResource({ uri: 'micah://llms.txt' });
    expect(l.contents[0].text).toContain('# Micah Boswell');
  });
});

describe('micah_boswell_poem (network mocked)', () => {
  const page = (text) => `<html><head><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': ['CreativeWork', 'WebPage'], name: 'Dreams', headline: 'Dreams, a poem by Micah Boswell', url: 'https://conscious-shell.com/poems/dreams', wordCount: 3, text })}</script></head><body></body></html>`;
  const fake = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, text: async () => body });

  it('returns title and text from CreativeWork JSON-LD', async () => {
    const r = await fetchPoem('dreams', { fetchImpl: fake(200, page('Dreams are born\nin those moments')) });
    expect(r).toMatchObject({ title: 'Dreams', url: 'https://conscious-shell.com/poems/dreams', text: 'Dreams are born\nin those moments' });
  });
  it('accepts a full URL and normalizes to the slug', async () => {
    const r = await fetchPoem('https://conscious-shell.com/poems/dreams', { fetchImpl: fake(200, page('x y z')) });
    expect(r.title).toBe('Dreams');
  });
  it('errors clearly on 404 with a hint', async () => {
    const r = await fetchPoem('dream', { fetchImpl: fake(404, ''), known: [{ slug: 'dreams' }] });
    expect(r.error).toContain('No poem at https://conscious-shell.com/poems/dream');
    expect(r.error).toContain('dreams');
  });
  it('rejects a bad slug without fetching', async () => {
    let called = false;
    const r = await fetchPoem('../etc', { fetchImpl: async () => { called = true; } });
    expect(called).toBe(false);
    expect(r.error).toMatch(/Invalid slug/);
  });
  it('errors when no CreativeWork text exists', async () => {
    const r = await fetchPoem('dreams', { fetchImpl: fake(200, '<html><body>no json-ld</body></html>') });
    expect(r.error).toMatch(/no CreativeWork text/);
  });
  it('extractJsonLd tolerates a malformed block', () => {
    expect(extractJsonLd('<script type="application/ld+json">{bad</script>')).toEqual([]);
  });
  it('is surfaced as an MCP error through the server', async () => {
    const { client } = await connect();
    const r = await client.callTool({ name: 'micah_boswell_poem', arguments: { slug: 'not a slug!' } });
    expect(r.isError).toBe(true);
  });
});

describe('HTTP transport (api/mcp.js through the dev server)', () => {
  let srv, base;
  beforeAll(async () => {
    srv = createDevServer();
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${srv.address().port}`;
  });
  afterAll(() => new Promise((r) => srv.close(r)));
  const rpc = (body) => fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) });

  it('initialize negotiates 2025-11-25 and 2025-06-18', async () => {
    for (const v of ['2025-11-25', '2025-06-18']) {
      const r = await rpc({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: v, capabilities: {}, clientInfo: { name: 'test', version: '0' } } });
      expect(r.status).toBe(200);
      const j = await r.json();
      expect(j.result.protocolVersion).toBe(v);
      expect(j.result.serverInfo.name).toBe('micah-boswell');
    }
  });
  it('tools/list and tools/call work statelessly (no session header)', async () => {
    const l = await (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).json();
    expect(l.result.tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    const c = await (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'about_micah_boswell', arguments: {} } })).json();
    expect(c.result.content[0].text).toContain('Micah Boswell');
  });
  it('GET /mcp is refused with 405 and a pointer', async () => {
    const r = await fetch(`${base}/mcp`);
    expect(r.status).toBe(405);
    expect((await r.json()).error.message).toContain('POST');
  });
  it('serves /, /llms.txt, /server.json, /healthz', async () => {
    const home = await (await fetch(`${base}/`)).text();
    expect(home).toContain('<title>Micah Boswell MCP server</title>');
    expect(home).toContain('"@type": "SoftwareApplication"');
    expect(home).toContain('https://micahboswell.vercel.app/#person');
    const llms = await (await fetch(`${base}/llms.txt`)).text();
    expect(llms).toContain('micah-boswell-mcp.vercel.app/mcp');
    const sj = await (await fetch(`${base}/server.json`)).json();
    expect(sj.name).toBe('io.github.socraticstatic/micah-boswell');
    expect(sj.remotes[0]).toEqual({ type: 'streamable-http', url: 'https://micah-boswell-mcp.vercel.app/mcp' });
    const hz = await (await fetch(`${base}/healthz`)).json();
    expect(hz.status).toBe('ok');
  });
});

describe('content rules', () => {
  const FORBIDDEN = [/arrest/i, /Dallas Morning News/i, /What the Article Left Out/i, /Fundamentally Yours/i, /Substack/i, /Goodreads/i, /\(Book\)/, /SustainableUX/i, /\/talks\b/i, /talk video/i, /Haiku/i];
  const files = [];
  for (const dir of ['data', 'public', 'lib', 'api']) {
    for (const f of readdirSync(path.join(ROOT, dir))) files.push(path.join(dir, f));
  }
  files.push('README.md', 'package.json', 'vercel.json');

  it('forbidden strings are absent from bundled data, landing page, and code', () => {
    for (const f of files) {
      const body = readFileSync(path.join(ROOT, f), 'utf8');
      for (const re of FORBIDDEN) expect(body, `${f} matches ${re}`).not.toMatch(re);
    }
  });
  it('no em dashes (U+2014) anywhere', () => {
    for (const f of files) {
      const body = readFileSync(path.join(ROOT, f), 'utf8');
      expect(body.includes('—'), `${f} contains an em dash`).toBe(false);
    }
  });
  it('landing page meta description is 80 to 200 characters and canonical is set', () => {
    const html = readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
    const d = html.match(/name="description" content="([^"]*)"/)[1];
    expect(d.length).toBeGreaterThanOrEqual(80);
    expect(d.length).toBeLessThanOrEqual(200);
    expect(html).toContain('<link rel="canonical" href="https://micah-boswell-mcp.vercel.app/">');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    expect(ld.author).toEqual({ '@type': 'Person', '@id': 'https://micahboswell.vercel.app/#person', name: 'Micah Boswell', url: 'https://micahboswell.vercel.app/' });
  });
});
