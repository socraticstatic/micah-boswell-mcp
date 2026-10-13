#!/usr/bin/env node
// Regenerate work.roles, awards, certifications.list and education in
// data/facts.json from the career canon (../job-hunter/data/career.json, or
// $CAREER_JSON). lastUpdated moves only when one of them changes. Run after
// any career.json change, then `npm test`:
//   node scripts/sync-career.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCareer } from './lib/career-format.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonPath = process.env.CAREER_JSON || path.join(ROOT, '..', 'job-hunter', 'data', 'career.json');
if (!existsSync(canonPath)) {
  console.error(`career.json not found: ${canonPath}`);
  process.exit(2);
}

const file = path.join(ROOT, 'data', 'facts.json');
const raw = readFileSync(file, 'utf8');
const today = new Date().toLocaleDateString('en-CA');
const out = JSON.stringify(applyCareer(JSON.parse(raw), JSON.parse(readFileSync(canonPath, 'utf8')), today), null, 2) + '\n';
if (out !== raw) writeFileSync(file, out);
console.log(`data/facts.json: ${out === raw ? 'unchanged' : 'changed'}`);
