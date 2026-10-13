// Pure formatters for the career keys of data/facts.json: work.roles, awards,
// certifications.list and education, all from job-hunter's career.json. The
// rest of facts.json (case studies, FAQ, summaries) stays hand-written.

const DEGREES = { 'B.A.': 'Bachelor of Arts' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const year = (v) => Number(String(v).slice(0, 4));
const joinAnd = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

function roleEntry(r) {
  const [, name, via] = /^(.*?)(?: \(via (.*)\))?$/.exec(r.company);
  const start = year(r.start);
  const end = r.end == null ? null : year(r.end);
  const years = end == null ? `${start} to now` : start === end ? `${start}` : `${start} to ${end}`;
  const note = [via && `via ${via}`, r.note?.en].filter(Boolean).join(', ');
  return { years, start, end, title: r.title, org: joinAnd(name.split(', ')), ...(note ? { note } : {}) };
}

export function mcpCareer(career) {
  const end = (r) => (r.end == null ? '9999' : String(r.end));
  const roles = career.roles
    .filter((r) => r.surfaces?.mcp !== false)
    .sort((a, b) => end(b).localeCompare(end(a)) || String(b.start).localeCompare(String(a.start)))
    .map(roleEntry);

  const groups = new Map();
  for (const a of career.awards.list) {
    const name = a.name.split(': ')[0];
    const g = groups.get(name) || { name, issuer: a.issuer, years: [] };
    if (!g.years.includes(year(a.date))) g.years.push(year(a.date));
    groups.set(name, g);
  }
  const awards = [...groups.values()].map((g) => ({ ...g, years: g.years.sort((x, y) => x - y) }));

  const ed = career.education;
  const degree = DEGREES[ed.degree];
  if (!degree) throw new Error(`no degree name for ${ed.degree}`);
  const [cy, cm] = ed.conferred.split('-');
  if (!MONTHS[Number(cm) - 1]) throw new Error(`conferred needs a month: ${ed.conferred}`);
  const education = [
    { degree, school: ed.school, location: ed.location, note: `Coursework completed ${ed.coursework.split('-').at(-1)}; degree conferred ${MONTHS[Number(cm) - 1]} ${cy}.` },
    ...(career.earlier_education || []).map((e) => ({ degree: e.label, school: e.school, location: e.location })),
  ];

  return { roles, awards, certificationsList: career.certifications, education };
}

export function applyCareer(facts, career, today) {
  const out = structuredClone(facts);
  const c = mcpCareer(career);
  const before = JSON.stringify([out.work.roles, out.awards, out.certifications.list, out.education]);
  out.work.roles = c.roles;
  out.awards = c.awards;
  out.certifications.list = c.certificationsList;
  out.education = c.education;
  if (JSON.stringify([out.work.roles, out.awards, out.certifications.list, out.education]) !== before) out.lastUpdated = today;
  return out;
}
