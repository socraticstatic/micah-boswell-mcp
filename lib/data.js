// Bundled source-of-truth files. Everything the tools return comes from these.
// Regenerate by re-fetching the URLs listed in data/facts.json "sources".
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = (name) => readFileSync(path.join(DATA_DIR, name), 'utf8');

export const LLMS_TXT = read('llms.txt');
export const LLMS_FULL_TXT = read('llms-full.txt');
export const CONSCIOUS_SHELL_LLMS_TXT = read('conscious-shell-llms.txt');
export const facts = JSON.parse(read('facts.json'));
export const photography = JSON.parse(read('photography.json'));

export const VERSION = '1.0.0';
export const SITE = 'https://micah-boswell-mcp.vercel.app';
export const MCP_URL = `${SITE}/mcp`;
