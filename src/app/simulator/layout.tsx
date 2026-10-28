import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verger & leviers',
  description: 'Dessinez vos parcelles de cerisiers et d’espaces naturels, puis composez des stratégies de protection levier par levier. La simulation se recalcule à chaque modification.',
};

export default function SimulatorLayout({ children }: { children: React.ReactNode }) { return children; }
