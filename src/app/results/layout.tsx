import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Résultats & comparateur',
  description: 'Verdict, classement des stratégies, dynamique des populations, bilan économique, carte de pression et recommandations : le comparatif complet face au témoin sans protection.',
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) { return children; }
