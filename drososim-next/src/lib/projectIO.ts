// =============================================================================
// Import / export universel de projets DrosoSim Next
// Tous les formats exportés embarquent le projet complet et sont rechargeables.
// =============================================================================
import LZString from 'lz-string';
import { useGridStore, GRID_N } from './store';
import type { CellType } from './engine';

export type ExportFormat = 'json' | 'drososim' | 'csv' | 'png' | 'txt';
export interface ImportResult { ok: boolean; format: string; message: string; }

const MARKER = 'DROSOSIM-PROJECT';
const NC = GRID_N * GRID_N;
const stamp = () => new Date().toISOString().slice(0, 10);

/** Projet complet (JSON) */
export const projectJSON = () => useGridStore.getState().saveProject();
/** Projet compressé, sûr pour URL et fichiers texte */
export const projectPayload = () => LZString.compressToEncodedURIComponent(projectJSON());

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------------------------------------------------------------- EXPORT
export async function exportProject(format: ExportFormat, extraCsv?: string) {
  const name = `drososim-${stamp()}`;
  switch (format) {
    case 'json':
      return download(`${name}.json`, projectJSON(), 'application/json');
    case 'drososim':
      return download(`${name}.drososim`, `${MARKER}:${projectPayload()}`, 'text/plain');
    case 'txt': {
      const link = `${window.location.origin}/simulator?sim=${useGridStore.getState().toShareString()}`;
      return download(`${name}-lien.txt`, `Lien de partage DrosoSim Next\n${link}\n\n${MARKER}:${projectPayload()}\n`, 'text/plain');
    }
    case 'csv':
      return download(`${name}.csv`, '\ufeff' + projectCSV(extraCsv), 'text/csv;charset=utf-8');
    case 'png':
      return download(`${name}.png`, await projectPNG(), 'image/png');
  }
}

/** CSV lisible (grille + stratégies) + ligne de projet embarqué pour rechargement */
export function projectCSV(extra?: string) {
  const s = useGridStore.getState();
  const code: Record<CellType, string> = { neutral: '.', forest: 'F', 'early-cherry': 'P', 'season-cherry': 'S', 'late-cherry': 'T' };
  const rows: string[] = [];
  rows.push('DrosoSim Next — projet exporté le ' + new Date().toLocaleString('fr-FR'));
  rows.push('Légende;F = forêt;P = cerise précoce;S = cerise de saison;T = cerise tardive;. = neutre');
  rows.push('');
  rows.push('GRILLE');
  for (let y = 0; y < GRID_N; y++) rows.push(s.grid.slice(y * GRID_N, (y + 1) * GRID_N).map(c => code[c]).join(';'));
  rows.push('');
  rows.push('STRATEGIES;parcelle;' + ['prophylaxie', 'filet', 'traitement', 'parasitoides', 'tis'].join(';'));
  s.strategies.forEach(st => {
    const entries = Object.entries(st.leversByParcel);
    if (!entries.length) rows.push(`${st.name};;;;;;`);
    entries.forEach(([pid, l]) => rows.push([st.name, s.parcelNames[pid] ?? pid, l.prophylaxis, l.netting, l.treatment, l.parasitoids, l.tis].map(String).join(';')));
  });
  if (extra) { rows.push(''); rows.push(extra); }
  rows.push('');
  rows.push(`${MARKER};${projectPayload()}`);
  return rows.join('\n');
}

/** Image PNG du verger avec le projet embarqué dans un bloc tEXt */
export async function projectPNG(): Promise<Blob> {
  const s = useGridStore.getState();
  const COL: Record<CellType, string> = { neutral: '#F1F5F9', forest: '#15803D', 'early-cherry': '#D97706', 'season-cherry': '#E11D48', 'late-cherry': '#991B1B' };
  const cell = 28, pad = 32, head = 70, foot = 46;
  const W = GRID_N * cell + pad * 2, H = GRID_N * cell + pad * 2 + head + foot;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#F6F4EE'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#03241C'; g.fillRect(0, 0, W, head);
  g.fillStyle = '#fff'; g.font = 'bold 22px Georgia, serif'; g.fillText('DrosoSim Next — plan du verger', pad, 44);
  g.font = '12px sans-serif'; g.fillStyle = '#A7F3D0'; g.fillText(`${s.strategies.length} stratégies · ${new Date().toLocaleDateString('fr-FR')}`, pad, 62);
  for (let i = 0; i < NC; i++) {
    const x = pad + (i % GRID_N) * cell, y = head + pad + Math.floor(i / GRID_N) * cell;
    g.fillStyle = COL[s.grid[i]]; g.fillRect(x, y, cell - 1, cell - 1);
  }
  g.fillStyle = '#475569'; g.font = '12px sans-serif';
  g.fillText('Image rechargeable : glissez-la dans DrosoSim Next pour retrouver le projet complet.', pad, H - 18);
  const blob: Blob = await new Promise(r => c.toBlob(b => r(b!), 'image/png'));
  return insertTextChunk(new Uint8Array(await blob.arrayBuffer()), 'drososim', projectPayload());
}

// ---------------------------------------------------------------- IMPORT
export async function importFile(file: File): Promise<ImportResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (isPNG(buf)) {
    const payload = readTextChunk(buf, 'drososim');
    if (!payload) return { ok: false, format: 'PNG', message: 'Cette image ne contient pas de projet DrosoSim.' };
    return fromPayload(payload, 'image PNG');
  }
  if (buf[0] === 0x50 && buf[1] === 0x4b) return { ok: false, format: 'archive', message: 'Les fichiers Excel/ZIP ne sont pas lus directement : exportez la feuille en CSV.' };
  const text = new TextDecoder('utf-8').decode(buf).replace(/^\ufeff/, '');
  return importText(text, file.name);
}

export function importText(text: string, sourceName = 'texte'): ImportResult {
  const t = text.trim();
  const ext = sourceName.split('.').pop()?.toLowerCase() ?? '';
  const store = useGridStore.getState();

  // 1. JSON (projet complet, ancien format court, ou objet partiel)
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const o = JSON.parse(t);
      if (Array.isArray(o) && o.length === NC) return applyGrid(o, 'JSON (grille)');
      if (o && Array.isArray(o.grid) && store.loadProject(JSON.stringify(o))) return ok('JSON');
      if (o && (o.g || o.s)) {
        const grid = Array.isArray(o.g) ? o.g : null;
        if (grid && store.loadProject(JSON.stringify({ grid, strategies: o.s, simParams: o.p, economics: o.e, parcelNames: o.n }))) return ok('JSON (format court)');
      }
    } catch { /* on continue */ }
  }
  // 2. Marqueur de projet embarqué (.drososim, CSV, TXT)
  const m = t.match(new RegExp(`${MARKER}[:;,\\t]\\s*([A-Za-z0-9+\\-$_]+)`));
  if (m) return fromPayload(m[1], ext === 'csv' ? 'CSV' : ext === 'drososim' ? 'fichier .drososim' : 'texte');
  // 3. Lien de partage (?sim=…)
  const link = t.match(/[?&]sim=([A-Za-z0-9+\-$_]+)/);
  if (link && store.fromShareString(link[1])) return ok('lien de partage');
  // 4. Charge utile compressée brute
  if (/^[A-Za-z0-9+\-$_]{40,}$/.test(t)) {
    const r = fromPayload(t, 'texte compressé');
    if (r.ok) return r;
    if (store.fromShareString(t)) return ok('lien de partage');
  }
  // 5. Grille saisie à la main (CSV/TSV, 20 lignes × 20 colonnes, codes ou noms)
  const g = parseGridTable(t);
  if (g) return applyGrid(g, `tableau ${ext.toUpperCase() || 'texte'} (grille)`);

  return { ok: false, format: ext || 'inconnu', message: 'Format non reconnu : aucun projet, lien ou grille 20×20 trouvé.' };
}

function fromPayload(payload: string, format: string): ImportResult {
  try {
    const json = LZString.decompressFromEncodedURIComponent(payload);
    if (json && useGridStore.getState().loadProject(json)) return ok(format);
  } catch { /* ignore */ }
  return { ok: false, format, message: `Le contenu ${format} est illisible ou corrompu.` };
}

function ok(format: string): ImportResult { return { ok: true, format, message: `Projet chargé depuis ${format}` }; }

const ALIASES: [RegExp, CellType][] = [
  [/^(f|for[eê]t|forest|bois|wild|n?at|espace)/i, 'forest'],
  [/^(p|e|pr[eé]coce|early)/i, 'early-cherry'],
  [/^(s|saison|season|mid)/i, 'season-cherry'],
  [/^(t|l|tardive|late)/i, 'late-cherry'],
  [/^(\.|0|-|n|neutre|neutral|vide|empty)?$/i, 'neutral'],
];
function toType(v: unknown): CellType | null {
  const s = String(v ?? '').trim();
  if (['neutral', 'forest', 'early-cherry', 'season-cherry', 'late-cherry'].includes(s)) return s as CellType;
  for (const [re, t] of ALIASES) if (re.test(s)) return t;
  return null;
}
function parseGridTable(t: string): CellType[] | null {
  const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (let start = 0; start + GRID_N <= lines.length; start++) {
    const block = lines.slice(start, start + GRID_N).map(l => l.split(/[;,\t ]+/).filter(x => x !== ''));
    if (block.every(r => r.length === GRID_N)) {
      const cells = block.flat().map(toType);
      if (cells.every(Boolean)) return cells as CellType[];
    }
  }
  return null;
}
function applyGrid(raw: unknown[], format: string): ImportResult {
  const cells = raw.map(toType);
  if (cells.length !== NC || !cells.every(Boolean)) return { ok: false, format, message: 'Grille invalide (400 cases attendues).' };
  useGridStore.getState().setGrid(cells as CellType[]);
  return { ok: true, format, message: `Grille chargée depuis ${format} (stratégies conservées)` };
}

// ---------------------------------------------------------------- PNG tEXt
const isPNG = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
let CRC: Uint32Array | null = null;
function crc32(bytes: Uint8Array) {
  if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function insertTextChunk(png: Uint8Array, key: string, value: string): Blob {
  const enc = new TextEncoder();
  const data = new Uint8Array([...enc.encode(key), 0, ...enc.encode(value)]);
  const type = enc.encode('tEXt');
  const chunk = new Uint8Array(12 + data.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  chunk.set(type, 4); chunk.set(data, 8);
  dv.setUint32(8 + data.length, crc32(new Uint8Array([...type, ...data])));
  // insertion juste après IHDR (8 octets signature + 25 octets IHDR)
  const at = 33;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, at)); out.set(chunk, at); out.set(png.subarray(at), at + chunk.length);
  return new Blob([out], { type: 'image/png' });
}
function readTextChunk(png: Uint8Array, key: string): string | null {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const dec = new TextDecoder();
  let p = 8;
  while (p + 8 <= png.length) {
    const len = dv.getUint32(p);
    const type = dec.decode(png.subarray(p + 4, p + 8));
    if (type === 'tEXt') {
      const d = png.subarray(p + 8, p + 8 + len);
      const z = d.indexOf(0);
      if (dec.decode(d.subarray(0, z)) === key) return dec.decode(d.subarray(z + 1));
    }
    if (type === 'IEND') break;
    p += 12 + len;
  }
  return null;
}
