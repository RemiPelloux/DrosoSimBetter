'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import { animate, motion, useInView } from 'framer-motion';
import type { CellType } from '@/lib/engine';
import { cn } from '@/lib/utils';

// =============================================================================
// Direction artistique — DrosoSim Next
// =============================================================================

/** Nombre qui « monte » à l'affichage (et se ré-anime quand la valeur change) */
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', className, duration = 1.1, signed = false }: {
  value: number; decimals?: number; prefix?: string; suffix?: string; className?: string; duration?: number; signed?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const from = useRef(0);
  const fmt = (v: number) => {
    const s = Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${signed && v > 0 ? '+' : v < 0 ? '−' : ''}${prefix}${s}${suffix}`;
  };
  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const c = animate(from.current, value, {
      duration, ease: [0.16, 1, 0.3, 1],
      onUpdate: v => { node.textContent = fmt(v); },
    });
    from.current = value;
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView]);
  return <span ref={ref} className={cn('tabular-nums', className)}>{fmt(0)}</span>;
}

/** Jauge circulaire animée */
export function RingGauge({ value, max = 100, size = 92, stroke = 9, color = '#10B981', track = '#E2E8F0', children }: {
  value: number; max?: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const id = useId().replace(/:/g, '');
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.55} /><stop offset="100%" stopColor={color} /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#g${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Mini-courbe (sparkline) avec aire dégradée */
export function Sparkline({ data, color = '#10B981', width = 140, height = 36, className }: { data: number[]; color?: string; width?: number; height?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const { line, area } = useMemo(() => {
    if (!data.length) return { line: '', area: '' };
    const max = Math.max(...data, 1);
    const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * width, height - 2 - (v / max) * (height - 4)]);
    const l = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return { line: l, area: `${l} L${width} ${height} L0 ${height} Z` };
  }, [data, width, height]);
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs><linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
      <path d={area} fill={`url(#s${id})`} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: 'easeOut' }} />
    </svg>
  );
}

/** En-tête de chapitre éditorial */
export function Chapter({ id, n, kicker, title, children, className }: { id: string; n: string; kicker: string; title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-32', className)}>
      <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}
        className="mb-6 flex items-end gap-5">
        <span className="font-display text-[64px] font-black leading-none text-transparent md:text-[88px]" style={{ WebkitTextStroke: '1.5px #CBD5E1' }}>{n}</span>
        <div className="pb-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-emerald-700">{kicker}</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{title}</h2>
        </div>
        <div className="mb-4 hidden h-px flex-1 bg-gradient-to-r from-slate-300 to-transparent md:block" />
      </motion.div>
      {children}
    </section>
  );
}

/** Grain papier (texture) */
export function Grain({ opacity = 0.06 }: { opacity?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-multiply" style={{
      opacity,
      backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
    }} />
  );
}

/** Lignes topographiques décoratives */
export function Contours({ className, color = '#10B981' }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 800 400" className={className} preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 14 }, (_, i) => (
        <motion.path key={i} fill="none" stroke={color} strokeOpacity={0.12 + (i % 3) * 0.04} strokeWidth={1}
          d={`M -50 ${60 + i * 24} C 150 ${20 + i * 26}, 300 ${120 + i * 20}, 450 ${70 + i * 25} S 700 ${10 + i * 28}, 850 ${80 + i * 22}`}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, delay: i * 0.06 }} />
      ))}
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Verger isométrique — rendu artistique du parcellaire réel
// -----------------------------------------------------------------------------
const GROUND: Record<CellType, [string, string]> = {
  neutral: ['#E9E4D4', '#D8D1BC'],
  forest: ['#2F6B3A', '#245530'],
  'early-cherry': ['#9BBF6A', '#86AB57'],
  'season-cherry': ['#93BA63', '#7FA553'],
  'late-cherry': ['#8AB35E', '#76A04E'],
};
const FRUIT: Record<CellType, string> = { neutral: '', forest: '', 'early-cherry': '#F59E0B', 'season-cherry': '#E11D48', 'late-cherry': '#7F1D1D' };

function heatColor(v: number) {
  const stops = [[254, 240, 138], [249, 115, 22], [190, 18, 60]];
  const x = Math.max(0, Math.min(1, v)) * 2, i = Math.min(1, Math.floor(x)), f = x - i;
  const c = stops[i].map((s, k) => Math.round(s + (stops[i + 1][k] - s) * f));
  return `rgb(${c.join(',')})`;
}

export function IsoOrchard({ grid, heat, max, className, flies = true, n = 20 }: {
  grid: CellType[]; heat?: Float32Array | number[]; max?: number; className?: string; flies?: boolean; n?: number;
}) {
  const W = 34, H = 17; // demi-losange
  const cells = useMemo(() => {
    const out: { i: number; x: number; y: number; t: CellType; v: number }[] = [];
    for (let s = 0; s < 2 * n - 1; s++) for (let x = 0; x < n; x++) {
      const y = s - x; if (y < 0 || y >= n) continue;
      const i = y * n + x;
      out.push({ i, x, y, t: grid[i], v: heat && max ? Math.min(1, (heat[i] ?? 0) / max) : 0 });
    }
    return out;
  }, [grid, heat, max, n]);
  const ox = n * W, oy = 40;
  const P = (x: number, y: number) => [ox + (x - y) * W, oy + (x + y) * H] as const;
  const hot = useMemo(() => cells.filter(c => c.v > 0.55 && c.t !== 'neutral').sort((a, b) => b.v - a.v).slice(0, 14), [cells]);

  return (
    <svg viewBox={`0 0 ${2 * n * W} ${2 * n * H + 90}`} className={className} role="img" aria-label="Vue isométrique du verger">
      <defs>
        <radialGradient id="canopy" cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#A7E08A" /><stop offset="60%" stopColor="#4D9A3F" /><stop offset="100%" stopColor="#2C6B2A" /></radialGradient>
        <radialGradient id="pine" cx="40%" cy="20%" r="90%"><stop offset="0%" stopColor="#4C9A5B" /><stop offset="100%" stopColor="#173F23" /></radialGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      {/* socle */}
      <path d={`M${P(0, 0)[0]} ${P(0, 0)[1] - H} L${P(n, 0)[0] + 0} ${P(n, 0)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H} L${P(0, n)[0]} ${P(0, n)[1] - H} Z`} fill="#CBBF9E" />
      <path d={`M${P(0, n)[0]} ${P(0, n)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H + 22} L${P(0, n)[0]} ${P(0, n)[1] - H + 22} Z`} fill="#A8956B" />
      <path d={`M${P(n, 0)[0]} ${P(n, 0)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H} L${P(n, n)[0]} ${P(n, n)[1] - H + 22} L${P(n, 0)[0]} ${P(n, 0)[1] - H + 22} Z`} fill="#8E7B55" />
      {cells.map(({ i, x, y, t, v }) => {
        const [cx, cy] = P(x, y);
        const top = cy - H;
        const g = GROUND[t];
        return (
          <g key={i}>
            <path d={`M${cx} ${top - H} L${cx + W} ${top} L${cx} ${top + H} L${cx - W} ${top} Z`} fill={(x + y) % 2 ? g[0] : g[1]} stroke="rgba(0,0,0,.06)" strokeWidth={0.6} />
            {v > 0.05 && t !== 'neutral' && <path d={`M${cx} ${top - H} L${cx + W} ${top} L${cx} ${top + H} L${cx - W} ${top} Z`} fill={heatColor(v)} opacity={0.25 + v * 0.55} />}
            {t === 'forest' && (
              <g transform={`translate(${cx} ${top})`}>
                <ellipse cx={3} cy={4} rx={16} ry={6} fill="#000" opacity={0.18} filter="url(#soft)" />
                <path d={`M0 ${-46 - (i % 3) * 6} L13 -8 L-13 -8 Z`} fill="url(#pine)" />
                <path d={`M0 ${-34 - (i % 3) * 6} L16 2 L-16 2 Z`} fill="url(#pine)" />
                <rect x={-2} y={2} width={4} height={6} fill="#4A2F1B" />
              </g>
            )}
            {(t === 'early-cherry' || t === 'season-cherry' || t === 'late-cherry') && (
              <g transform={`translate(${cx} ${top})`}>
                <ellipse cx={3} cy={4} rx={13} ry={5} fill="#000" opacity={0.2} filter="url(#soft)" />
                <rect x={-1.8} y={-14} width={3.6} height={17} rx={1.5} fill="#5B3A24" />
                <circle cx={0} cy={-22} r={14} fill="url(#canopy)" />
                {[[-6, -24], [5, -18], [2, -29], [-3, -15], [8, -26]].map(([fx, fy], k) => (
                  <circle key={k} cx={fx} cy={fy} r={2.1} fill={FRUIT[t]} stroke="#fff" strokeOpacity={0.4} strokeWidth={0.5} />
                ))}
              </g>
            )}
          </g>
        );
      })}
      {flies && hot.map((c, k) => {
        const [cx, cy] = P(c.x, c.y);
        return (
          <motion.g key={c.i} initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, 6, -5, 3, 0], y: [0, -6, 2, -3, 0] }}
            transition={{ opacity: { delay: 0.8 + k * 0.05 }, duration: 2 + (k % 4) * 0.4, repeat: Infinity, ease: 'easeInOut' }}>
            <g transform={`translate(${cx + ((k * 7) % 14) - 7} ${cy - H - 52 - (k % 3) * 8})`}>
              <ellipse cx={-3.5} cy={-2} rx={4} ry={2.2} fill="#E0F2FE" opacity={0.85} transform="rotate(-25)" />
              <ellipse cx={3.5} cy={-2} rx={4} ry={2.2} fill="#E0F2FE" opacity={0.85} transform="rotate(25)" />
              <ellipse cx={0} cy={0} rx={2.2} ry={3.4} fill="#B45309" />
              <circle cx={-1} cy={-3} r={0.9} fill="#DC2626" /><circle cx={1} cy={-3} r={0.9} fill="#DC2626" />
            </g>
          </motion.g>
        );
      })}
    </svg>
  );
}

/** Paysage décoratif : collines, rangs de cerisiers, soleil */
export function HillsBackdrop({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1440 320" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#065F46" /><stop offset="100%" stopColor="#022C22" /></linearGradient>
        <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#047857" /><stop offset="100%" stopColor="#064E3B" /></linearGradient>
      </defs>
      <path d="M0 210 C 240 140, 420 230, 720 170 S 1200 120, 1440 190 L1440 320 L0 320 Z" fill="url(#h2)" opacity={0.55} />
      {Array.from({ length: 26 }, (_, i) => (
        <g key={i} transform={`translate(${40 + i * 54} ${205 - Math.sin(i / 3) * 18})`} opacity={0.55}>
          <rect x={-1} y={0} width={2} height={8} fill="#022C22" /><circle cx={0} cy={-3} r={7} fill="#065F46" />
          <circle cx={-3} cy={-4} r={1.3} fill="#F43F5E" /><circle cx={3} cy={-2} r={1.3} fill="#F43F5E" />
        </g>
      ))}
      <path d="M0 260 C 300 200, 540 290, 860 240 S 1260 210, 1440 250 L1440 320 L0 320 Z" fill="url(#h1)" />
    </svg>
  );
}
