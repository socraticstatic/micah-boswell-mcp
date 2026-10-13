// The career keys of data/facts.json (work.roles, awards, certifications.list,
// education) come from ../job-hunter/data/career.json through
// scripts/sync-career.mjs. When that checkout is absent the canon tests skip.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mcpCareer, applyCareer } from '../scripts/lib/career-format.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonPath = process.env.CAREER_JSON || path.join(ROOT, '..', 'job-hunter', 'data', 'career.json');
const hasCanon = existsSync(canonPath);
const career = hasCanon ? JSON.parse(readFileSync(canonPath, 'utf8')) : null;
const facts = () => JSON.parse(readFileSync(path.join(ROOT, 'data', 'facts.json'), 'utf8'));
const EM_DASH = String.fromCharCode(0x2014);
const AWARDS = { list: ['2023-10', '2024-08', '2025-10', '2026-07'].map((date, i) => ({ name: `AT&T Connection Award: Fixture ${i}`, issuer: 'AT&T', date })) };
const EDUCATION = {
  education: { degree: 'B.A.', school: 'Hardin-Simmons University', location: 'Abilene, Texas', coursework: '1988-1992', conferred: '2025-12-15' },
  earlier_education: [{ school: 'Samford University', location: 'Birmingham, Alabama', label: 'Freshman year' }],
};

describe.skipIf(!hasCanon)('career keys from the canon', () => {
  it('roles: every shown role once, newest end first; Dell via Possible, IMC2 joined', () => {
    const { roles } = mcpCareer(career);
    expect(roles.length).toBe(career.roles.filter((r) => r.surfaces?.mcp !== false).length);
    const ends = roles.map((r) => (r.end == null ? 9999 : r.end));
    expect(ends).toEqual([...ends].sort((a, b) => b - a));
    expect(roles.find((r) => r.org === 'Dell').note).toBe('via Possible Worldwide');
    expect(roles.find((r) => r.org === 'IMC2, NCH and GlaxoSmithKline')).toBeTruthy();
    expect(roles.find((r) => r.org === 'CareerFoundry').note).toBe('and its Instructor Advisory Board');
    expect(roles.find((r) => r.org === 'AT&T')).toEqual({ years: '2021 to now', start: 2021, end: null, title: 'Lead Product Designer', org: 'AT&T' });
    expect(roles.find((r) => r.org === 'Citi')).toEqual({ years: '2016', start: 2016, end: 2016, title: 'UX Innovation Lead', org: 'Citi', note: 'via C2G' });
  });

  it('awards group by name with their years; every canon award year is kept', () => {
    expect(mcpCareer({ ...career, awards: AWARDS }).awards).toEqual([{ name: 'AT&T Connection Award', issuer: 'AT&T', years: [2023, 2024, 2025, 2026] }]);
    const years = mcpCareer(career).awards.flatMap((a) => a.years);
    for (const a of career.awards.list) expect(years).toContain(Number(a.date.slice(0, 4)));
  });

  it('certifications and education', () => {
    const c = mcpCareer({ ...career, ...EDUCATION });
    expect(c.certificationsList).toEqual(career.certifications);
    expect(c.education).toEqual([
      { degree: 'Bachelor of Arts', school: 'Hardin-Simmons University', location: 'Abilene, Texas', note: 'Coursework completed 1992; degree conferred December 2025.' },
      { degree: 'Freshman year', school: 'Samford University', location: 'Birmingham, Alabama' },
    ]);
  });

  it('lastUpdated moves only on a change, and other keys are left alone', () => {
    const synced = applyCareer(facts(), career, '2099-01-01');
    expect(applyCareer(structuredClone(synced), career, '2099-02-02').lastUpdated).toBe(synced.lastUpdated);
    const changed = structuredClone(career);
    changed.roles[0].title = 'Principal Product Designer';
    const out = applyCareer(structuredClone(synced), changed, '2099-03-03');
    expect(out.lastUpdated).toBe('2099-03-03');
    expect(out.certifications.summary).toBe(facts().certifications.summary);
    expect(out.work.caseStudies).toEqual(facts().work.caseStudies);
  });

  it('a conferred date without a month throws instead of printing undefined', () => {
    expect(() => mcpCareer({ ...career, ...EDUCATION, education: { ...EDUCATION.education, conferred: '2025' } })).toThrow(/conferred needs a month: 2025/);
  });

  it('no salary and no em dash in the output', () => {
    const all = JSON.stringify(mcpCareer(career));
    expect(all).not.toMatch(/190,000|230,000|\$\d/);
    expect(all.includes(EM_DASH)).toBe(false);
  });
});

it('missing canon exits 2 and writes nothing', () => {
  const file = path.join(ROOT, 'data', 'facts.json');
  const before = statSync(file).mtimeMs;
  const r = spawnSync('node', [path.join(ROOT, 'scripts', 'sync-career.mjs')], { env: { ...process.env, CAREER_JSON: '/nonexistent/career.json' }, encoding: 'utf8' });
  expect(r.status).toBe(2);
  expect(r.stderr).toMatch(/career\.json not found: \/nonexistent\/career\.json/);
  expect(statSync(file).mtimeMs).toBe(before);
});
