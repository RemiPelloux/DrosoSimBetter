import fs from 'node:fs';
import path from 'node:path';

// Sert les médias de docs/assets/ pour que le Markdown fonctionne à la fois sur GitHub et dans /docs.
const DIR = path.join(process.cwd(), 'docs', 'assets');
const TYPES: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4' };

export function generateStaticParams() {
  return fs.readdirSync(DIR).filter(f => TYPES[path.extname(f)]).map(file => ({ file }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const safe = path.basename(file);
  const type = TYPES[path.extname(safe)];
  const full = path.join(DIR, safe);
  if (!type || !fs.existsSync(full)) return new Response('Introuvable', { status: 404 });
  return new Response(fs.readFileSync(full), { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
}
