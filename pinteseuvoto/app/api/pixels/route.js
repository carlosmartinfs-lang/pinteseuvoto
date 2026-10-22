import { admin } from '../../../lib/supabaseAdmin';
import { W, H, CHUNK } from '../../../lib/config';

export const dynamic = 'force-dynamic';

// Devolve os quadradinhos pagos de um bloco do mural, no formato "x,y,cor;x,y,cor;..."
export async function GET(req) {
  const url = new URL(req.url);
  const cx = Number(url.searchParams.get('cx'));
  const cy = Number(url.searchParams.get('cy'));
  if (!Number.isInteger(cx) || !Number.isInteger(cy) || cx < 0 || cy < 0 || cx * CHUNK >= W || cy * CHUNK >= H) {
    return new Response('', { status: 400 });
  }
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const { data, error } = await admin().rpc('get_pixels', {
    x0, y0, x1: Math.min(W, x0 + CHUNK) - 1, y1: Math.min(H, y0 + CHUNK) - 1,
  });
  if (error) {
    console.error(error);
    return new Response('', { status: 500 });
  }
  return new Response(data || '', {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
