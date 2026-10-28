'use client';
import { MotionConfig } from 'framer-motion';

/** Toutes les animations framer-motion respectent le réglage système « réduire les animations ». */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
