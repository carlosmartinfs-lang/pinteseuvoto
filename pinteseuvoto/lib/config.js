// Tamanho do mural: 2.000 x 1.500 = 3.000.000 de quadradinhos.
// Para aumentar depois, troque aqui (ex: 4000 x 2500 = 10 milhões).
export const W = 2000;
export const H = 1500;

// Tamanho dos blocos que o site carrega aos poucos
export const CHUNK = 250;

// Preço por quadradinho (em reais)
export const PRICE = 1;

// Máximo de quadradinhos por compra
export const MAX_PER_ORDER = 1000;

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
