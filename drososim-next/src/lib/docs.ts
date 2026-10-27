import fs from 'node:fs';
import path from 'node:path';

export interface DocMeta { slug: string; title: string; icon: string; order: number; }
export interface Doc extends DocMeta { body: string; }

const DIR = path.join(process.cwd(), 'docs');

function parse(file: string): Doc {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm: Record<string, string> = {};
  if (m) m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) fm[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  const order = parseInt(file, 10);
  const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '');
  return { slug, order, title: fm.title ?? slug, icon: fm.icon ?? 'book', body: m ? raw.slice(m[0].length) : raw };
}

export function getDocs(): Doc[] {
  return fs.readdirSync(DIR).filter(f => f.endsWith('.md')).sort().map(parse);
}
