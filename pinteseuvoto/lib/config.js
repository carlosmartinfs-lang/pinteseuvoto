// Tamanho do mural: 2.000 x 1.500 = 3.000.000 de quadradinhos.
// Para aumentar depois, troque aqui (ex: 4000 x 2500 = 10 milhões).
export const W = 2000;
export const H = 1500;

// Tamanho dos blocos que o site carrega aos poucos
export const CHUNK = 250;

// Preço por quadradinho (em reais)
export const PRICE = 1;

// Máximo de quadradinhos por compra
export const MAX_PER_ORDER = 5000;

// Tempo que os quadradinhos ficam reservados esperando o Pix
export const RESERVE_MINUTES = 30;

export const MAX_NICK = 20;
export const MAX_MSG = 40;

export const COLORS = [
  { name: 'Vermelho', hex: '#D62828' },
  { name: 'Verde', hex: '#2A9D3A' },
  { name: 'Amarelo', hex: '#F2C200' },
  { name: 'Azul', hex: '#1D4ED8' },
  { name: 'Preto', hex: '#111111' },
  { name: 'Branco', hex: '#FFFFFF' },
];

// Letras gigantes "L X F" já pintadas no mural (não podem ser compradas).
// Cada letra é feita de traços com pontas arredondadas.
// Cores: índice da lista COLORS acima (0 = vermelho, 1 = verde, 4 = preto).
const R = 34; // metade da grossura do traço (em quadradinhos)
const LETTERS = [
  { color: 0, segs: [[230, 330, 230, 1170], [230, 1170, 610, 1170]] }, // L
  { color: 4, segs: [[800, 330, 1200, 1170], [1200, 330, 800, 1170]] }, // X
  { color: 1, segs: [[1400, 330, 1400, 1170], [1400, 330, 1800, 330], [1400, 730, 1700, 730]] }, // F
];

function distSeg(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  const px = x1 + t * dx - x;
  const py = y1 + t * dy - y;
  return px * px + py * py;
}

export function letterAt(x, y) {
  if (y < 330 - R || y > 1170 + R) return -1;
  const cx = x + 0.5;
  const cy = y + 0.5;
  for (const l of LETTERS) {
    for (const [x1, y1, x2, y2] of l.segs) {
      if (cx < Math.min(x1, x2) - R || cx > Math.max(x1, x2) + R) continue;
      if (distSeg(cx, cy, x1, y1, x2, y2) <= R * R) return l.color;
    }
  }
  return -1;
}

// Filtro simples de palavrões. Acrescente palavras aqui quando precisar.
const BAD_WORDS = [
  'porra', 'caralho', 'merda', 'puta', 'puto', 'buceta', 'cu', 'foda', 'fodase',
  'fdp', 'viado', 'arrombado', 'arrombada', 'vagabunda', 'vagabundo', 'corno',
  'cacete', 'piroca', 'xoxota', 'bosta', 'otario', 'otaria',
  'retardado', 'bicha', 'traveco', 'piranha', 'vadia', 'babaca',
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0@]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/[$5]/g, 's');
}

export function hasBadWord(text) {
  const t = normalize(text);
  return BAD_WORDS.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t));
}
