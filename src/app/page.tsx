'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { useGridStore, buildTemplate } from '@/lib/store';
import { simulate, detectParcels, defaultLeverConfig, isCherry, type LeverConfig } from '@/lib/engine';
import { Logo, FlyingFlies, Drosophila, CherryArt, LifeCycleDiagram } from '@/components/illustrations';
import { CountUp, Grain, Contours, IsoOrchard, HillsBackdrop, RingGauge, Sparkline } from '@/components/art';
import { cn } from '@/lib/utils';
import {
  ArrowRight, PlayCircle, Paintbrush, SlidersHorizontal, BarChart3, Share2, Tractor, Users, FlaskConical,
  Check, X, Sparkles, MousePointerClick, Timer, Trophy, Leaf, BookOpen, Zap,
} from 'lucide-react';
import { IconNet, IconFly } from '@/components/icons';

// --------------------------------------------------------------- Démo réelle (calculée par le moteur)
const DEMO_GRID = buildTemplate('mixed');
function useDemoRun() {
  return useMemo(() => {
    const parcels = detectParcels(DEMO_GRID);
    const lv = (o: Partial<LeverConfig>) => ({ ...defaultLeverConfig, ...o });
    const pbi: Record<string, LeverConfig> = {};
    parcels.forEach(p => {
      if (isCherry(p.type)) pbi[p.id] = lv({ prophylaxis: true, netting: p.type === 'late-cherry', tis: p.type !== 'late-cherry' });
      else pbi[p.id] = lv({ parasitoids: true });
    });
    const out = simulate(DEMO_GRID, parcels, [
      { id: 'base', name: 'Sans protection', isBaseline: true, leversByParcel: {} },
      { id: 'pbi', name: 'Protection intégrée', isBaseline: false, leversByParcel: pbi },
    ], { startSeason: 'spring', durationYears: 2, climateProfile: 'mild-winter' }, { yieldTPerHa: 10, pricePerKg: 3.5, cellAreaM2: 100 });
    const [base, pbiR] = out.results;
    return { base, pbi: pbiR, max: Math.max(...Array.from(base.peakByCell), 1), ms: out.computeMs };
  }, []);
}

export default function LandingPage() {
  const router = useRouter();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const hasProject = useGridStore(s => s.grid.some(c => c !== 'neutral'));
  const demoRun = useDemoRun();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 120]);
  const heroFade = useTransform(scrollY, [0, 500], [1, 0.2]);

  const demo = () => { useGridStore.getState().loadDemo(); useGridStore.getState().setOnboardingDone(true); router.push('/results'); };
  const start = () => router.push('/simulator');

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F4EE] text-slate-900">
      {/* ================================================================ HERO */}
      <section className="relative min-h-[100svh] overflow-hidden bg-[#03241C] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(16,185,129,.38),transparent_55%),radial-gradient(ellipse_at_90%_80%,rgba(244,63,94,.2),transparent_50%)]" />
        <Contours className="absolute inset-0 h-full w-full" color="#6EE7B7" />
        <Grain opacity={0.13} />
        <FlyingFlies count={5} className="opacity-60" />

        <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5"><Logo size={40} /><span className="text-xl font-extrabold tracking-tight">DrosoSim<span className="text-emerald-300">Next</span></span></Link>
          <div className="flex items-center gap-1">
            {[['#fonctionnement', 'Fonctionnement'], ['#modele', 'Le modèle'], ['#pourquoi', 'Pourquoi']].map(([h, l]) => (
              <a key={h} href={h} className="hidden rounded-full px-4 py-2 text-sm font-semibold text-emerald-50/80 hover:bg-white/10 hover:text-white md:block">{l}</a>
            ))}
            <Link href="/docs/presentation" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-emerald-50/80 hover:bg-white/10 hover:text-white md:block">Documentation</Link>
            <button onClick={start} className="ml-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg hover:bg-emerald-50">Ouvrir le simulateur</button>
          </div>
        </nav>

        <motion.div style={{ y: heroY, opacity: heroFade }} className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-6 pb-40 pt-6 lg:grid-cols-[1fr_1.1fr] lg:pt-12">
          <div>
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-emerald-100 ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Protection intégrée contre <em className="font-display text-sm">Drosophila suzukii</em>
            </motion.span>
            <h1 className="font-display mt-7 text-[56px] font-semibold leading-[0.98] tracking-tight md:text-[84px]">
              {['Le verger,', 'simulé.'].map((w, i) => (
                <motion.span key={w} className={cn('block', i === 1 && 'italic text-emerald-300')} initial={{ opacity: 0, y: 40, rotateX: 40 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.1 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>{w}</motion.span>
              ))}
              {['La décision,', 'éclairée.'].map((w, i) => (
                <motion.span key={w} className={cn('block', i === 1 && 'bg-gradient-to-r from-amber-200 to-rose-300 bg-clip-text italic text-transparent')} initial={{ opacity: 0, y: 40, rotateX: 40 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.34 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>{w}</motion.span>
              ))}
            </h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-7 max-w-lg text-lg leading-relaxed text-emerald-50/75">
              Dessinez votre parcellaire en 10 secondes, combinez filets, prophylaxie, biocontrôle, parasitoïdes ou TIS, et lisez instantanément l&apos;impact sur la récolte, le revenu et l&apos;IFT.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="mt-9 flex flex-wrap gap-3">
              <button onClick={start} className="group flex h-14 items-center gap-2 rounded-2xl bg-white px-7 text-base font-bold text-slate-900 shadow-2xl shadow-emerald-950/40 transition-transform hover:-translate-y-0.5">
                {mounted && hasProject ? 'Reprendre mon verger' : 'Dessiner mon verger'} <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={demo} className="flex h-14 items-center gap-2 rounded-2xl bg-white/10 px-6 text-base font-bold ring-1 ring-white/25 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/15">
                <PlayCircle className="h-5 w-5 text-emerald-300" /> Voir la démo
              </button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-emerald-50/70">
              <span className="flex items-center gap-2"><Timer className="h-4 w-4 text-emerald-300" />Calcul en quelques ms</span>
              <span className="flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-emerald-300" />Sans compte</span>
              <span className="flex items-center gap-2"><Share2 className="h-4 w-4 text-emerald-300" />Partage par lien</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15 }} className="mt-8">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-200/60">Avec la recherche et la filière</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 lg:flex-nowrap">
                {PARTNERS.map((p, i) => (
                  <motion.a key={p.name} href={p.link} target="_blank" rel="noopener noreferrer" title={p.desc}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 + i * 0.06 }} whileHover={{ y: -3 }}
                    className="flex h-12 w-[74px] items-center justify-center rounded-xl bg-white/95 px-2 py-1.5 shadow-lg shadow-black/20 ring-1 ring-white/20 transition-colors hover:bg-white">
                    <Image src={p.logo} alt={p.name} width={p.w} height={p.h} className="max-h-9 w-auto max-w-full object-contain" />
                  </motion.a>
                ))}
              </div>
            </motion.div>
          </div>

          <HeroOrchard run={demoRun} />
        </motion.div>

        <HillsBackdrop className="absolute inset-x-0 bottom-0 h-44 w-full" />
        <motion.a href="#chiffres" animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-200/70">Découvrir ↓</motion.a>
      </section>

      {/* ================================================================ CHIFFRES */}
      <section id="chiffres" className="relative border-b border-slate-200/70 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-slate-100 md:grid-cols-4">
          {[
            { v: 400, s: '', l: 'cases simulées chaque jour', d: 0 },
            { v: demoRun.ms, s: ' ms', l: 'pour 2 stratégies sur 2 ans', d: 0 },
            { v: 5, s: '', l: 'leviers combinables', d: 0 },
            { v: demoRun.pbi.globalHarvest - demoRun.base.globalHarvest, s: ' pts', l: 'de récolte sauvée (démo)', d: 0, plus: true },
          ].map((k, i) => (
            <motion.div key={k.l} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="px-6 py-10 text-center">
              <p className="font-display text-5xl font-semibold text-slate-900 md:text-6xl"><CountUp value={k.v} suffix={k.s} signed={k.plus} /></p>
              <p className="mt-2 text-sm font-medium text-slate-500">{k.l}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ================================================================ 3 GESTES */}
      <section id="fonctionnement" className="relative mx-auto max-w-7xl px-6 py-28">
        <SectionTitle n="01" kicker="En trois gestes" title={<>Du dessin à la <em className="text-emerald-700">décision</em></>} />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <StepCard i={0} icon={Paintbrush} title="Dessinez" text="Pinceau, zone, remplissage, gomme au clic droit et modèles prêts à l'emploi. Les parcelles se forment et se nomment toutes seules." art={<PaintArt />} />
          <StepCard i={1} icon={SlidersHorizontal} title="Combinez" text="Cinq leviers par parcelle, réglages fins, « Appliquer à toutes » en un clic. Climat, durée, hypothèses économiques." art={<LeverArt />} />
          <StepCard i={2} icon={BarChart3} title="Décidez" text="Verdict, classement, courbes légendées, carte de pression, bilan en euros et Fiche Conseil PDF à partager." art={<DecideArt run={demoRun} />} />
        </div>
      </section>

      {/* ================================================================ APERÇU VERDICT */}
      <section className="relative overflow-hidden bg-white py-28">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2">
          <div>
            <SectionTitle n="02" kicker="Lisible en un coup d'œil" title={<>Des résultats qui <em className="text-emerald-700">parlent</em> au verger</>} align="left" />
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">Fini les courbes muettes : chaque graphique est légendé, chaque levier chiffré. Le témoin sans protection est toujours calculé pour mesurer le gain réel.</p>
            <ul className="mt-8 space-y-3">
              {['Récolte préservée et gain en points vs témoin', 'Bilan net en euros, coûts éditables, ROI', 'Pic de pression, IFT chimique, heures de travail', 'Périodes de maturité et interventions sur les courbes'].map(t => (
                <li key={t} className="flex items-center gap-3 text-slate-700"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-3.5 w-3.5" /></span>{t}</li>
              ))}
            </ul>
            <button onClick={demo} className="mt-10 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-bold text-white hover:bg-slate-800"><PlayCircle className="h-5 w-5" /> Explorer les résultats de la démo</button>
          </div>
          <VerdictPreview run={demoRun} />
        </div>
      </section>

      {/* ================================================================ MODÈLE */}
      <section id="modele" className="relative mx-auto max-w-7xl px-6 py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionTitle n="03" kicker="Sous le capot" title={<>Un modèle biologique <em className="text-emerald-700">transparent</em></>} align="left" />
            <p className="mt-6 text-lg leading-relaxed text-slate-600">Chaque jour, sur 400 cases : température, ponte selon la maturité des fruits, développement en degrés-jours, mortalité, dispersion vers les vergers attractifs. Chaque stratégie est simulée intégralement.</p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[['Équations documentées', BookOpen], ['Effet de chaque levier', IconNet], ['Économie détaillée', Leaf], ['Limites assumées', IconFly]].map(([t, I]) => {
                const Icon = I as React.ElementType;
                return <div key={t as string} className="ico-host flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><Icon className="h-5 w-5 text-emerald-700" /><span className="text-sm font-semibold text-slate-700">{t as string}</span></div>;
              })}
            </div>
            <div className="mt-8 flex items-center gap-5">
              <Link href="/docs/modele" className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-6 py-4 font-bold text-white hover:bg-emerald-800">Lire la documentation <ArrowRight className="h-4 w-4" /></Link>
              <CherryArt size={46} />
              <motion.div animate={{ x: [0, 10, -6, 0], y: [0, -6, 4, 0] }} transition={{ duration: 3, repeat: Infinity }}><Drosophila size={46} /></motion.div>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="rounded-[32px] border border-white bg-white p-6 shadow-[0_40px_80px_-40px_rgba(2,44,34,.35)]">
            <LifeCycleDiagram />
          </motion.div>
        </div>
      </section>

      {/* ================================================================ PERSONAS */}
      <section className="relative bg-[#03241C] py-28 text-white">
        <Contours className="absolute inset-0 h-full w-full" color="#6EE7B7" />
        <Grain opacity={0.12} />
        <div className="relative mx-auto max-w-7xl px-6">
          <SectionTitle n="04" kicker="Pour qui ?" title={<>Conçu pour le <em className="text-amber-200">terrain</em></>} dark />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              { i: Tractor, t: 'Arboriculteur', q: '« Le filet sur ma tardive est-il rentable face au bois voisin ? »', d: 'Sur PC au bureau ou sur tablette au verger, lisible en plein soleil.' },
              { i: Users, t: 'Conseiller technique', q: '« Je compare trois scénarios en direct devant le producteur. »', d: 'Puis j’envoie un lien ou une Fiche Conseil PDF en un clic.' },
              { i: FlaskConical, t: 'Expérimentateur', q: '« Je veux voir les hypothèses et exporter les séries. »', d: 'Réglages fins, documentation complète, CSV et JSON.' },
            ].map((p, k) => (
              <motion.div key={p.t} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: k * 0.1 }}
                className="rounded-[28px] bg-white/[.06] p-7 ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-white/[.09]">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/20"><p.i className="h-6 w-6" /></span>
                <h3 className="mt-5 text-xl font-bold">{p.t}</h3>
                <p className="font-display mt-3 text-lg italic leading-snug text-emerald-50/90">{p.q}</p>
                <p className="mt-3 text-sm text-emerald-50/60">{p.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ COMPARATIF */}
      <section id="pourquoi" className="mx-auto max-w-5xl px-6 py-28">
        <SectionTitle n="05" kicker="Pourquoi une nouvelle plateforme ?" title={<>Tout ce qui manquait, <em className="text-emerald-700">enfin réuni</em></>} />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-12 overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_30px_60px_-35px_rgba(2,44,34,.3)]">
          <div className="grid grid-cols-[1fr_1.2fr_1.5fr] gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500"><span /><span>Avant</span><span className="text-emerald-700">DrosoSim Next</span></div>
          {[
            ['Saisie du verger', 'Glisser-déposer case par case', 'Pinceau, zone, remplissage, modèles'],
            ['Correction', 'Impossible, pas d’historique', 'Menu d’édition, gomme clic droit, Ctrl+Z'],
            ['Parcours', '3 écrans séparés', 'Cockpit unifié + aperçu temps réel'],
            ['Calcul', '≈ 0,7 s côté serveur', 'Quelques ms dans le navigateur'],
            ['Graphiques', 'Couleurs sans légende', 'Légendes, phénologie, interventions'],
            ['Décision', 'Aucun indicateur économique', 'Bilan net, ROI, IFT, radar multicritère'],
            ['Partage', 'Icônes mystérieuses', 'Lien, JSON, CSV, Fiche Conseil PDF'],
          ].map(([k, a, b], i) => (
            <motion.div key={k} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="grid grid-cols-[1fr_1.2fr_1.5fr] items-center gap-4 border-b border-slate-50 px-6 py-4 text-sm last:border-0">
              <span className="font-bold text-slate-800">{k}</span>
              <span className="flex items-center gap-2 text-slate-400"><X className="h-4 w-4 shrink-0 text-rose-300" />{a}</span>
              <span className="flex items-center gap-2 font-semibold text-slate-800"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{b}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ================================================================ CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative overflow-hidden rounded-[40px] bg-[#03241C] px-8 py-16 text-white shadow-2xl md:px-16">
          <Contours className="absolute inset-0 h-full w-full" color="#FCD34D" />
          <Grain opacity={0.12} />
          <FlyingFlies count={3} className="opacity-60" />
          <div className="relative grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 className="font-display text-5xl font-semibold leading-tight md:text-6xl">Prêt à protéger votre <em className="text-amber-200">récolte</em> ?</h2>
              <p className="mt-4 max-w-lg text-lg text-emerald-50/70">Gratuit, sans inscription. Vos données restent dans votre navigateur.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={start} className="flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-bold text-slate-900 hover:bg-emerald-50"><Zap className="h-5 w-5 text-emerald-700" /> Lancer le simulateur</button>
                <button onClick={demo} className="flex items-center gap-2 rounded-2xl px-7 py-4 font-bold ring-1 ring-white/30 hover:bg-white/10"><PlayCircle className="h-5 w-5" /> Voir la démo</button>
              </div>
            </div>
            <div className="hidden md:block"><IsoOrchard grid={DEMO_GRID} heat={demoRun.pbi.peakByCell} max={demoRun.max} className="w-full drop-shadow-2xl" flies={false} /></div>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-slate-200 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 md:flex-row">
          <span className="flex items-center gap-2"><Logo size={24} animated={false} /> DrosoSim Next — outil pédagogique d&apos;aide à la décision</span>
          <span className="flex items-center gap-4">
            {PARTNERS.map(p => <a key={p.name} href={p.link} target="_blank" rel="noopener noreferrer" title={p.desc} className="opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"><Image src={p.logo} alt={p.name} width={p.w} height={p.h} className="h-6 w-auto object-contain" /></a>)}
          </span>
          <span className="flex gap-5"><Link href="/docs/presentation" className="hover:text-slate-900">Documentation</Link><Link href="/docs/limites" className="hover:text-slate-900">Limites du modèle</Link><Link href="/simulator" className="hover:text-slate-900">Simulateur</Link></span>
        </div>
      </footer>
    </div>
  );
}

// ======================================================================= Partenaires
const PARTNERS = [
  { name: 'République Française', desc: 'République Française', logo: '/partners/republique-francaise.png', link: 'https://www.info.gouv.fr/', w: 392, h: 342 },
  { name: 'INRAE', desc: "Institut national de recherche pour l'agriculture, l'alimentation et l'environnement — équipe M2P2, Sophia Antipolis", logo: '/partners/INRAE.png', link: 'https://inrae.fr', w: 300, h: 79 },
  { name: 'CTIFL', desc: 'Centre Technique Interprofessionnel des Fruits et Légumes', logo: '/partners/CTIFL.png', link: 'https://ctifl.fr', w: 470, h: 590 },
  { name: "Univ Côte d'Azur", desc: "Université Côte d'Azur", logo: '/partners/univ-cote-azur.png', link: 'https://univ-cotedazur.fr/', w: 400, h: 340 },
  { name: 'Ecophyto', desc: 'Plan Écophyto', logo: '/partners/Ecophyto.png', link: 'https://agriculture.gouv.fr/le-plan-ecophyto-quest-ce-que-cest', w: 960, h: 422 },
  { name: 'OFB', desc: 'Office Français de la Biodiversité', logo: '/partners/OFB.png', link: 'https://ofb.gouv.fr/', w: 464, h: 615 },
];

// ======================================================================= Composants
type Run = ReturnType<typeof useDemoRun>;

function HeroOrchard({ run }: { run: Run }) {
  const [view, setView] = useState<'base' | 'pbi'>('base');
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setView(v => (v === 'base' ? 'pbi' : 'base')), 3800);
    return () => clearInterval(t);
  }, [auto]);
  const r = view === 'base' ? run.base : run.pbi;
  const gain = run.pbi.revenue - run.base.revenue - run.pbi.totalCost;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9, rotateX: 25 }} animate={{ opacity: 1, scale: 1, rotateX: 0 }} transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} className="relative">
      <div className="absolute inset-x-12 bottom-8 h-20 rounded-full bg-black/45 blur-3xl" />
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
        <IsoOrchard grid={DEMO_GRID} heat={r.peakByCell} max={run.max} className="relative w-full drop-shadow-2xl" />
      </motion.div>
      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 rounded-full bg-black/35 p-1 ring-1 ring-white/15 backdrop-blur">
        {(['base', 'pbi'] as const).map(v => (
          <button key={v} onClick={() => { setAuto(false); setView(v); }} className={cn('relative rounded-full px-4 py-1.5 text-xs font-bold transition-colors', view === v ? 'text-slate-900' : 'text-white/70 hover:text-white')}>
            {view === v && <motion.span layoutId="heroToggle" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
            <span className="relative">{v === 'base' ? 'Sans protection' : 'Protection intégrée'}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.35 }}
          className="absolute -left-2 bottom-10 w-56 rounded-2xl bg-white/95 p-4 text-slate-900 shadow-2xl md:-left-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{view === 'base' ? 'Sans protection' : 'Protection intégrée'}</p>
          <div className="mt-2 flex items-center gap-3">
            <RingGauge value={r.globalHarvest} size={64} stroke={7} color={view === 'base' ? '#E11D48' : '#10B981'}>
              <span className="font-display text-lg font-semibold">{r.globalHarvest.toFixed(0)}</span>
            </RingGauge>
            <div>
              <p className="text-[11px] text-slate-500">de récolte saine</p>
              {view === 'pbi' ? <p className="font-display text-xl font-semibold text-emerald-700">+{(gain / 1000).toFixed(1)} k€<span className="text-xs font-normal text-slate-500"> /an</span></p> : <p className="font-display text-xl font-semibold text-rose-600">{(run.base.peakDensity / 1000).toFixed(0)} k<span className="text-xs font-normal text-slate-500"> ♀/ha</span></p>}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-3 right-2 flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2 text-[10px] font-semibold text-white/80 ring-1 ring-white/10 backdrop-blur">
        Pression <span className="h-2 w-20 rounded-full" style={{ background: 'linear-gradient(90deg,#FEF08A,#F97316,#BE123C)' }} />
      </div>
      <p className="absolute -bottom-6 right-2 text-[10px] text-emerald-100/50">Calcul réel du moteur · verger de démonstration · 2 ans</p>
    </motion.div>
  );
}

function SectionTitle({ n, kicker, title, align = 'center', dark }: { n: string; kicker: string; title: React.ReactNode; align?: 'center' | 'left'; dark?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className={align === 'center' ? 'text-center' : ''}>
      <p className={cn('flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.3em]', align === 'center' && 'justify-center', dark ? 'text-emerald-300' : 'text-emerald-700')}>
        <span className="font-display text-base italic tracking-normal">{n}</span><span className={cn('h-px w-8', dark ? 'bg-emerald-300/50' : 'bg-emerald-700/40')} />{kicker}
      </p>
      <h2 className={cn('font-display mt-4 text-4xl font-semibold leading-tight tracking-tight md:text-6xl', dark ? 'text-white' : 'text-slate-900')}>{title}</h2>
    </motion.div>
  );
}

function StepCard({ i, icon: Icon, title, text, art }: { i: number; icon: React.ElementType; title: string; text: string; art: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} whileHover={{ y: -6 }}
      className="group relative overflow-hidden rounded-[32px] border border-white bg-white shadow-[0_30px_60px_-35px_rgba(2,44,34,.3)]">
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#F3EEDF] to-emerald-50">{art}</div>
      <div className="p-7">
        <div className="flex items-center gap-3">
          <span className="font-display text-4xl font-black italic text-emerald-700/20">0{i + 1}</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white"><Icon className="h-5 w-5" /></span>
          <h3 className="font-display text-2xl font-semibold">{title}</h3>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{text}</p>
      </div>
    </motion.div>
  );
}

/** Mini-animation : la grille se peint toute seule */
function PaintArt() {
  const g = useMemo(() => buildTemplate('enclosed'), []);
  const COL: Record<string, string> = { neutral: '#EDE7D6', forest: '#2F6B3A', 'early-cherry': '#D97706', 'season-cherry': '#E11D48', 'late-cherry': '#991B1B' };
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="grid h-40 w-40 rotate-[-6deg] overflow-hidden rounded-xl shadow-xl ring-4 ring-white" style={{ gridTemplateColumns: 'repeat(20,1fr)' }}>
        {g.map((t, k) => (
          <motion.div key={k} initial={{ backgroundColor: '#EDE7D6' }} whileInView={{ backgroundColor: COL[t] }} viewport={{ once: true }}
            transition={{ delay: 0.3 + ((k % 20) + Math.floor(k / 20)) * 0.035, duration: 0.25 }} />
        ))}
      </div>
      <motion.div className="absolute" initial={{ x: -60, y: 50 }} whileInView={{ x: 60, y: -40 }} viewport={{ once: true }} transition={{ duration: 1.6, delay: 0.3, ease: 'easeInOut' }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl"><Paintbrush className="h-5 w-5" /></span>
      </motion.div>
    </div>
  );
}

/** Mini-animation : interrupteurs de leviers */
function LeverArt() {
  const items = [['Filet', '#2563EB'], ['Prophylaxie', '#0D9488'], ['Parasitoïdes', '#7C3AED'], ['TIS', '#DB2777']];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2.5 px-10">
      {items.map(([l, c], k) => (
        <motion.div key={l} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 * k }}
          className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
          <span className="text-sm font-semibold text-slate-700">{l}</span>
          <span className="relative h-5 w-9 rounded-full bg-slate-200">
            <motion.span className="absolute inset-0 rounded-full" style={{ backgroundColor: c }} initial={{ opacity: 0 }} whileInView={{ opacity: k === 2 ? 0 : 1 }} viewport={{ once: true }} transition={{ delay: 0.6 + 0.2 * k }} />
            <motion.span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow" initial={{ left: 2 }} whileInView={{ left: k === 2 ? 2 : 18 }} viewport={{ once: true }} transition={{ delay: 0.6 + 0.2 * k, type: 'spring', stiffness: 400, damping: 25 }} />
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/** Mini-animation : courbes témoin vs stratégie */
function DecideArt({ run }: { run: Run }) {
  const a = run.base.series.map(p => Number(p.cherry_all) || 0);
  const b = run.pbi.series.map(p => Number(p.cherry_all) || 0);
  const max = Math.max(...a, ...b, 1);
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 px-8">
      <div className="flex items-center justify-between text-[11px] font-bold"><span className="text-rose-600">● Sans protection</span><span className="text-emerald-700">● Protection intégrée</span></div>
      <div className="relative h-28 rounded-xl bg-white p-2 shadow-sm">
        <Sparkline data={a} max={max} color="#E11D48" width={300} height={96} className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" />
        <Sparkline data={b} max={max} color="#10B981" width={300} height={96} className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" />
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-white">
        <Trophy className="h-4 w-4 text-amber-300" /><span className="text-xs font-bold">Protection intégrée</span>
        <span className="font-display ml-auto text-sm">{run.pbi.globalHarvest.toFixed(0)} % récolte</span>
      </div>
    </div>
  );
}

/** Aperçu stylisé de la page de résultats */
function VerdictPreview({ run }: { run: Run }) {
  const gain = run.pbi.revenue - run.base.revenue - run.pbi.totalCost;
  return (
    <motion.div initial={{ opacity: 0, y: 30, rotate: 2 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative">
      <div className="overflow-hidden rounded-[32px] bg-[#03241C] p-7 text-white shadow-[0_50px_100px_-40px_rgba(2,44,34,.6)]">
        <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-300"><Trophy className="h-3.5 w-3.5" /> Verdict</p>
        <p className="font-display mt-2 text-4xl font-semibold">Protection <em className="text-emerald-300">intégrée</em></p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[[`${run.pbi.globalHarvest.toFixed(0)} %`, 'récolte'], [`+${(gain / 1000).toFixed(1)} k€`, 'bilan / an'], [`${run.pbi.ift.toFixed(1)}`, 'IFT']].map(([v, l]) => (
            <div key={l} className="rounded-2xl bg-white/[.07] p-3 ring-1 ring-white/10"><p className="font-display text-2xl font-semibold">{v}</p><p className="text-[10px] uppercase tracking-wider text-emerald-200/60">{l}</p></div>
          ))}
        </div>
      </div>
      <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
        className="relative -mt-8 ml-10 rounded-[28px] border border-white bg-white p-5 shadow-2xl">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Récolte saine par parcelle</p>
        <div className="flex h-32 items-stretch gap-5">
          {Object.keys(run.base.harvestByParcel).map(pid => (
            <div key={pid} className="flex h-full flex-1 items-end justify-center gap-2">
              {[run.base.harvestByParcel[pid], run.pbi.harvestByParcel[pid]].map((v, k) => (
                <div key={k} className="flex h-full w-6 flex-col justify-end">
                  <span className={cn('mb-1 text-center text-[9px] font-bold', k ? 'text-emerald-700' : 'text-slate-400')}>{Math.round(Number(v))}%</span>
                  <motion.div className={cn('w-full rounded-t-md', k === 0 ? 'bg-[repeating-linear-gradient(45deg,#CBD5E1_0_3px,#94A3B8_3px_6px)]' : 'bg-gradient-to-t from-emerald-600 to-emerald-400')}
                    initial={{ height: 0 }} whileInView={{ height: `${Math.max(2, Number(v) * 0.8)}%` }} viewport={{ once: true }} transition={{ delay: 0.5 + k * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-around text-[10px] font-semibold text-slate-500"><span>Précoce</span><span>Tardive</span><span>Saison</span></div>
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500"><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[repeating-linear-gradient(45deg,#CBD5E1_0_2px,#94A3B8_2px_4px)]" />Sans protection</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Protection intégrée</span></div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.6 }}
        className="absolute -right-3 -top-5 flex items-center gap-2 rounded-2xl bg-amber-300 px-4 py-2 text-sm font-black text-amber-950 shadow-xl">
        <Trophy className="h-4 w-4" /> +{(run.pbi.globalHarvest - run.base.globalHarvest).toFixed(0)} pts vs témoin
      </motion.div>
    </motion.div>
  );
}
