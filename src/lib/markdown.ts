// =============================================================================
// Rendu Markdown de la documentation (même chaîne que react-markdown :
// remark-gfm + remark-math → rehype-slug + rehype-katex), sérialisé en HTML.
// Le dernier greffon reproduit les surcharges de composants de l'ancienne
// version React (diagrammes, tableaux défilants, liens, images).
// =============================================================================
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import type { Root, Element, ElementContent, Parent, Properties } from 'hast';

export const REPO_URL = 'https://github.com/RemiPelloux/DrosoSimBetter';

const classOf = (el: Element) => {
  const c = el.properties?.['className'];
  return Array.isArray(c) ? c.join(' ') : typeof c === 'string' ? c : '';
};

/** Surcharges : diagrammes, <pre>, tableaux, liens et images. */
function rehypeDocs(diagrams: ReadonlySet<string>) {
  return (tree: Root) => {
    const walk = (parent: Parent) => {
      const out: (Root['children'][number])[] = [];
      for (const node of parent.children) {
        if (node.type !== 'element') { out.push(node); continue; }
        const el = node as Element;
        if (el.tagName === 'pre') {
          const code = el.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
          const m = code && /language-diagram-([a-z-]+)/.exec(classOf(code));
          if (m) {
            // diagramme : bloc remplacé par un composant Angular monté à l'emplacement
            if (diagrams.has(m[1])) out.push({ type: 'element', tagName: 'span', properties: { className: ['not-prose', 'my-6', 'block', 'rounded-2xl', 'border', 'border-slate-200', 'bg-slate-50/60', 'p-4'], dataDiagram: m[1] }, children: [] });
            else out.push(...el.children);
            continue;
          }
          walk(el); out.push(el); continue;
        }
        if (el.tagName === 'table') {
          walk(el);
          out.push({ type: 'element', tagName: 'div', properties: { className: ['overflow-x-auto'] }, children: [{ ...el, properties: {} }] });
          continue;
        }
        if (el.tagName === 'a') {
          // liens relatifs : chapitre → /docs/<slug>, fichier du dépôt → GitHub, ancre ou URL → inchangé
          let url = String(el.properties?.['href'] ?? '');
          const chapter = /^(?:\.\/)?\d+-([a-z0-9-]+)\.md(#.*)?$/.exec(url);
          if (chapter) url = `/docs/${chapter[1]}${chapter[2] ?? ''}`;
          else if (!/^(https?:|mailto:|#|\/)/.test(url)) url = `${REPO_URL}/blob/main/${url.replace(/^(\.\.\/)+/, '').replace(/^\.\//, 'docs/')}`;
          const external = /^https?:/.test(url);
          walk(el);
          out.push({ ...el, properties: (external ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : { href: url }) as Properties });
          continue;
        }
        if (el.tagName === 'img') {
          const src = el.properties?.['src'];
          const u = typeof src === 'string' ? src.replace(/^(\.\/)?assets\//, '/docs-assets/') : '';
          out.push({ ...el, properties: { src: u, alt: String(el.properties?.['alt'] ?? ''), className: ['mx-auto', 'my-6', 'rounded-2xl'] } });
          continue;
        }
        walk(el); out.push(el);
      }
      parent.children = out as ElementContent[];
    };
    walk(tree);
  };
}

/** Markdown → HTML (les emplacements de diagrammes portent data-diagram="<nom>"). */
export function renderMarkdown(md: string, diagrams: ReadonlySet<string>): string {
  return String(unified()
    .use(remarkParse).use(remarkGfm).use(remarkMath)
    .use(remarkRehype)
    .use(rehypeSlug).use(rehypeKatex)
    .use(rehypeDocs, diagrams)
    .use(rehypeStringify)
    .processSync(md));
}
