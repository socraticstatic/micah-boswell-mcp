// Live fetch of one poem from conscious-shell.com. The page embeds a
// CreativeWork JSON-LD block whose "text" field is the poem itself.

export const POEMS_INDEX = 'https://conscious-shell.com/poems';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UA = 'micah-boswell-mcp/1.0 (+https://micah-boswell-mcp.vercel.app/)';

export function extractJsonLd(html) {
  const items = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      const list = Array.isArray(parsed) ? parsed : parsed && parsed['@graph'] ? parsed['@graph'] : [parsed];
      items.push(...list.filter(Boolean));
    } catch {
      // A malformed block is skipped; the caller reports "no CreativeWork" if nothing else matches.
    }
  }
  return items;
}

export function findCreativeWork(items) {
  return items.find((it) => {
    const t = it['@type'];
    return Array.isArray(t) ? t.includes('CreativeWork') : t === 'CreativeWork';
  });
}

export function normalizeSlug(input) {
  let s = String(input || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\/(www\.)?conscious-shell\.com\/poems\//, '').replace(/\/+$/, '');
  return s;
}

export async function fetchPoem(input, { fetchImpl = fetch, known = [] } = {}) {
  const slug = normalizeSlug(input);
  if (!SLUG.test(slug)) {
    return { error: `Invalid slug "${input}". Pass the last path segment of the poem URL, for example "dreams" for ${POEMS_INDEX}/dreams.` };
  }
  const url = `${POEMS_INDEX}/${slug}`;
  let res;
  try {
    res = await fetchImpl(url, { headers: { accept: 'text/html', 'user-agent': UA }, redirect: 'follow' });
  } catch (e) {
    return { error: `Could not reach conscious-shell.com: ${e.message}` };
  }
  if (res.status === 404) {
    const near = known.filter((p) => p.slug.includes(slug) || slug.includes(p.slug)).map((p) => p.slug);
    const hint = near.length ? ` Did you mean: ${near.join(', ')}.` : '';
    return { error: `No poem at ${url}.${hint} The index of all poems is ${POEMS_INDEX}.` };
  }
  if (!res.ok) return { error: `conscious-shell.com returned HTTP ${res.status} for ${url}.` };
  const html = await res.text();
  const work = findCreativeWork(extractJsonLd(html));
  if (!work || typeof work.text !== 'string' || !work.text.trim()) {
    return { error: `The page at ${url} has no CreativeWork text to return.` };
  }
  return {
    title: work.name || slug,
    headline: work.headline,
    url: work.url || url,
    author: 'Micah Boswell',
    datePublished: work.datePublished,
    dateModified: work.dateModified,
    wordCount: work.wordCount,
    text: work.text,
    copyright: work.copyrightNotice,
  };
}
