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
// Cores: índice da lista COLORS acima (0 = vermelho, 1 = verde, 4 = preto).
const TOP = 300;
const BOTTOM = 1200;
const T = 120; // grossura das letras

export function letterAt(x, y) {
  if (y < TOP || y >= BOTTOM) return -1;

  // L vermelho (esquerda)
  if (x >= 150 && x < 650) {
    if (x < 150 + T || y >= BOTTOM - T) return 0;
    return -1;
  }

  // X preto (meio)
  if (x >= 760 && x < 1240) {
    const u = (x - 760) / 480;
    const v = (y - TOP) / (BOTTOM - TOP);
    const half = T / 2 / 480;
    if (Math.abs(u - v) < half || Math.abs(u - (1 - v)) < half) return 4;
    return -1;
  }

  // F verde (direita)
  if (x >= 1350 && x < 1850) {
    if (x < 1350 + T) return 1;
    if (y < TOP + T) return 1;
    if (x < 1750 && y >= 690 && y < 690 + T) return 1;
    return -1;
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
