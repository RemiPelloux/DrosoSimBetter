import Link from 'next/link';
import type { Metadata } from 'next';
import { Drosophila } from '@/components/illustrations';

export const metadata: Metadata = { title: 'Page introuvable' };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EE] px-6 text-center">
      <Drosophila size={72} />
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-emerald-700">Erreur 404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Cette page s&apos;est envolée</h1>
      <p className="mt-3 max-w-md text-sm text-slate-600">L&apos;adresse demandée n&apos;existe pas ou a été déplacée. Revenez au simulateur ou consultez la documentation.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/simulator" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">Ouvrir le simulateur</Link>
        <Link href="/docs/presentation" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Documentation</Link>
        <Link href="/" className="rounded-xl px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800">Accueil</Link>
      </div>
    </main>
  );
}
