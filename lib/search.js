// Keyword search over the bundled text corpora. Each corpus is split into
// pages (a "## https://..." heading starts a page) and pages into paragraphs.

export function splitIntoParagraphs(text, fallbackUrl) {
  const out = [];
  let url = fallbackUrl;
  let buf = [];
  const flush = () => {
    const p = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (p.length >= 12) out.push({ url, text: p });
    buf = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = line.match(/^## (https?:\/\/\S+)$/);
    if (m) { flush(); url = m[1]; continue; }
    if (!line) { flush(); continue; }
    if (line.startsWith('#')) { flush(); continue; }
    buf.push(line);
  }
  flush();
  return out;
}

export function tokenize(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}@.'-]+/u)
    .map((t) => t.replace(/^[.'-]+|[.'-]+$/g, ''))
    .filter((t) => t.length >= 2);
}

export function searchParagraphs(paragraphs, query, limit = 8) {
  const terms = tokenize(query);
  if (terms.length === 0) return { terms, results: [] };
  const scored = [];
  paragraphs.forEach((p, index) => {
    const lower = p.text.toLowerCase();
    const hits = terms.filter((t) => lower.includes(t));
    if (hits.length === 0) return;
    const all = hits.length === terms.length;
    scored.push({ score: (all ? 1000 : 0) + hits.length * 100 - Math.min(p.text.length, 900) / 100, index, hits, p });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return {
    terms,
    results: scored.slice(0, limit).map(({ p, hits }) => ({ url: p.url, matched: hits, text: p.text })),
  };
}
