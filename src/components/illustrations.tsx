'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';

// =============================================================================
// Illustrations SVG sur mesure — DrosoSim Next
// =============================================================================

/** Drosophila suzukii mâle stylisée (taches alaires caractéristiques), ailes animées. */
export function Drosophila({ size = 48, animate = true, className, spots = true }: { size?: number; animate?: boolean; className?: string; spots?: boolean }) {
  const wing = animate ? { rotate: [0, -18, 0, 14, 0] } : undefined;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-label="Drosophila suzukii">
      {/* ailes */}
      <motion.g style={{ originX: '32px', originY: '28px' }} animate={wing} transition={{ duration: 0.12, repeat: Infinity }}>
        <path d="M30 27 C 14 14, 4 22, 8 32 C 12 40, 24 36, 30 30 Z" fill="#E0F2FE" fillOpacity={0.75} stroke="#64748B" strokeWidth={1} />
        {spots && <circle cx="12" cy="24" r="3.2" fill="#1E293B" />}
      </motion.g>
      <motion.g style={{ originX: '34px', originY: '28px' }} animate={animate ? { rotate: [0, 18, 0, -14, 0] } : undefined} transition={{ duration: 0.12, repeat: Infinity }}>
        <path d="M34 27 C 50 14, 60 22, 56 32 C 52 40, 40 36, 34 30 Z" fill="#E0F2FE" fillOpacity={0.75} stroke="#64748B" strokeWidth={1} />
        {spots && <circle cx="52" cy="24" r="3.2" fill="#1E293B" />}
      </motion.g>
      {/* pattes */}
      <g stroke="#78350F" strokeWidth={1.4} strokeLinecap="round" fill="none">
        <path d="M28 36 l-7 5 M28 40 l-8 8 M29 44 l-5 9" />
        <path d="M36 36 l7 5 M36 40 l8 8 M35 44 l5 9" />
      </g>
      {/* abdomen rayé */}
      <ellipse cx="32" cy="42" rx="6.5" ry="10" fill="#B45309" />
      <path d="M26 41 h12 M26.5 45 h11 M28 49 h8" stroke="#451A03" strokeWidth={1.6} strokeLinecap="round" />
      {/* thorax */}
      <ellipse cx="32" cy="29" rx="6" ry="5.5" fill="#D97706" />
      {/* tête + yeux rouges */}
      <circle cx="32" cy="21" r="5" fill="#B45309" />
      <circle cx="28.6" cy="20" r="2.6" fill="#DC2626" />
      <circle cx="35.4" cy="20" r="2.6" fill="#DC2626" />
      <circle cx="28" cy="19.3" r="0.8" fill="#FECACA" />
      <circle cx="34.8" cy="19.3" r="0.8" fill="#FECACA" />
    </svg>
  );
}

/** Cerise double stylisée */
export function CherryArt({ size = 48, className, color = '#E11D48' }: { size?: number; className?: string; color?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
      <defs>
        <radialGradient id={`c${id}`} cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#fff" stopOpacity={0.55} /><stop offset="35%" stopColor={color} /><stop offset="100%" stopColor="#4C0519" /></radialGradient>
      </defs>
      <path d="M22 40 C 26 24, 32 14, 40 8 M44 38 C 42 26, 41 16, 40 8" stroke="#3F6212" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M40 8 C 48 4, 56 8, 58 14 C 50 16, 44 13, 40 8 Z" fill="#65A30D" />
      <circle cx="20" cy="46" r="11" fill={`url(#c${id})`} />
      <circle cx="45" cy="45" r="11" fill={`url(#c${id})`} />
    </svg>
  );
}

/** Logo : feuille + cerise + œil de drosophile */
export function Logo({ size = 36, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <motion.svg viewBox="0 0 48 48" width={size} height={size} whileHover={animated ? { rotate: -8, scale: 1.06 } : undefined} transition={{ type: 'spring', stiffness: 300 }}>
      <rect width="48" height="48" rx="13" fill="#047857" />
      <path d="M12 34 C 12 18, 24 10, 38 10 C 38 26, 28 36, 12 34 Z" fill="#10B981" />
      <path d="M13 34 C 20 26, 27 20, 36 12" stroke="#ECFDF5" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <motion.circle cx="33" cy="33" r="6.5" fill="#E11D48" stroke="#fff" strokeWidth={1.5}
        animate={animated ? { scale: [1, 1.12, 1] } : undefined} transition={{ duration: 2.4, repeat: Infinity }} />
      <circle cx="31" cy="31" r="1.6" fill="#fff" opacity={0.7} />
    </motion.svg>
  );
}

/** Essaim de drosophiles qui volent sur des trajectoires organiques */
export function FlyingFlies({ count = 5, className }: { count?: number; className?: string }) {
  const paths = [
    { x: ['0%', '30%', '62%', '90%', '45%', '0%'], y: ['20%', '5%', '30%', '15%', '60%', '20%'], d: 18 },
    { x: ['85%', '60%', '20%', '10%', '55%', '85%'], y: ['70%', '85%', '60%', '30%', '40%', '70%'], d: 22 },
    { x: ['40%', '70%', '80%', '35%', '15%', '40%'], y: ['90%', '65%', '35%', '20%', '75%', '90%'], d: 26 },
    { x: ['10%', '25%', '55%', '75%', '50%', '10%'], y: ['50%', '80%', '90%', '55%', '10%', '50%'], d: 20 },
    { x: ['70%', '95%', '75%', '40%', '60%', '70%'], y: ['10%', '45%', '75%', '50%', '20%', '10%'], d: 24 },
  ];
  return (
    <div className={`pointer-events-none absolute inset-0 ${className ?? ''}`} aria-hidden>
      {paths.slice(0, count).map((p, i) => (
        <motion.div key={i} className="absolute -translate-x-1/2 -translate-y-1/2"
          animate={{ left: p.x, top: p.y, rotate: [0, 25, -20, 15, -10, 0] }}
          transition={{ duration: p.d, repeat: Infinity, ease: 'easeInOut' }}>
          <motion.div animate={{ y: [0, -4, 0, 3, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
            <Drosophila size={22 + (i % 3) * 6} />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

/** Mouche qui « bourdonne » sur place (états vides, chargements) */
export function BuzzingFly({ size = 56 }: { size?: number }) {
  return (
    <motion.div animate={{ x: [0, 6, -5, 4, 0], y: [0, -5, 3, -2, 0], rotate: [0, 8, -6, 4, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} className="inline-block">
      <Drosophila size={size} />
    </motion.div>
  );
}

// =============================================================================
// Schémas pédagogiques (documentation)
// =============================================================================

const ArrowDefs = ({ id, color = '#475569' }: { id: string; color?: string }) => (
  <defs>
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill={color} />
    </marker>
  </defs>
);

/** Cycle biologique : œuf → larve → pupe → adulte, avec flux du modèle */
export function LifeCycleDiagram() {
  const id = useId().replace(/:/g, '');
  const stages = [
    { x: 300, y: 50, l: 'Œuf', s: 'pondu dans le fruit', c: '#FEF3C7', e: '🥚' },
    { x: 520, y: 170, l: 'Larve', s: 'se nourrit de la pulpe', c: '#FFEDD5', e: '🐛' },
    { x: 300, y: 290, l: 'Pupe', s: 'dans ou hors du fruit', c: '#FDE68A', e: '🫘' },
    { x: 80, y: 170, l: 'Adulte ♀', s: 'vit ~3-9 semaines', c: '#DCFCE7', e: '🪰' },
  ];
  return (
    <svg viewBox="-10 0 620 350" className="w-full" role="img" aria-label="Cycle biologique de D. suzukii">
      <ArrowDefs id={id} />
      <motion.circle cx="300" cy="170" r="118" fill="none" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="6 8"
        animate={{ strokeDashoffset: [0, -56] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
      <text x="300" y="160" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0F172A">Immatures S₁ → S₂ → S₃</text>
      <text x="300" y="180" textAnchor="middle" fontSize="11" fill="#475569">trois sous-stades (délai gamma)</text>
      <text x="300" y="198" textAnchor="middle" fontSize="11" fill="#475569">≈ 210 degrés-jours &gt; 8 °C</text>
      {[[360, 70, 500, 140], [500, 210, 360, 280], [240, 280, 100, 210], [100, 135, 240, 65]].map(([x1, y1, x2, y2], i) => (
        <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2 + (i % 2 ? -30 : 30)} ${(y1 + y2) / 2 + (i < 2 ? 0 : 0)} ${x2} ${y2}`} stroke="#475569" strokeWidth={2} fill="none" markerEnd={`url(#${id})`} />
      ))}
      {stages.map((s, i) => (
        <motion.g key={s.l} initial={{ scale: 0.8, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
          <rect x={s.x - 78} y={s.y - 32} width="156" height="64" rx="16" fill={s.c} stroke="#0F172A" strokeOpacity={0.15} />
          <text x={s.x - 66} y={s.y + 7} fontSize="22">{s.e}</text>
          <text x={s.x - 34} y={s.y - 3} fontSize="14" fontWeight="800" fill="#0F172A">{s.l}</text>
          <text x={s.x - 34} y={s.y + 14} fontSize="10" fill="#475569">{s.s}</text>
        </motion.g>
      ))}
      <text x="440" y="92" fontSize="11" fill="#B45309" fontWeight="700">ponte × survie des œufs</text>
      <text x="40" y="92" fontSize="11" fill="#15803D" fontWeight="700">émergence = 3·δ(T) × S₃</text>
    </svg>
  );
}

/** Déroulé d'un pas de temps journalier */
export function DailyStepDiagram() {
  const id = useId().replace(/:/g, '');
  const steps = [
    { t: '1. Climat', d: 'tables : T(j), ponte, développement, froid, chaleur', c: '#DBEAFE' },
    { t: '2. Traitements', d: 'déclenchement calendaire / seuil, DAR', c: '#FEF3C7' },
    { t: '3. Ressource & capacité', d: 'fruits, résidus, K du jour, filets actifs', c: '#FCE7F3' },
    { t: '4. Dynamique locale', d: 'ponte → dégâts → S₁ S₂ S₃ → émergence → mortalité', c: '#DCFCE7' },
    { t: '5. Dispersion', d: '8 voisines, pondérée, filets symétriques', c: '#EDE9FE' },
    { t: '6. Bilan du jour', d: 'récolte, pics, séries (tous les 3 j)', c: '#F1F5F9' },
  ];
  return (
    <svg viewBox="-44 0 764 236" className="w-full" role="img" aria-label="Pas de temps journalier">
      <ArrowDefs id={id} />
      {steps.map((s, i) => {
        const x = 10 + (i % 3) * 240, y = i < 3 ? 20 : 130;
        return (
          <motion.g key={s.t} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
            <rect x={x} y={y} width="200" height="78" rx="14" fill={s.c} stroke="#0F172A" strokeOpacity={0.12} />
            <text x={x + 14} y={y + 30} fontSize="14" fontWeight="800" fill="#0F172A">{s.t}</text>
            <foreignObject x={x + 14} y={y + 38} width="180" height="40"><p style={{ fontSize: 10.5, color: '#475569', lineHeight: 1.3, margin: 0 }}>{s.d}</p></foreignObject>
          </motion.g>
        );
      })}
      <path d="M212 59 H 246" stroke="#475569" strokeWidth={2} markerEnd={`url(#${id})`} />
      <path d="M452 59 H 486" stroke="#475569" strokeWidth={2} markerEnd={`url(#${id})`} />
      <path d="M570 99 V 127" stroke="#475569" strokeWidth={2} markerEnd={`url(#${id})`} />
      <path d="M486 169 H 452" stroke="#475569" strokeWidth={2} markerEnd={`url(#${id})`} />
      <path d="M246 169 H 212" stroke="#475569" strokeWidth={2} markerEnd={`url(#${id})`} />
      <motion.path d="M8 169 C -34 169, -34 59, 8 59" stroke="#10B981" strokeWidth={2.5} fill="none" strokeDasharray="5 5" markerEnd={`url(#${id})`}
        animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      <text x="360" y="225" textAnchor="middle" fontSize="11" fill="#047857" fontWeight="700">répété chaque jour, de 365 à 1 187 fois selon la durée</text>
    </svg>
  );
}

/** Voisinage de dispersion 3×3 */
export function NeighborhoodDiagram() {
  const id = useId().replace(/:/g, '');
  const w = [[0.25, 3, 3], [0.6, null, 3], [0.15, 0.15, 0.25]];
  const lab = [['Cerisier hors saison', 'Cerisier véraison', 'Cerisier véraison'], ['Forêt', 'Case source', 'Cerisier véraison'], ['Neutre', 'Neutre', 'Cerisier hors saison']];
  const col = (v: number | null) => (v === null ? '#0F172A' : v >= 3 ? '#E11D48' : v >= 0.5 ? '#15803D' : v >= 0.2 ? '#D97706' : '#CBD5E1');
  const sum = w.flat().reduce<number>((a, b) => a + (b ?? 0), 0);
  return (
    <svg viewBox="0 0 640 300" className="w-full" role="img" aria-label="Dispersion vers les 8 voisines">
      <ArrowDefs id={id} color="#0F172A" />
      {w.map((row, y) => row.map((v, x) => (
        <g key={`${x}${y}`}>
          <rect x={20 + x * 90} y={20 + y * 90} width="86" height="86" rx="10" fill={col(v)} fillOpacity={v === null ? 1 : 0.85} />
          <text x={63 + x * 90} y={56 + y * 90} textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff">{v === null ? 'A·D' : `×${v}`}</text>
          <foreignObject x={24 + x * 90} y={64 + y * 90} width="78" height="40"><p style={{ fontSize: 9, color: '#fff', textAlign: 'center', lineHeight: 1.15, margin: 0 }}>{lab[y][x]}</p></foreignObject>
          {v !== null && (
            <motion.line x1={153} y1={153} x2={63 + x * 90 + (x - 1) * -28} y2={63 + y * 90 + (y - 1) * -28} stroke="#0F172A" strokeWidth={Math.max(1, v)} markerEnd={`url(#${id})`}
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.1 * (x + y) }} />
          )}
        </g>
      )))}
      <g fontSize="12" fill="#334155">
        <text x="320" y="40" fontWeight="800" fontSize="14" fill="#0F172A">Règle de répartition</text>
        <text x="320" y="66">• Chaque jour, D = 12 % des femelles quittent la case</text>
        <text x="332" y="82">(3 % si T ≤ 10 °C).</text>
        <text x="320" y="106">• Part reçue par la voisine n :  w(n) / Σw</text>
        <text x="320" y="130">• Ici Σw = {sum.toFixed(2)} → une voisine en véraison</text>
        <text x="332" y="146">reçoit {(3 / sum * 100).toFixed(0)} % des émigrantes, la forêt {(0.6 / sum * 100).toFixed(0)} %.</text>
        <text x="320" y="172">• Filet actif sur la voisine : 70 % × efficacité</text>
        <text x="332" y="188">de la part est refoulée vers la case source.</text>
        <text x="320" y="214">• Effet net : les adultes « coulent » des zones</text>
        <text x="332" y="230">refuges vers les vergers mûrs.</text>
      </g>
    </svg>
  );
}

/** Frise phénologique annuelle avec courbe de pression type */
export function PhenologyTimeline() {
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const X = (doy: number) => 40 + (doy / 365) * 640;
  const bands = [
    { l: 'Précoce', a: 130, b: 158, c: '#D97706', y: 168 },
    { l: 'Saison', a: 150, b: 178, c: '#E11D48', y: 190 },
    { l: 'Tardive', a: 168, b: 200, c: '#991B1B', y: 212 },
  ];
  // courbe type de pression (forme indicative)
  const pts = Array.from({ length: 74 }, (_, i) => {
    const d = i * 5;
    const v = Math.exp(-Math.pow((d - 215) / 38, 2)) * 0.95 + Math.exp(-Math.pow((d - 290) / 45, 2)) * 0.35 + 0.04;
    return `${X(d)},${150 - v * 120}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 720 250" className="w-full" role="img" aria-label="Phénologie et pression">
      {months.map((m, i) => (
        <g key={i}>
          <line x1={X(i * 30.4)} y1={20} x2={X(i * 30.4)} y2={226} stroke="#E2E8F0" />
          <text x={X(i * 30.4 + 15)} y={244} textAnchor="middle" fontSize="11" fill="#64748B">{m}</text>
        </g>
      ))}
      {bands.map(b => <rect key={b.l} x={X(b.a)} y={20} width={X(b.b) - X(b.a)} height={135} fill={b.c} opacity={0.12} />)}
      <motion.polyline points={pts} fill="none" stroke="#0F172A" strokeWidth={2.5} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6 }} />
      <text x={X(222)} y={26} fontSize="11" fontWeight="700" fill="#0F172A">pic estival</text>
      <text x={X(282)} y={100} fontSize="10" fill="#475569">rebond post-récolte (résidus)</text>
      <line x1={40} y1={110} x2={680} y2={110} stroke="#DC2626" strokeDasharray="5 4" />
      <text x={684} y={113} fontSize="9" fill="#DC2626">seuil</text>
      {bands.map(b => (
        <g key={b.l}>
          <rect x={X(b.a)} y={b.y} width={X(b.b) - X(b.a)} height={16} rx={5} fill={b.c} />
          <text x={X(b.b) + 6} y={b.y + 12} fontSize="11" fontWeight="700" fill={b.c}>{b.l} : véraison → récolte</text>
        </g>
      ))}
      <text x={X(10)} y={40} fontSize="10" fill="#64748B">hivernage en forêt</text>
    </svg>
  );
}

/** Effet de chaque levier sur le cycle */
export function LeverMapDiagram() {
  const items = [
    { l: 'Filet', c: '#2563EB', on: 'accès aux fruits & immigration', x: 18 },
    { l: 'Traitement', c: '#D97706', on: 'mortalité des adultes', x: 158 },
    { l: 'Prophylaxie', c: '#0D9488', on: 'fruits résiduels post-récolte', x: 298 },
    { l: 'Parasitoïdes', c: '#7C3AED', on: 'survie des larves', x: 438 },
    { l: 'TIS', c: '#DB2777', on: 'fertilité des pontes', x: 578 },
  ];
  return (
    <svg viewBox="0 0 720 170" className="w-full" role="img" aria-label="Points d'action des leviers">
      <rect x="10" y="100" width="700" height="56" rx="14" fill="#F8FAFC" stroke="#E2E8F0" />
      {['Ressource', 'Adultes A', 'Ponte', 'Larves L', 'Fertilité'].map((t, i) => (
        <text key={t} x={100 + i * 140} y="134" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0F172A">{t}</text>
      ))}
      {items.map((it, i) => {
        const target = [100 + 140 * 2, 100 + 140, 100, 100 + 140 * 3, 100 + 140 * 4][i];
        return (
          <motion.g key={it.l} initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
            <rect x={it.x} y="6" width="124" height="60" rx="10" fill={it.c} />
            <text x={it.x + 62} y="26" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">{it.l}</text>
            <foreignObject x={it.x + 6} y="31" width="112" height="32"><p style={{ fontSize: 9, color: '#fff', textAlign: 'center', margin: 0, opacity: 0.92, lineHeight: 1.2 }}>{it.on}</p></foreignObject>
            <path d={`M${it.x + 62} 66 C ${it.x + 62} 84, ${target} 78, ${target} 98`} stroke={it.c} strokeWidth={2} fill="none" strokeDasharray="4 3" />
          </motion.g>
        );
      })}
    </svg>
  );
}

/** Chaîne de calcul économique */
export function EconomicsDiagram() {
  const id = useId().replace(/:/g, '');
  const box = (x: number, y: number, w: number, t: string, s: string, c: string) => (
    <g>
      <rect x={x} y={y} width={w} height="58" rx="12" fill={c} stroke="#0F172A" strokeOpacity={0.1} />
      <text x={x + w / 2} y={y + 25} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0F172A">{t}</text>
      <text x={x + w / 2} y={y + 43} textAnchor="middle" fontSize="10" fill="#475569">{s}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 720 220" className="w-full" role="img" aria-label="Chaîne de calcul économique">
      <ArrowDefs id={id} />
      {box(10, 20, 170, '% fruits sains', 'issu de la simulation', '#DCFCE7')}
      {box(10, 140, 170, 'Surface × rdt × prix', 'hypothèses éditables', '#DBEAFE')}
      {box(250, 80, 160, 'CA stratégie', '− CA du témoin', '#FEF3C7')}
      {box(250, 160, 160, 'Coûts leviers', 'filets, MO, intrants', '#FFE4E6')}
      {box(480, 80, 220, 'Bilan net = CA sauvé − coûts', 'ROI = CA sauvé / coûts', '#0F172A')}
      <text x="590" y="105" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">Bilan net = CA sauvé − coûts</text>
      <text x="590" y="123" textAnchor="middle" fontSize="10" fill="#CBD5E1">ROI = CA sauvé / coûts</text>
      <path d="M180 49 C 220 49, 215 100, 248 105" stroke="#475569" strokeWidth={2} fill="none" markerEnd={`url(#${id})`} />
      <path d="M180 169 C 220 169, 215 115, 248 112" stroke="#475569" strokeWidth={2} fill="none" markerEnd={`url(#${id})`} />
      <path d="M410 109 H 478" stroke="#475569" strokeWidth={2} markerEnd={`url(#${id})`} />
      <path d="M410 189 C 450 189, 450 125, 478 118" stroke="#475569" strokeWidth={2} fill="none" markerEnd={`url(#${id})`} />
    </svg>
  );
}

export const DIAGRAMS: Record<string, React.ComponentType> = {
  'cycle': LifeCycleDiagram,
  'pas-de-temps': DailyStepDiagram,
  'voisinage': NeighborhoodDiagram,
  'phenologie': PhenologyTimeline,
  'leviers': LeverMapDiagram,
  'economie': EconomicsDiagram,
};
