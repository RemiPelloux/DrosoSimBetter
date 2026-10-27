'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useGridStore, buildTemplate } from '@/lib/store';
import { CELL_BG } from '@/components/GridEditor';
import { Logo, FlyingFlies, Drosophila, CherryArt, LifeCycleDiagram } from '@/components/illustrations';
import Link from 'next/link';
import {
  ArrowRight, PlayCircle, Paintbrush, SlidersHorizontal, BarChart3, Share2, Zap, ShieldCheck,
  Tractor, Users, FlaskConical, Check, X, Sparkles, MousePointerClick, Timer,
} from 'lucide-react';

const HERO_GRID = buildTemplate('mixed');

export default function WelcomePage() {
  const router = useRouter();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 80]);
  const hasProject = useGridStore(s => s.grid.some(c => c !== 'neutral'));
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const demo = () => { useGridStore.getState().loadDemo(); useGridStore.getState().setOnboardingDone(true); router.push('/results'); };

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      {/* Fond animé */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 140, repeat: Infinity, ease: 'linear' }}
          className="absolute -right-40 -top-40 h-[700px] w-[700px] rounded-full bg-gradient-to-br from-emerald-300/30 to-transparent blur-3xl" />
        <motion.div animate={{ y: [0, 40, 0] }} transition={{ duration: 10, repeat: Infinity }} className="absolute left-[-10%] top-1/2 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" />
        <motion.div animate={{ y: [0, -30, 0] }} transition={{ duration: 12, repeat: Infinity }} className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-rose-300/20 blur-3xl" />
      </div>

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Logo size={40} />
          <span className="text-xl font-extrabold tracking-tight">DrosoSim<span className="text-emerald-700">Next</span></span>
        </div>
        <div className="flex items-center gap-2">
          <a href="#fonctionnement" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white sm:block">Fonctionnement</a>
          <a href="#pourquoi" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white sm:block">Pourquoi</a>
          <Link href="/docs/presentation" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white sm:block">Documentation</Link>
          <button onClick={() => router.push('/simulator')} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Ouvrir le simulateur</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-8 lg:grid-cols-2 lg:pt-16">
        <div>
          <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Protection intégrée des vergers contre <em className="font-extrabold">Drosophila suzukii</em>
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-display mt-5 text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            Simulez votre verger.<br />
            <span className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-600 bg-clip-text text-transparent">Décidez en temps réel.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            Dessinez votre parcellaire en 10 secondes, activez filets, prophylaxie, biocontrôle, parasitoïdes ou TIS, et voyez immédiatement l&apos;impact sur la récolte, le revenu et l&apos;IFT.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => router.push('/simulator')} className="group flex h-14 items-center gap-2 rounded-2xl bg-emerald-700 px-7 text-base font-bold text-white shadow-xl shadow-emerald-900/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-800">
              {mounted && hasProject ? 'Reprendre mon verger' : 'Commencer la simulation'} <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
            <button onClick={demo} className="flex h-14 items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 text-base font-bold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400">
              <PlayCircle className="h-5 w-5 text-emerald-700" /> Voir une démo
            </button>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-8 flex flex-wrap gap-6 text-sm text-slate-600">
            {[[Timer, '< 25 ms par scénario'], [MousePointerClick, 'Aucun compte requis'], [Share2, 'Partage par lien']].map(([I, t]) => {
              const Icon = I as React.ElementType;
              return <span key={t as string} className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-emerald-700" />{t as string}</span>;
            })}
          </motion.div>
        </div>

        <motion.div style={{ y }} className="relative">
          <HeroOrchard />
          <FlyingFlies count={5} />
        </motion.div>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <SectionTitle kicker="En 3 gestes" title="Du dessin à la décision" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { i: Paintbrush, t: 'Dessinez', d: 'Pinceau, zone rectangulaire, pot de peinture, gomme au clic droit, modèles prêts à l’emploi. Les parcelles se forment et se nomment automatiquement.', c: 'from-amber-500 to-orange-600' },
            { i: SlidersHorizontal, t: 'Paramétrez', d: '5 leviers par parcelle avec réglages fins, « Appliquer à toutes » en 1 clic, climat, durée 1-3 ans, hypothèses économiques.', c: 'from-emerald-500 to-emerald-700' },
            { i: BarChart3, t: 'Comparez', d: 'KPIs décisionnels, graphiques légendés, phénologie, interventions, carte de pression, bilan économique et Fiche Conseil PDF.', c: 'from-blue-500 to-indigo-600' },
          ].map((s, k) => (
            <motion.div key={s.t} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: k * 0.1 }}
              className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-xl">
              <span className="absolute right-5 top-4 text-6xl font-black text-slate-100">{k + 1}</span>
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${s.c} text-white shadow-lg transition-transform group-hover:scale-110`}><s.i className="h-6 w-6" /></span>
              <h3 className="relative mt-5 text-xl font-extrabold">{s.t}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-slate-600">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Le modèle */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="grid items-center gap-10 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:grid-cols-2 md:p-12">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-700">Sous le capot</p>
            <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight">Un modèle biologique <em className="text-emerald-700">transparent</em></h2>
            <p className="mt-4 text-slate-600">Chaque jour, sur 400 cases : température, ponte selon la maturité des fruits, développement en degrés-jours, mortalité, dispersion vers les vergers attractifs. Chaque stratégie est simulée intégralement — les leviers changent vraiment la dynamique.</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {['Équations et paramètres documentés', 'Effet mathématique de chaque levier', 'Calcul économique détaillé, coûts éditables', 'Limites et démarche de calibration'].map(t => <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />{t}</li>)}
            </ul>
            <div className="mt-6 flex items-center gap-4">
              <Link href="/docs/modele" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">Lire la documentation du modèle <ArrowRight className="h-4 w-4" /></Link>
              <CherryArt size={44} />
              <motion.div animate={{ x: [0, 10, -6, 0], y: [0, -6, 4, 0] }} transition={{ duration: 3, repeat: Infinity }}><Drosophila size={44} /></motion.div>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4"><LifeCycleDiagram /></div>
        </div>
      </section>

      {/* Personas */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <SectionTitle kicker="Pour qui ?" title="Conçu pour le terrain" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { i: Tractor, t: 'Arboriculteur', d: 'Savoir si le filet ou la TIS est rentable face à la pression de vos bois voisins — sur PC ou tablette au verger.' },
            { i: Users, t: 'Conseiller technique', d: 'Comparer 2-3 scénarios en direct devant un producteur et lui envoyer un lien ou une fiche PDF.' },
            { i: FlaskConical, t: 'Expérimentateur', d: 'Paramétrer finement les leviers, lire les hypothèses du modèle, exporter les séries en CSV / JSON.' },
          ].map((p, k) => (
            <motion.div key={p.t} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: k * 0.08 }}
              className="flex gap-4 rounded-3xl bg-white/70 p-6 ring-1 ring-slate-200 backdrop-blur">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><p.i className="h-5 w-5" /></span>
              <div><h3 className="font-extrabold">{p.t}</h3><p className="mt-1 text-sm text-slate-600">{p.d}</p></div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Comparatif */}
      <section id="pourquoi" className="relative z-10 mx-auto max-w-5xl px-6 py-20">
        <SectionTitle kicker="Pourquoi une nouvelle plateforme ?" title="Tout ce qui manquait, enfin réuni" />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {[
            ['Saisie du verger', 'Glisser-déposer case par case', 'Pinceau, zone, remplissage, modèles'],
            ['Correction', 'Impossible, pas d’historique', 'Menu d’édition, gomme clic droit, Ctrl+Z (50 actions)'],
            ['Parcours', '3 écrans séparés', 'Cockpit unifié + aperçu temps réel'],
            ['Calcul', '0,7 s côté serveur', 'Quelques ms dans le navigateur'],
            ['Graphiques', 'Couleurs sans légende', 'Légendes cliquables, phénologie, interventions'],
            ['Décision', 'Aucun indicateur économique', 'CA sauvé, coûts, bilan, IFT, radar multicritère'],
            ['Partage', 'Icônes mystérieuses', 'Lien, JSON, CSV, Fiche Conseil PDF'],
          ].map(([k, a, b], i) => (
            <div key={k} className={`grid grid-cols-[1fr_1.2fr_1.5fr] gap-4 px-5 py-3.5 text-sm ${i % 2 ? 'bg-slate-50/60' : ''}`}>
              <span className="font-bold text-slate-800">{k}</span>
              <span className="flex items-center gap-2 text-slate-500"><X className="h-4 w-4 shrink-0 text-red-400" />{a}</span>
              <span className="flex items-center gap-2 font-semibold text-slate-800"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{b}</span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-800 to-slate-900 p-10 text-white shadow-2xl md:p-14">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-4xl font-semibold md:text-5xl">Prêt à protéger votre <em className="text-amber-200">récolte</em> ?</h2>
              <p className="mt-2 max-w-xl text-emerald-100">Gratuit, sans inscription, vos données restent dans votre navigateur.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => router.push('/simulator')} className="flex items-center gap-2 rounded-2xl bg-white px-6 py-4 font-bold text-slate-900 hover:bg-emerald-50"><Zap className="h-5 w-5 text-emerald-700" /> Lancer le simulateur</button>
              <button onClick={demo} className="flex items-center gap-2 rounded-2xl border border-white/30 px-6 py-4 font-bold hover:bg-white/10"><ShieldCheck className="h-5 w-5" /> Démo</button>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        DrosoSim Next — outil pédagogique d&apos;aide à la décision. Les résultats sont des ordres de grandeur issus d&apos;un modèle simplifié. · <Link href="/docs/limites" className="underline hover:text-slate-800">Limites du modèle</Link>
      </footer>
    </div>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-700">{kicker}</p>
      <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h2>
    </motion.div>
  );
}

/** Grille animée qui « se peint » puis montre l'invasion de mouches */
function HeroOrchard() {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(v => (v + 1) % 240), 50); return () => clearInterval(id); }, []);
  const order = (i: number) => ((i % 20) + Math.floor(i / 20)) * 1.6;
  return (
    <div className="relative mx-auto max-w-lg">
      <motion.div initial={{ opacity: 0, rotateX: 25, scale: 0.9 }} animate={{ opacity: 1, rotateX: 0, scale: 1 }} transition={{ duration: 0.9 }}
        className="rounded-[2rem] border border-white/60 bg-white/70 p-4 shadow-2xl shadow-emerald-900/10 backdrop-blur">
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /></div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Simulation temps réel</span>
        </div>
        <div className="grid aspect-square overflow-hidden rounded-2xl" style={{ gridTemplateColumns: 'repeat(20, 1fr)' }}>
          {HERO_GRID.map((c, i) => {
            const painted = t > order(i);
            const fly = c !== 'neutral' && t > 120 && ((i * 7919 + Math.floor(t / 6)) % 23 === 0) && (c === 'forest' || t > 150);
            return (
              <div key={i} className="relative border-[0.5px] border-white/50 transition-colors duration-300" style={{ backgroundColor: painted ? CELL_BG[c] : '#F1F5F9' }}>
                {fly && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-[30%] rounded-full bg-slate-900" />}
              </div>
            );
          })}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }}
        className="absolute -right-4 top-16 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-200 md:-right-10">
        <p className="text-[10px] font-bold uppercase text-slate-500">Récolte préservée</p>
        <p className="text-2xl font-extrabold text-emerald-700">94 %</p>
        <p className="text-[10px] font-bold text-emerald-600">+45 pts vs témoin</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 }}
        className="absolute -left-4 bottom-12 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-200 md:-left-10">
        <p className="text-[10px] font-bold uppercase text-slate-500">Bilan net / an</p>
        <p className="text-2xl font-extrabold text-slate-900">+12,4 k€</p>
        <div className="mt-1 flex h-6 items-end gap-0.5">{[30, 45, 38, 60, 72, 66, 85].map((h, k) => <motion.span key={k} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 1.3 + k * 0.05 }} className="w-2 rounded-sm bg-emerald-500" />)}</div>
      </motion.div>
    </div>
  );
}
