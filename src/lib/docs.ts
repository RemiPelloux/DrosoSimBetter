// Chapitres de documentation : les fichiers Markdown de docs/ sont embarqués au build
// (loader « text » d'esbuild, voir angular.json). Seuls les fichiers numérotés
// (« 01-presentation.md ») sont des chapitres ; README.md sert d'index sur GitHub.
import presentation from '../../docs/01-presentation.md';
import guide from '../../docs/02-guide.md';
import modele from '../../docs/03-modele.md';
import leviers from '../../docs/04-leviers.md';
import economie from '../../docs/05-economie.md';
import architecture from '../../docs/06-architecture.md';
import limites from '../../docs/07-limites.md';
import institutionnel from '../../docs/08-drososim-institutionnel.md';
import backend from '../../docs/09-backend.md';
import developpement from '../../docs/10-developpement.md';
import modeleMath from '../../docs/11-modele-mathematique.md';

export interface DocMeta { slug: string; title: string; icon: string; order: number; }
export interface Doc extends DocMeta { body: string; }

const FILES: Record<string, string> = {
  '01-presentation.md': presentation,
  '02-guide.md': guide,
  '03-modele.md': modele,
  '04-leviers.md': leviers,
  '05-economie.md': economie,
  '06-architecture.md': architecture,
  '07-limites.md': limites,
  '08-drososim-institutionnel.md': institutionnel,
  '09-backend.md': backend,
  '10-developpement.md': developpement,
  '11-modele-mathematique.md': modeleMath,
};

function parse(file: string, raw: string): Doc {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm: Record<string, string> = {};
  if (m) m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) fm[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  const order = parseInt(file, 10);
  const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '');
  return { slug, order, title: fm['title'] ?? slug, icon: fm['icon'] ?? 'book', body: m ? raw.slice(m[0].length) : raw };
}

const DOCS: Doc[] = Object.keys(FILES).sort().map(f => parse(f, FILES[f].replace(/\r\n/g, '\n')));

export function getDocs(): Doc[] { return DOCS; }
