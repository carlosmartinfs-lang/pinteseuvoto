import { admin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await admin().from('ranking').select('nickname, message, color, total');
  if (error) {
    console.error(error);
    return Response.json([], { status: 500 });
  }
  return Response.json(data || [], { headers: { 'Cache-Control': 'no-store' } });
}
