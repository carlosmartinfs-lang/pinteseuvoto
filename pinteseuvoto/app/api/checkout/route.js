import { admin } from '../../../lib/supabaseAdmin';
import { createPix } from '../../../lib/mercadopago';
import {
  W, H, PRICE, MAX_PER_ORDER, RESERVE_MINUTES, COLORS, MAX_NICK, MAX_MSG, hasBadWord, letterAt,
} from '../../../lib/config';

export const dynamic = 'force-dynamic';

function fail(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body) return fail('Pedido inválido.');

  const nickname = String(body.nickname || '').trim().slice(0, MAX_NICK);
  const message = String(body.message || '').trim().slice(0, MAX_MSG);
  const email = String(body.email || '').trim();
  const color = Number(body.color);
  const rawCells = Array.isArray(body.cells) ? body.cells : [];

  if (!nickname) return fail('Coloque seu nome ou apelido.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('E-mail inválido.');
  if (!Number.isInteger(color) || color < 0 || color >= COLORS.length) return fail('Cor inválida.');
  if (hasBadWord(nickname) || hasBadWord(message)) return fail('Sem palavrão, por favor. Muda o texto e tenta de novo.');

  const seen = new Set();
  const cells = [];
  for (const c of rawCells) {
    const x = Number(c?.[0]);
    const y = Number(c?.[1]);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= W || y >= H) {
      return fail('Quadradinho fora do mural.');
    }
    if (letterAt(x, y) !== -1) return fail('As letras L X F não podem ser pintadas por cima.');
    const key = y * W + x;
    if (!seen.has(key)) {
      seen.add(key);
      cells.push([x, y]);
    }
  }
  if (cells.length === 0) return fail('Selecione pelo menos 1 quadradinho.');
  if (cells.length > MAX_PER_ORDER) return fail(`Máximo de ${MAX_PER_ORDER} quadradinhos por compra.`);

  const db = admin();
  const now = new Date();

  // Libera reservas vencidas (com 5 min de folga)
  await db
    .from('pixels')
    .delete()
    .eq('status', 'reserved')
    .lt('expires_at', new Date(now.getTime() - 5 * 60 * 1000).toISOString());

  const expiresAt = new Date(now.getTime() + RESERVE_MINUTES * 60 * 1000);
  const amount = Math.round(cells.length * PRICE * 100) / 100;

  const { data: order, error: orderErr } = await db
    .from('orders')
    .insert({ nickname, message, color, qty: cells.length, amount, expires_at: expiresAt.toISOString() })
    .select('id')
    .single();
  if (orderErr) {
    console.error(orderErr);
    return fail('Erro ao criar o pedido. Tente de novo.', 500);
  }

  const rows = cells.map(([x, y]) => ({
    x, y, color, order_id: order.id, status: 'reserved', expires_at: expiresAt.toISOString(),
  }));
  const { error: pixErr } = await db.from('pixels').insert(rows);
  if (pixErr) {
    await db.from('orders').delete().eq('id', order.id);
    if (pixErr.code === '23505') {
      return fail('Alguns desses quadradinhos acabaram de ser pegos por outra pessoa. Escolha outros.', 409);
    }
    console.error(pixErr);
    return fail('Erro ao reservar os quadradinhos.', 500);
  }

  let pay;
  try {
    pay = await createPix({
      amount,
      description: `${cells.length} quadradinho(s) - Pinte Seu Voto`,
      email,
      orderId: order.id,
      expiresAt,
    });
  } catch (err) {
    await db.from('orders').delete().eq('id', order.id);
    return fail('Não consegui gerar o Pix agora. Tente de novo em instantes.', 502);
  }

  await db.from('orders').update({ mp_payment_id: String(pay.id) }).eq('id', order.id);

  const td = pay.point_of_interaction?.transaction_data || {};
  return Response.json({
    orderId: order.id,
    amount,
    qty: cells.length,
    expiresAt: expiresAt.toISOString(),
    qrCode: td.qr_code || '',
    qrBase64: td.qr_code_base64 || '',
  });
}
