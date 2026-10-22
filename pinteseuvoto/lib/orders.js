import { admin } from './supabaseAdmin';
import { getPayment } from './mercadopago';

// Confere um pagamento direto no Mercado Pago e, se estiver aprovado,
// pinta os quadradinhos do pedido.
export async function processPayment(paymentId) {
  const pay = await getPayment(paymentId);
  if (pay.status !== 'approved') return pay.status;

  const orderId = pay.external_reference;
  if (!orderId) return 'sem_pedido';

  const db = admin();
  const { data: order } = await db
    .from('orders')
    .select('id, status, amount')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return 'sem_pedido';
  if (order.status === 'paid') return 'approved';

  if (Number(pay.transaction_amount) < Number(order.amount)) {
    console.error('Valor pago menor que o pedido', orderId);
    return 'valor_incorreto';
  }

  await db
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), mp_payment_id: String(pay.id) })
    .eq('id', orderId);
  await db.from('pixels').update({ status: 'paid', expires_at: null }).eq('order_id', orderId);

  return 'approved';
}
