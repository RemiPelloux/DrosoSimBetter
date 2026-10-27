import { notFound } from 'next/navigation';
import { getDocs } from '@/lib/docs';
import { DocsShell } from '@/components/DocsShell';

export function generateStaticParams() {
  return getDocs().map(d => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = getDocs().find(x => x.slug === slug);
  return { title: d ? `${d.title} — Documentation DrosoSim Next` : 'Documentation' };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const docs = getDocs();
  const doc = docs.find(d => d.slug === slug);
  if (!doc) notFound();
  return <DocsShell doc={doc} nav={docs.map(({ slug, title, icon, order }) => ({ slug, title, icon, order }))} />;
}
