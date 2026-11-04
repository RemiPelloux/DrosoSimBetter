import { ApplicationRef, Component, DestroyRef, ElementRef, EnvironmentInjector, afterRenderEffect, computed, createComponent, inject, input, signal, viewChild, type ComponentRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import GithubSlugger from 'github-slugger';
import { BookOpen, Compass, Bug, ShieldCheck, Euro, Cpu, AlertTriangle, ScanSearch, Plug, Code2, ChevronLeft, ChevronRight, Search, Menu, X, ArrowUpRight, ListTree, type IconNode } from 'lucide';
import { DIAGRAMS, Logo, Drosophila } from '@/components/illustrations';
import type { Doc, DocMeta } from '@/lib/docs';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { Lucide } from '../ui/lucide';
import { Motion } from '../ui/motion';

const ICONS: Record<string, IconNode> = { book: BookOpen, compass: Compass, bug: Bug, shield: ShieldCheck, euro: Euro, cpu: Cpu, alert: AlertTriangle, search: ScanSearch, plug: Plug, code: Code2 };
const DIAGRAM_NAMES = new Set(Object.keys(DIAGRAMS));

@Component({
  selector: 'ds-docs-shell',
  imports: [RouterLink, NgTemplateOutlet, Lucide, Motion, Logo, Drosophila],
  host: { style: 'display: contents' },
  templateUrl: './docs-shell.component.html',
})
export class DocsShell {
  readonly doc = input.required<Doc>();
  readonly nav = input.required<DocMeta[]>();

  protected I = { Search, Menu, X, ArrowUpRight, ChevronLeft, ChevronRight, ListTree };
  protected cn = cn;
  protected icon = (name: string) => ICONS[name] ?? BookOpen;
  protected q = signal('');
  protected open = signal(false);
  protected activeId = signal('');

  private router = inject(Router);
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);
  private sanitizer = inject(DomSanitizer);
  private article = viewChild<ElementRef<HTMLElement>>('article');
  private mounted: ComponentRef<unknown>[] = [];

  // contenu de confiance (dépôt) : on conserve les styles en ligne de KaTeX
  protected html = computed(() => this.sanitizer.bypassSecurityTrustHtml(renderMarkdown(this.doc().body, DIAGRAM_NAMES)));

  protected toc = computed(() => {
    const sl = new GithubSlugger();
    const out: { id: string; text: string; level: number }[] = [];
    let inCode = false;
    for (const line of this.doc().body.split('\n')) {
      if (line.startsWith('```')) { inCode = !inCode; continue; }
      if (inCode) continue;
      const m = /^(#{1,3})\s+(.*)$/.exec(line);
      if (!m) continue;
      const text = m[2].replace(/[*_`]/g, '').replace(/\$[^$]*\$/g, '').trim();
      const id = sl.slug(m[2].replace(/[*_`]/g, ''));
      if (m[1].length > 1) out.push({ id, text, level: m[1].length });
    }
    return out;
  });
  private idx = computed(() => this.nav().findIndex(n => n.slug === this.doc().slug));
  protected prev = computed(() => this.nav()[this.idx() - 1]);
  protected next = computed(() => this.nav()[this.idx() + 1]);
  protected filtered = computed(() => { const q = this.q().toLowerCase(); return this.nav().filter(n => n.title.toLowerCase().includes(q)); });

  constructor() {
    // après chaque nouveau rendu du Markdown : diagrammes montés, sommaire actif observé, retour en haut
    afterRenderEffect(onCleanup => {
      this.html();
      const el = this.article()?.nativeElement;
      if (!el) return;
      this.unmount();
      el.querySelectorAll<HTMLElement>('[data-diagram]').forEach(slot => {
        const D = DIAGRAMS[slot.dataset['diagram']!];
        if (!D) return;
        const host = document.createElement('span');
        slot.replaceChildren(host);
        const ref = createComponent(D, { environmentInjector: this.injector, hostElement: host });
        this.appRef.attachView(ref.hostView);
        this.mounted.push(ref);
      });
      const hs = Array.from(el.querySelectorAll('h2, h3')) as HTMLElement[];
      const obs = new IntersectionObserver(es => { const v = es.filter(e => e.isIntersecting); if (v[0]) this.activeId.set((v[0].target as HTMLElement).id); }, { rootMargin: '-80px 0px -70% 0px' });
      hs.forEach(h => obs.observe(h));
      if (!location.hash) window.scrollTo({ top: 0 });
      onCleanup(() => obs.disconnect());
    });
    inject(DestroyRef).onDestroy(() => this.unmount());
  }

  private unmount() {
    for (const r of this.mounted) { this.appRef.detachView(r.hostView); r.destroy(); }
    this.mounted = [];
  }

  /** Liens internes du Markdown : navigation par le routeur ; ancres : défilement sur la page. */
  protected onArticleClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#')) { this.goAnchor(e, decodeURIComponent(href.slice(1))); return; }
    if (href.startsWith('/')) { e.preventDefault(); this.router.navigateByUrl(href); }
  }

  protected goAnchor(e: Event, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(history.state, '', `${location.pathname}#${id}`);
  }
}
