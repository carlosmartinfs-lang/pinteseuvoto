import { admin } from '../../../../lib/supabaseAdmin';
import { processPayment } from '../../../../lib/orders';

export const dynamic = 'force-dynamic';

// O navegador do comprador pergunta aqui, a cada poucos segundos, se o Pix já caiu.
export async function GET(_req, { params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ status: 'not_found' }, { status: 404 });

  const db = admin();
  const { data: order } = await db
    .from('orders')
    .select('status, mp_payment_id, expires_at')
    .eq('id', id)
    .maybeSingle();
  if (!order) return Response.json({ status: 'not_found' }, { status: 404 });

  if (order.status === 'paid') return Response.json({ status: 'paid' });

  // Se o aviso do Mercado Pago atrasar, conferimos direto
  if (order.mp_payment_id) {
    try {
      const s = await processPayment(order.mp_payment_id);
      if (s === 'approved') return Response.json({ status: 'paid' });
    } catch {}
  }

  const expired = new Date(order.expires_at).getTime() < Date.now();
  return Response.json({ status: expired ? 'expired' : 'pending' });
}
