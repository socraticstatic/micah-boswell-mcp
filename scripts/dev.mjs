// Local stand-in for the Vercel routing: /mcp and /healthz go to the api
// functions, everything else is served from public/. Used by the tests and by
// `npm run dev`.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mcp from '../api/mcp.js';
import healthz from '../api/healthz.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
// Mirrors the rewrites in vercel.json: the discovery document is the card.
const REWRITES = {
  '/.well-known/mcp': '/server.json',
  '/.well-known/mcp/server-card.json': '/server.json',
};

export function createDevServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/mcp') return mcp(req, res);
    if (url.pathname === '/healthz') return healthz(req, res);
    const pathname = REWRITES[url.pathname] || url.pathname;
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.join(PUBLIC, path.normalize(rel));
    if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end('forbidden'); }
    try {
      const body = await readFile(file);
      res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3939);
  createDevServer().listen(port, () => console.log(`micah-boswell-mcp dev: http://localhost:${port}/  (MCP at /mcp)`));
}
