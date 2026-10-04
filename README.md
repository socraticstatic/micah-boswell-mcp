# micah-boswell-mcp 
[![smithery badge](https://smithery.ai/badge/smackintosh/micah-boswell)](https://smithery.ai/servers/smackintosh/micah-boswell)

A public Model Context Protocol (MCP) server that answers questions about Micah Boswell, product design leader in Dallas, Texas. Any MCP-capable agent (Claude, ChatGPT, Cursor, and others) connects to one URL and gets his facts from his own pages.

- Endpoint: `https://micah-boswell-mcp.vercel.app/mcp` (streamable HTTP, stateless, no auth)
- Landing page: https://micah-boswell-mcp.vercel.app/
- Registry manifest: https://micah-boswell-mcp.vercel.app/server.json (`io.github.socraticstatic/micah-boswell`), also at `/.well-known/mcp/server-card.json`
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
public/             landing page, llms.txt, server.json, icons, robots.txt, sitemap.xml
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

## Release

One version lives in three places and the tests fail if they disagree: `server.json` (root, read by `mcp-publisher`; `public/server.json` is the served copy), `package.json`, and `VERSION` in `lib/data.js` (what the live server reports).

1. Bump all three. Update `data/` if the facts changed and `lastUpdated` in `facts.json`.
2. `npm test`, then `vercel --prod --yes`, then confirm `https://micah-boswell-mcp.vercel.app/healthz` reports the new version.
3. `git tag v<version> && git push origin main v<version>`.

`.github/workflows/publish-mcp.yml` then publishes the card to the official MCP Registry (`io.github.socraticstatic/micah-boswell`) over GitHub OIDC. It refuses a tag that disagrees with the card or with what the live server reports. `.github/workflows/ci.yml` runs the tests on every push.

Listings: [official registry](https://registry.modelcontextprotocol.io/v0/servers?search=micah-boswell), [Smithery](https://smithery.ai/servers/smackintosh/micah-boswell), [Glama](https://glama.ai/mcp/connectors/app.vercel.micah-boswell-mcp/micah-boswell). The card is also served at `/.well-known/mcp/server-card.json`.

## License

MIT. Facts about Micah Boswell are his own; cite https://micahboswell.vercel.app/.
