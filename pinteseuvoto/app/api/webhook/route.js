import { processPayment } from '../../../lib/orders';

export const dynamic = 'force-dynamic';

// O Mercado Pago chama este endereço quando um pagamento muda de status.
// Por segurança, não confiamos no aviso: consultamos o pagamento direto na API.
export async function POST(req) {
  const url = new URL(req.url);
  let body = {};
  try {
    body = await req.json();
  } catch {}

  const type = body.type || url.searchParams.get('type') || url.searchParams.get('topic');
  const id = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');

  if (type === 'payment' && id) {
    try {
      await processPayment(id);
    } catch (err) {
      console.error('Erro no webhook', err);
      return new Response('erro', { status: 500 });
    }
  }
  return new Response('ok');
}

export async function GET() {
  return new Response('ok');
}
