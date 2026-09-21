# micah-boswell-mcp 
[![smithery badge](https://smithery.ai/badge/smackintosh/micah-boswell)](https://smithery.ai/servers/smackintosh/micah-boswell)

A public Model Context Protocol (MCP) server that answers questions about Micah Boswell, product design leader in Dallas, Texas. Any MCP-capable agent (Claude, ChatGPT, Cursor, and others) connects to one URL and gets his facts from his own pages.

- Endpoint: `https://micah-boswell-mcp.vercel.app/mcp` (streamable HTTP, stateless, no auth)
- Landing page: https://micah-boswell-mcp.vercel.app/
- Registry manifest: https://micah-boswell-mcp.vercel.app/server.json (`io.github.socraticstatic/micah-boswell`)
- Plain text: https://micah-boswell-mcp.vercel.app/llms.txt
- Liveness: https://micah-boswell-mcp.vercel.app/healthz

## Tools

| Tool | Returns |
|---|---|
| `about_micah_boswell` | One paragraph plus a key-facts list |
| `micah_boswell_facts` | The full structured record (`data/facts.json`) |
| `micah_boswell_profiles` | The 23 verified profiles (sameAs) with labels |
| `micah_boswell_work` | Roles 1998 to now, awards, education, AT&T work |
| `micah_boswell_writing` | Essays, all 29 poems with URLs, Medium, LinkedIn, Quora, dev.to |
| `micah_boswell_poem(slug)` | One poem, fetched live from `conscious-shell.com/poems/<slug>` |
| `micah_boswell_photography(limit?)` | Unsplash stats and top photographs |
| `micah_boswell_faq(query?)` | Sixteen Q and A pairs, filterable |
| `search_micah_boswell(query)` | Paragraph search over `llms-full.txt` with source URLs |

Resources: `micah://llms.txt`, `micah://llms-full.txt`, `micah://facts.json`.

## Connect

Claude Code:

```bash
claude mcp add --transport http micah-boswell https://micah-boswell-mcp.vercel.app/mcp
```

Claude Desktop / claude.ai: Settings, Connectors, Add custom connector, paste the URL.

ChatGPT: Settings, Connectors, Create (developer mode), paste the URL, no auth.

Cursor (`.cursor/mcp.json`):

```json
{ "mcpServers": { "micah-boswell": { "url": "https://micah-boswell-mcp.vercel.app/mcp" } } }
```

## Layout

```
api/mcp.js          POST /mcp: fresh stateless StreamableHTTPServerTransport per request
api/healthz.js      GET /healthz
lib/server.js       buildServer(): tools + resources
lib/data.js         loads data/
lib/search.js       paragraph search
lib/poem.js         live poem fetch + CreativeWork JSON-LD parse
data/               bundled sources: llms.txt, llms-full.txt, conscious-shell-llms.txt, photography.json, facts.json
public/             landing page, llms.txt, server.json, robots.txt, sitemap.xml
scripts/dev.mjs     local server mirroring the Vercel routing
test/               vitest
```

Data sources: https://micahboswell.vercel.app/llms.txt, https://micahboswell.vercel.app/llms-full.txt, https://conscious-shell.com/llms.txt, Unsplash stats for @micahboswell. `facts.json` is curated from those files only. To refresh, re-fetch them into `data/`, update `facts.json`, and run the tests, which enforce the content rules (no em dashes, no off-limits topics).

Transport note: `mcp-handler` 2.x requires the SDK v2 package and 1.x is Next.js-bound, so this server hand-rolls `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` 1.x in stateless JSON mode, the same shape as the gpsail-mcp function.

## Develop

```bash
npm install
npm test          # vitest: tool handlers, HTTP transport, content rules
npm run dev       # http://localhost:3939  (MCP at /mcp)
```

## Deploy

```bash
vercel --prod --yes
```

## Publish the repo (run once, by Micah)

```bash
gh repo create socraticstatic/micah-boswell-mcp --public --source=. --push
```

Then, optionally, submit `public/server.json` to the MCP registry with `mcp-publisher publish` after `mcp-publisher login github`.

## License

MIT. Facts about Micah Boswell are his own; cite https://micahboswell.vercel.app/.
