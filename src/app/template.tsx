'use client';
import { motion } from 'framer-motion';

/** Transition douce entre les pages (opacité seule : ne casse ni sticky ni fixed). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="flex min-h-full flex-1 flex-col">{children}</motion.div>;
}
