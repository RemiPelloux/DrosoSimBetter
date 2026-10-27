'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import 'katex/dist/katex.min.css';
import GithubSlugger from 'github-slugger';
import { DIAGRAMS, Logo, Drosophila } from '@/components/illustrations';
import type { Doc, DocMeta } from '@/lib/docs';
import { cn } from '@/lib/utils';
import { BookOpen, Compass, Bug, ShieldCheck, Euro, Cpu, AlertTriangle, ScanSearch, Plug, Code2, ChevronLeft, ChevronRight, Search, Menu, X, ArrowUpRight, ListTree } from 'lucide-react';

const REPO_URL = 'https://github.com/RemiPelloux/DrosoSimBetter';

const ICONS: Record<string, React.ElementType> = { book: BookOpen, compass: Compass, bug: Bug, shield: ShieldCheck, euro: Euro, cpu: Cpu, alert: AlertTriangle, search: ScanSearch, plug: Plug, code: Code2 };

export function DocsShell({ doc, nav }: { doc: Doc; nav: DocMeta[] }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const toc = useMemo(() => {
    const sl = new GithubSlugger();
    const out: { id: string; text: string; level: number }[] = [];
    let inCode = false;
    for (const line of doc.body.split('\n')) {
      if (line.startsWith('```')) { inCode = !inCode; continue; }
      if (inCode) continue;
      const m = /^(#{1,3})\s+(.*)$/.exec(line);
      if (!m) continue;
      const text = m[2].replace(/[*_`]/g, '').replace(/\$[^$]*\$/g, '').trim();
      const id = sl.slug(m[2].replace(/[*_`]/g, ''));
      if (m[1].length > 1) out.push({ id, text, level: m[1].length });
    }
    return out;
  }, [doc.body]);
  const [activeId, setActiveId] = useState('');
  const idx = nav.findIndex(n => n.slug === doc.slug);
  const prev = nav[idx - 1], next = nav[idx + 1];
  const filtered = useMemo(() => nav.filter(n => n.title.toLowerCase().includes(q.toLowerCase())), [nav, q]);

  useEffect(() => {
    const hs = Array.from(document.querySelectorAll('article h2, article h3')) as HTMLElement[];
    const obs = new IntersectionObserver(es => { const v = es.filter(e => e.isIntersecting); if (v[0]) setActiveId((v[0].target as HTMLElement).id); }, { rootMargin: '-80px 0px -70% 0px' });
    hs.forEach(h => obs.observe(h));
    window.scrollTo({ top: 0 });
    return () => obs.disconnect();
  }, [doc.slug]);

  const Sidebar = (
    <nav className="space-y-1">
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrer les chapitres…" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
      </div>
      {filtered.map(n => {
        const I = ICONS[n.icon] ?? BookOpen;
        const active = n.slug === doc.slug;
        return (
          <Link key={n.slug} href={`/docs/${n.slug}`} onClick={() => setOpen(false)}
            className={cn('group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors', active ? 'bg-emerald-700 text-white shadow' : 'text-slate-600 hover:bg-white hover:text-slate-900')}>
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold', active ? 'bg-white/20' : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-700')}>{n.order}</span>
            <I className="h-4 w-4 shrink-0" />{n.title}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <Link href="/" className="flex items-center gap-2"><Logo size={34} /><span className="text-base font-extrabold tracking-tight text-slate-900">DrosoSim<span className="text-emerald-700">Next</span></span></Link>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">Documentation</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/simulator" className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">Ouvrir le simulateur <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <motion.div initial={{ x: -300 }} animate={{ x: 0 }} className="h-full w-72 bg-slate-50 p-4" onClick={e => e.stopPropagation()}>
            <button className="mb-3 rounded-lg p-1.5 hover:bg-slate-200" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            {Sidebar}
          </motion.div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_220px]">
        <aside className="hidden lg:block"><div className="sticky top-24">{Sidebar}
          <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-4 text-white">
            <Drosophila size={44} />
            <p className="mt-2 text-sm font-bold">Drosophila suzukii</p>
            <p className="text-[11px] text-emerald-100">Mâle : taches noires à l&apos;apex des ailes. Femelle : ovipositeur denté qui perce les fruits sains.</p>
          </div>
        </div></aside>

        <motion.main key={doc.slug} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="min-w-0">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/docs/presentation" className="hover:text-slate-800">Documentation</Link><ChevronRight className="h-3 w-3" /><span className="text-slate-800">{doc.title}</span>
            <span className="ml-auto">Chapitre {doc.order} / {nav.length}</span>
          </div>
          <article className="prose prose-slate max-w-none rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10
            prose-headings:scroll-mt-24 prose-headings:font-extrabold prose-headings:tracking-tight prose-h1:text-4xl
            prose-h2:mt-12 prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-2
            prose-a:text-emerald-700 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none
            prose-table:text-sm prose-th:bg-slate-50 prose-th:px-3 prose-td:px-3 prose-blockquote:border-emerald-600 prose-blockquote:bg-emerald-50/60 prose-blockquote:py-1 prose-blockquote:not-italic
            prose-pre:bg-slate-900">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeSlug, rehypeKatex]}
              components={{
                code({ className, children, ...props }) {
                  const m = /language-diagram-([a-z-]+)/.exec(className ?? '');
                  if (m && DIAGRAMS[m[1]]) { const D = DIAGRAMS[m[1]]; return <span className="not-prose my-6 block rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><D /></span>; }
                  return <code className={className} {...props}>{children}</code>;
                },
                pre({ children, ...props }) {
                  const child = Array.isArray(children) ? children[0] : children;
                  const cn2 = (child as React.ReactElement<{ className?: string }>)?.props?.className ?? '';
                  if (cn2.includes('language-diagram-')) return <>{children}</>;
                  return <pre {...props}>{children}</pre>;
                },
                table({ children }) { return <div className="overflow-x-auto"><table>{children}</table></div>; },
                a({ href, children }) {
                  // liens relatifs : chapitre → /docs/<slug>, fichier du dépôt → GitHub, ancre ou URL → inchangé
                  let url = href ?? '';
                  const chapter = /^(?:\.\/)?\d+-([a-z0-9-]+)\.md(#.*)?$/.exec(url);
                  if (chapter) url = `/docs/${chapter[1]}${chapter[2] ?? ''}`;
                  else if (!/^(https?:|mailto:|#|\/)/.test(url)) url = `${REPO_URL}/blob/main/${url.replace(/^(\.\.\/)+/, '').replace(/^\.\//, 'docs/')}`;
                  const external = /^https?:/.test(url);
                  return <a href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
                },
                img({ src, alt }) {
                  const u = typeof src === 'string' ? src.replace(/^(\.\/)?assets\//, '/docs-assets/') : '';
                  // eslint-disable-next-line @next/next/no-img-element
                  return <img src={u} alt={alt ?? ''} className="mx-auto my-6 rounded-2xl" />;
                },
              }}>
              {doc.body}
            </ReactMarkdown>
          </article>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {prev ? <Link href={`/docs/${prev.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-400"><span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><ChevronLeft className="h-3.5 w-3.5" />Précédent</span><span className="font-bold text-slate-900 group-hover:text-emerald-700">{prev.title}</span></Link> : <span />}
            {next && <Link href={`/docs/${next.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-4 text-right hover:border-emerald-400"><span className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-500">Suivant<ChevronRight className="h-3.5 w-3.5" /></span><span className="font-bold text-slate-900 group-hover:text-emerald-700">{next.title}</span></Link>}
          </div>
        </motion.main>

        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><ListTree className="h-3.5 w-3.5" />Sur cette page</p>
            <ul className="space-y-1 border-l border-slate-200">
              {toc.map(t => (
                <li key={t.id}><a href={`#${t.id}`} className={cn('-ml-px block border-l-2 py-0.5 text-xs transition-colors', t.level === 3 ? 'pl-6' : 'pl-3', activeId === t.id ? 'border-emerald-600 font-bold text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{t.text}</a></li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
