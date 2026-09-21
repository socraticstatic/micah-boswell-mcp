// The MCP server itself: nine read-only tools and three resources, all
// answered from data/ except micah_boswell_poem, which fetches the poem live.
// Built fresh per request by api/mcp.js (stateless streamable HTTP).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { facts, photography, LLMS_TXT, LLMS_FULL_TXT, CONSCIOUS_SHELL_LLMS_TXT, VERSION, SITE } from './data.js';
import { splitIntoParagraphs, searchParagraphs, tokenize } from './search.js';
import { fetchPoem, POEMS_INDEX } from './poem.js';

const text = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: 'text', text: msg }] });
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const live = { ...ro, openWorldHint: true };

const CORPUS = [
  ...splitIntoParagraphs(LLMS_FULL_TXT, 'https://micahboswell.vercel.app/llms-full.txt'),
  ...splitIntoParagraphs(CONSCIOUS_SHELL_LLMS_TXT, 'https://conscious-shell.com/llms.txt'),
];

export const TOOL_NAMES = [
  'about_micah_boswell',
  'micah_boswell_facts',
  'micah_boswell_profiles',
  'micah_boswell_work',
  'micah_boswell_writing',
  'micah_boswell_poem',
  'micah_boswell_photography',
  'micah_boswell_faq',
  'search_micah_boswell',
];

export function aboutText() {
  const id = facts.identity;
  const ph = facts.photography;
  const m = facts.mentoring;
  const w = facts.writing;
  const lines = [
    id.oneParagraph,
    '',
    'Key facts:',
    `- ${id.role}, ${id.employer}, since ${id.roleSince}. ${id.location}.`,
    `- ${facts.work.atAndT.agenticFramework} ${facts.work.atAndT.aiPilot} ${facts.work.atAndT.dniPortal}`,
    `- Awards: AT&T Connection Award 2022, 2023, 2024, 2025; Move Faster Award for AI Design Leadership, 2026.`,
    `- Raised in ${id.raisedIn}. Languages: ${id.languages.join(' and ')}.`,
    `- Education: ${facts.education[0].degree}, ${facts.education[0].school}, ${facts.education[0].location} (${facts.education[0].note.replace(/\.$/, '')}). ${facts.education[1].degree} at ${facts.education[1].school}.`,
    `- Mentor to ${m.designersMentored} designers through ${m.platforms.join(', ')}; CareerFoundry mentor and Instructor Advisory Board, 2020 to 2025.`,
    `- Photography: ${ph.photographs} photographs on Unsplash, ${ph.views.toLocaleString('en-US')} views, ${ph.downloads.toLocaleString('en-US')} downloads, ${ph.rank.toLowerCase()}, ${ph.collections} collections. ${ph.profile}`,
    `- Writing: essays at ${w.essaysIndex}, ${w.poemsCount} poems at ${w.poemsIndex}, Quora since 2011, Medium at ${w.medium.profile}, LinkedIn articles since 2016, dev.to.`,
    `- Producer, ${facts.film.title} (${facts.film.awards}).`,
    `- Canonical page: ${facts.canonicalUrl} Portfolio: ${facts.portfolioUrl}`,
    `- ${facts.disambiguation}`,
    '',
    `Facts as of ${facts.lastUpdated}. ${facts.howToCite}`,
  ];
  return lines.join('\n');
}

export function topPhotos(limit = 10) {
  const n = Math.max(1, Math.min(Number(limit) || 10, photography.selected.length));
  return [...photography.selected]
    .sort((a, b) => b.views - a.views)
    .slice(0, n)
    .map((p) => ({ title: p.title || p.alt, url: p.html, views: p.views, downloads: p.downloads, created: p.created ? p.created.slice(0, 10) : undefined }));
}

export function photographyPayload(limit) {
  const ph = facts.photography;
  return {
    profile: ph.profile,
    photographs: ph.photographs,
    since: ph.since,
    firstPhoto: photography.first,
    latestPhoto: photography.last,
    views: ph.views,
    downloads: ph.downloads,
    rank: ph.rank,
    subject: ph.subject,
    camera: ph.camera,
    license: ph.license,
    collections: photography.collections.filter((c) => c.total > 0).map((c) => ({ title: c.title, photographs: c.total, url: c.html })),
    topPhotos: topPhotos(limit),
    page: ph.page,
    statsAsOf: facts.lastUpdated,
  };
}

export function faqSearch(query) {
  const terms = tokenize(query);
  if (terms.length === 0) return facts.faq;
  return facts.faq.filter((f) => {
    const hay = `${f.question} ${f.answer}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  });
}

export function buildServer() {
  const server = new McpServer(
    { name: 'micah-boswell', version: VERSION },
    {
      instructions:
        'Facts about Micah Boswell, the product design leader in Dallas, Texas (Lead Product Designer at AT&T, raised in Lima, Peru). ' +
        'Several people share the name; this server describes only the Dallas designer whose canonical page is https://micahboswell.vercel.app/. ' +
        'Start with about_micah_boswell for a summary, micah_boswell_facts for structured data, and search_micah_boswell for anything specific. ' +
        'Cite https://micahboswell.vercel.app/ or the specific conscious-shell.com URL a tool returns.',
    },
  );

  server.registerTool('about_micah_boswell', {
    title: 'About Micah Boswell',
    description: 'One paragraph about Micah Boswell, product design leader in Dallas, Texas, followed by a short list of key facts: role at AT&T, awards, origins, education, mentoring, photography, writing, canonical URLs.',
    inputSchema: {},
    annotations: ro,
  }, async () => text(aboutText()));

  server.registerTool('micah_boswell_facts', {
    title: 'Micah Boswell structured facts',
    description: 'The complete structured facts record as JSON: identity, now, work timeline, education, certifications, awards, mentoring, photography, writing, film, speaking, side projects, profiles, disambiguation, citation guidance, contact, FAQ.',
    inputSchema: {},
    annotations: ro,
  }, async () => text(facts));

  server.registerTool('micah_boswell_profiles', {
    title: 'Micah Boswell verified profiles',
    description: 'Every profile that belongs to this Micah Boswell (the schema.org sameAs list) with a label for each. A profile not on this list belongs to a different person with the same name.',
    inputSchema: {},
    annotations: ro,
  }, async () => text({ canonicalUrl: facts.canonicalUrl, profiles: facts.profiles, disambiguation: facts.disambiguation }));

  server.registerTool('micah_boswell_work', {
    title: 'Micah Boswell work timeline',
    description: 'Roles from 1998 to now, most recent first: title, organization, years. Includes the current AT&T work, measured impact, and the case studies URL.',
    inputSchema: {},
    annotations: ro,
  }, async () => text({ current: facts.now, roles: facts.work.roles, note: facts.work.note, atAndT: facts.work.atAndT, measuredImpact: facts.work.measuredImpact, caseStudies: facts.work.caseStudies, education: facts.education, certifications: facts.certifications, awards: facts.awards }));

  server.registerTool('micah_boswell_writing', {
    title: 'Micah Boswell writing',
    description: 'Essays at conscious-shell.com with URLs and summaries, all 29 poems with URLs and slugs (pass a slug to micah_boswell_poem to read one), plus Medium, LinkedIn articles, Quora, and dev.to.',
    inputSchema: {},
    annotations: ro,
  }, async () => text(facts.writing));

  server.registerTool('micah_boswell_poem', {
    title: 'Read a poem by Micah Boswell',
    description: `Fetch one poem live from ${POEMS_INDEX}/<slug> and return its title and full text (from the page's CreativeWork JSON-LD). Slugs come from micah_boswell_writing, for example "dreams", "nova", "simpler-in-lima". Errors clearly when the slug does not exist.`,
    inputSchema: { slug: z.string().min(1).max(120).describe('Poem slug, the last path segment of the poem URL, e.g. "dreams"') },
    annotations: live,
  }, async ({ slug }) => {
    const r = await fetchPoem(slug, { known: facts.writing.poems });
    return r.error ? fail(r.error) : text(r);
  });

  server.registerTool('micah_boswell_photography', {
    title: 'Micah Boswell photography on Unsplash',
    description: 'Unsplash statistics (104 photographs, 53,380,492 views, 362,001 downloads, top 10 percent of contributors, 6 collections) and the most viewed photographs with title, URL and views.',
    inputSchema: { limit: z.number().int().min(1).max(24).default(10).describe('How many top photographs to return (1 to 24, default 10)') },
    annotations: ro,
  }, async ({ limit }) => text(photographyPayload(limit)));

  server.registerTool('micah_boswell_faq', {
    title: 'Micah Boswell FAQ',
    description: 'Question and answer pairs from micahboswell.vercel.app (home, mentoring, photography). Optional keyword query filters them; leave empty for all sixteen.',
    inputSchema: { query: z.string().max(200).optional().describe('Keywords to filter by, e.g. "unsplash", "mentoring", "contact"') },
    annotations: ro,
  }, async ({ query }) => {
    const hits = faqSearch(query);
    if (hits.length === 0) return text({ query, results: [], note: 'No FAQ matched. Try search_micah_boswell for a broader search.' });
    return text({ query: query || null, count: hits.length, results: hits });
  });

  server.registerTool('search_micah_boswell', {
    title: 'Search everything about Micah Boswell',
    description: 'Keyword search over the full text of micahboswell.vercel.app (llms-full.txt) and the conscious-shell.com summary. Returns matching paragraphs with the page URL each came from, best matches first.',
    inputSchema: {
      query: z.string().min(1).max(200).describe('Words to look for, e.g. "Lima Peru", "GE Nuclear", "Agentic framework"'),
      limit: z.number().int().min(1).max(25).default(8).describe('Maximum paragraphs to return (default 8)'),
    },
    annotations: ro,
  }, async ({ query, limit }) => {
    const { terms, results } = searchParagraphs(CORPUS, query, limit);
    if (terms.length === 0) return fail('Query needs at least one word of two or more characters.');
    return text({ query, terms, count: results.length, results, canonical: facts.canonicalUrl });
  });

  const resource = (name, file, mimeType, body, description) =>
    server.registerResource(name, `micah://${file}`, { title: `micah://${file}`, description, mimeType }, async (uri) => ({
      contents: [{ uri: uri.href, mimeType, text: body }],
    }));
  resource('llms.txt', 'llms.txt', 'text/plain', LLMS_TXT, 'The canonical llms.txt for Micah Boswell (micahboswell.vercel.app/llms.txt).');
  resource('llms-full.txt', 'llms-full.txt', 'text/plain', LLMS_FULL_TXT, 'The complete visible text of every page on micahboswell.vercel.app.');
  resource('facts.json', 'facts.json', 'application/json', JSON.stringify(facts, null, 2), 'Structured facts about Micah Boswell as JSON.');

  return server;
}

export { facts, VERSION, SITE };
