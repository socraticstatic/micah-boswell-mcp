// GET /healthz (vercel.json rewrites /healthz here). Liveness plus data vintage.
import { facts, VERSION } from '../lib/data.js';

export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ status: 'ok', server: 'micah-boswell-mcp', version: VERSION, dataUpdated: facts.lastUpdated }));
}
