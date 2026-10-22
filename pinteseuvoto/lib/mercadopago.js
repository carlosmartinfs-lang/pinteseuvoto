const BASE = 'https://api.mercadopago.com';

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    ...extra,
  };
}

// Data no formato que o Mercado Pago pede, no horário de Brasília
function mpDate(date) {
  const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().replace('Z', '-03:00');
}

export async function createPix({ amount, description, email, orderId, expiresAt }) {
  const body = {
    transaction_amount: amount,
    description,
    payment_method_id: 'pix',
    payer: { email },
    external_reference: orderId,
    date_of_expiration: mpDate(expiresAt),
  };
  const site = process.env.SITE_URL || '';
  if (site.startsWith('https://')) {
    body.notification_url = `${site}/api/webhook`;
  }

  const res = await fetch(`${BASE}/v1/payments`, {
    method: 'POST',
    headers: headers({ 'X-Idempotency-Key': orderId }),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Erro Mercado Pago', data);
    throw new Error(data.message || 'Erro ao criar o Pix');
  }
  return data;
}

export async function getPayment(id) {
  const res = await fetch(`${BASE}/v1/payments/${encodeURIComponent(id)}`, {
    headers: headers(),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro ao consultar pagamento');
  return data;
}
