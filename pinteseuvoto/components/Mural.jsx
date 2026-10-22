'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  W, H, CHUNK, PRICE, MAX_PER_ORDER, COLORS, MAX_NICK, MAX_MSG, hasBadWord,
} from '../lib/config';

const RGB = COLORS.map((c) => [
  parseInt(c.hex.slice(1, 3), 16),
  parseInt(c.hex.slice(3, 5), 16),
  parseInt(c.hex.slice(5, 7), 16),
]);
const CX = Math.ceil(W / CHUNK);
const CY = Math.ceil(H / CHUNK);
const MAX_SCALE = 48;

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n) => n.toLocaleString('pt-BR');
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export default function Mural() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const miniRef = useRef(null);
  const g = useRef(null);
  if (!g.current) {
    g.current = {
      board: null, off: null, offCtx: null, img: null,
      view: { scale: 1, ox: 0, oy: 0 }, minScale: 0.1,
      sel: new Set(), loaded: new Set(), loading: new Set(), failed: new Map(),
      pointers: new Map(), pinch: null, painting: null, pan: null, hover: null,
      raf: 0, cw: 0, ch: 0, ready: false,
    };
  }

  const [mode, setMode] = useState('pintar');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [color, setColor] = useState(0);
  const colorRef = useRef(color);
  colorRef.current = color;

  const [selCount, setSelCount] = useState(0);
  const [hover, setHover] = useState(null);
  const [nick, setNick] = useState('');
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ranking, setRanking] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  // ---------- desenho ----------

  function requestDraw() {
    const s = g.current;
    if (s.raf) return;
    s.raf = requestAnimationFrame(() => {
      s.raf = 0;
      draw();
      ensureChunks();
    });
  }

  function draw() {
    const s = g.current;
    const c = canvasRef.current;
    if (!c || !s.off) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const { scale, ox, oy } = s.view;
    const { cw, ch } = s;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#E7E7E2';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(ox + 3, oy + 3, W * scale, H * scale);

    const sx0 = Math.max(0, Math.floor(-ox / scale));
    const sy0 = Math.max(0, Math.floor(-oy / scale));
    const sx1 = Math.min(W, Math.ceil((cw - ox) / scale));
    const sy1 = Math.min(H, Math.ceil((ch - oy) / scale));

    if (sx1 > sx0 && sy1 > sy0) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        s.off, sx0, sy0, sx1 - sx0, sy1 - sy0,
        ox + sx0 * scale, oy + sy0 * scale, (sx1 - sx0) * scale, (sy1 - sy0) * scale
      );

      if (scale >= 8) {
        ctx.strokeStyle = 'rgba(0,0,0,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const top = oy + sy0 * scale;
        const bot = oy + sy1 * scale;
        const left = ox + sx0 * scale;
        const right = ox + sx1 * scale;
        for (let x = sx0; x <= sx1; x++) {
          const px = Math.round(ox + x * scale) + 0.5;
          ctx.moveTo(px, top);
          ctx.lineTo(px, bot);
        }
        for (let y = sy0; y <= sy1; y++) {
          const py = Math.round(oy + y * scale) + 0.5;
          ctx.moveTo(left, py);
          ctx.lineTo(right, py);
        }
        ctx.stroke();
      }
    }

    // quadradinhos selecionados
    if (s.sel.size) {
      const size = Math.max(scale, 2);
      ctx.fillStyle = COLORS[colorRef.current].hex;
      for (const k of s.sel) {
        const x = k % W;
        const y = (k - x) / W;
        ctx.fillRect(ox + x * scale, oy + y * scale, size, size);
      }
      if (scale >= 4) {
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = scale >= 10 ? 2 : 1;
        ctx.setLineDash(scale >= 8 ? [3, 2] : []);
        for (const k of s.sel) {
          const x = k % W;
          const y = (k - x) / W;
          ctx.strokeRect(ox + x * scale + 0.5, oy + y * scale + 0.5, scale - 1, scale - 1);
        }
        ctx.setLineDash([]);
      }
    }

    // quadradinho sob o mouse
    if (s.hover && scale >= 3) {
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + s.hover.x * scale, oy + s.hover.y * scale, scale, scale);
    }

    // mapa
    const m = miniRef.current;
    if (m) {
      const mc = m.getContext('2d');
      const mw = m.width;
      const mh = m.height;
      mc.imageSmoothingEnabled = true;
      mc.fillStyle = '#FFFFFF';
      mc.fillRect(0, 0, mw, mh);
      mc.drawImage(s.off, 0, 0, mw, mh);
      const k = mw / W;
      const vx = Math.max(0, (-ox / scale) * k);
      const vy = Math.max(0, (-oy / scale) * k);
      const vx2 = Math.min(mw, ((cw - ox) / scale) * k);
      const vy2 = Math.min(mh, ((ch - oy) / scale) * k);
      if (vx2 > vx && vy2 > vy) {
        mc.strokeStyle = '#D62828';
        mc.lineWidth = 3;
        mc.strokeRect(vx, vy, Math.max(4, vx2 - vx), Math.max(4, vy2 - vy));
      }
    }
  }

  // ---------- dados do mural ----------

  function putCell(x, y, c) {
    const s = g.current;
    if (x < 0 || y < 0 || x >= W || y >= H || !RGB[c]) return;
    const i = y * W + x;
    s.board[i] = c + 1;
    const p = i * 4;
    s.img.data[p] = RGB[c][0];
    s.img.data[p + 1] = RGB[c][1];
    s.img.data[p + 2] = RGB[c][2];
    s.img.data[p + 3] = 255;
    if (s.sel.has(i)) {
      s.sel.delete(i);
      setSelCount(s.sel.size);
    }
  }

  function flushRect(x, y, w, h) {
    const s = g.current;
    const x1 = Math.min(W, x + w);
    const y1 = Math.min(H, y + h);
    s.offCtx.putImageData(s.img, 0, 0, x, y, x1 - x, y1 - y);
  }

  function ensureChunks() {
    const s = g.current;
    if (!s.ready) return;
    const { scale, ox, oy } = s.view;
    const x0 = Math.max(0, Math.floor(-ox / scale / CHUNK));
    const y0 = Math.max(0, Math.floor(-oy / scale / CHUNK));
    const x1 = Math.min(CX - 1, Math.floor((s.cw - ox) / scale / CHUNK));
    const y1 = Math.min(CY - 1, Math.floor((s.ch - oy) / scale / CHUNK));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const key = cy * CX + cx;
        if (s.loaded.has(key) || s.loading.has(key)) continue;
        const failedAt = s.failed.get(key);
        if (failedAt && Date.now() - failedAt < 10000) continue;
        loadChunk(cx, cy);
      }
    }
  }

  async function loadChunk(cx, cy) {
    const s = g.current;
    const key = cy * CX + cx;
    s.loading.add(key);
    try {
      const r = await fetch(`/api/pixels?cx=${cx}&cy=${cy}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('falha');
      const text = await r.text();
      if (text) {
        for (const part of text.split(';')) {
          const [x, y, c] = part.split(',').map(Number);
          putCell(x, y, c);
        }
      }
      s.loaded.add(key);
      s.failed.delete(key);
      flushRect(cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
    } catch {
      s.failed.set(key, Date.now());
    } finally {
      s.loading.delete(key);
      requestDraw();
    }
  }

  function reloadAll() {
    g.current.loaded.clear();
    requestDraw();
  }

  // ---------- câmera ----------

  function clampScale(v) {
    return Math.min(MAX_SCALE, Math.max(g.current.minScale, v));
  }

  function fit() {
    const s = g.current;
    const scale = Math.min(s.cw / W, s.ch / H) * 0.94;
    s.minScale = scale * 0.6;
    s.view = { scale, ox: (s.cw - W * scale) / 2, oy: (s.ch - H * scale) / 2 };
    requestDraw();
  }

  function zoomAt(px, py, f) {
    const s = g.current;
    const { scale, ox, oy } = s.view;
    const ns = clampScale(scale * f);
    const wx = (px - ox) / scale;
    const wy = (py - oy) / scale;
    s.view = { scale: ns, ox: px - wx * ns, oy: py - wy * ns };
    requestDraw();
  }

  function centerOn(wx, wy) {
    const s = g.current;
    const { scale } = s.view;
    s.view = { scale, ox: s.cw / 2 - wx * scale, oy: s.ch / 2 - wy * scale };
    requestDraw();
  }

  // ---------- seleção ----------

  function cellAt(px, py) {
    const { scale, ox, oy } = g.current.view;
    const x = Math.floor((px - ox) / scale);
    const y = Math.floor((py - oy) / scale);
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    return { x, y };
  }

  function applyCell(x, y, erase) {
    const s = g.current;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (s.board[k]) return; // já pintado
    if (erase) {
      s.sel.delete(k);
    } else if (!s.sel.has(k)) {
      if (s.sel.size >= MAX_PER_ORDER) {
        setError(`Máximo de ${num(MAX_PER_ORDER)} quadradinhos por compra.`);
        return;
      }
      s.sel.add(k);
    }
    setSelCount(s.sel.size);
  }

  function paintLine(a, b, erase) {
    let x0 = a.x;
    let y0 = a.y;
    const dx = Math.abs(b.x - x0);
    const dy = -Math.abs(b.y - y0);
    const sx = x0 < b.x ? 1 : -1;
    const sy = y0 < b.y ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 5000; guard++) {
      applyCell(x0, y0, erase);
      if (x0 === b.x && y0 === b.y) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function clearSelection() {
    g.current.sel.clear();
    setSelCount(0);
    requestDraw();
  }

  // ---------- mouse e toque ----------

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e) {
    const s = g.current;
    canvasRef.current.setPointerCapture(e.pointerId);
    const p = pos(e);
    s.pointers.set(e.pointerId, p);

    if (s.pointers.size === 2) {
      s.painting = null;
      s.pan = null;
      const [a, b] = [...s.pointers.values()];
      s.pinch = { d: dist(a, b) || 1, m: mid(a, b), view: { ...s.view } };
      return;
    }
    if (s.pointers.size > 2) return;

    const wantsPan = e.button === 1 || e.button === 2 || e.shiftKey || modeRef.current === 'mover';
    if (wantsPan) {
      s.pan = p;
      return;
    }
    if (e.button !== 0) return;
    const cell = cellAt(p.x, p.y);
    if (!cell) {
      s.pan = p;
      return;
    }
    setError('');
    const erase = s.sel.has(cell.y * W + cell.x);
    s.painting = { erase, last: cell };
    applyCell(cell.x, cell.y, erase);
    requestDraw();
  }

  function onPointerMove(e) {
    const s = g.current;
    const p = pos(e);
    if (s.pointers.has(e.pointerId)) s.pointers.set(e.pointerId, p);

    if (s.pinch && s.pointers.size >= 2) {
      const [a, b] = [...s.pointers.values()];
      const m = mid(a, b);
      const v0 = s.pinch.view;
      const ns = clampScale((v0.scale * dist(a, b)) / s.pinch.d);
      const wx = (s.pinch.m.x - v0.ox) / v0.scale;
      const wy = (s.pinch.m.y - v0.oy) / v0.scale;
      s.view = { scale: ns, ox: m.x - wx * ns, oy: m.y - wy * ns };
      requestDraw();
      return;
    }

    if (s.painting) {
      const cell = cellAt(p.x, p.y);
      if (cell && (cell.x !== s.painting.last.x || cell.y !== s.painting.last.y)) {
        paintLine(s.painting.last, cell, s.painting.erase);
        s.painting.last = cell;
        requestDraw();
      }
    } else if (s.pan) {
      s.view = { ...s.view, ox: s.view.ox + p.x - s.pan.x, oy: s.view.oy + p.y - s.pan.y };
      s.pan = p;
      requestDraw();
    }

    if (e.pointerType === 'mouse') {
      const cell = cellAt(p.x, p.y);
      const prev = s.hover;
      if ((cell && (!prev || prev.x !== cell.x || prev.y !== cell.y)) || (!cell && prev)) {
        s.hover = cell;
        setHover(cell);
        requestDraw();
      }
    }
  }

  function onPointerUp(e) {
    const s = g.current;
    s.pointers.delete(e.pointerId);
    if (s.pointers.size < 2) s.pinch = null;
    if (s.pointers.size === 1) {
      s.painting = null;
      s.pan = [...s.pointers.values()][0];
    }
    if (s.pointers.size === 0) {
      s.painting = null;
      s.pan = null;
    }
  }

  function onPointerLeave() {
    const s = g.current;
    if (s.hover) {
      s.hover = null;
      setHover(null);
      requestDraw();
    }
  }

  function onMiniPointer(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const wx = ((e.clientX - r.left) / r.width) * W;
    const wy = ((e.clientY - r.top) / r.height) * H;
    centerOn(wx, wy);
  }

  // ---------- inicialização ----------

  useEffect(() => {
    const s = g.current;
    s.board = new Uint8Array(W * H);
    s.off = document.createElement('canvas');
    s.off.width = W;
    s.off.height = H;
    s.offCtx = s.off.getContext('2d');
    s.img = s.offCtx.createImageData(W, H);
    s.img.data.fill(255);
    s.offCtx.putImageData(s.img, 0, 0);

    const canvas = canvasRef.current;
    const wrap = wrapRef.current;

    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      s.cw = rect.width;
      s.ch = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      if (!s.ready) {
        s.ready = true;
        fit();
      } else {
        requestDraw();
      }
    });
    ro.observe(wrap);

    const onWheel = (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    const noMenu = (e) => e.preventDefault();
    canvas.addEventListener('contextmenu', noMenu);

    // atualização em tempo real
    let sb = null;
    let channel = null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      sb = createClient(url, key);
      channel = sb
        .channel('mural')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pixels' }, (payload) => {
          const n = payload.new;
          if (n && n.status === 'paid') {
            putCell(n.x, n.y, n.color);
            flushRect(n.x, n.y, 1, 1);
            requestDraw();
          }
        })
        .subscribe();
    }

    return () => {
      ro.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', noMenu);
      if (sb && channel) sb.removeChannel(channel);
      if (s.raf) cancelAnimationFrame(s.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  // ranking
  async function loadRanking() {
    try {
      const r = await fetch('/api/ranking', { cache: 'no-store' });
      if (r.ok) setRanking(await r.json());
    } catch {}
  }
  useEffect(() => {
    loadRanking();
    const t = setInterval(loadRanking, 30000);
    return () => clearInterval(t);
  }, []);

  // acompanhar o pagamento
  useEffect(() => {
    if (!checkout || checkout.status !== 'pending') return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/order/${checkout.orderId}`, { cache: 'no-store' });
        const d = await r.json();
        if (d.status === 'paid') {
          setCheckout((c) => (c ? { ...c, status: 'paid' } : c));
          clearSelection();
          reloadAll();
          loadRanking();
        } else if (d.status === 'expired') {
          setCheckout((c) => (c ? { ...c, status: 'expired' } : c));
        }
      } catch {}
    }, 4000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout?.orderId, checkout?.status]);

  // ---------- compra ----------

  const total = selCount * PRICE;
  const canPay = selCount > 0 && nick.trim() && email.trim() && !busy;

  async function pay() {
    setError('');
    if (hasBadWord(nick) || hasBadWord(msg)) {
      setError('Sem palavrão, por favor. Muda o texto e tenta de novo.');
      return;
    }
    const s = g.current;
    const cells = [...s.sel].map((k) => [k % W, Math.floor(k / W)]);
    setBusy(true);
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cells, color, nickname: nick, message: msg, email }),
      });
      const d = await r.json().catch(() => ({ error: 'Erro inesperado. Tente de novo.' }));
      if (!r.ok) {
        setError(d.error || 'Erro inesperado. Tente de novo.');
        if (r.status === 409) reloadAll();
        return;
      }
      setCopied(false);
      setNow(Date.now());
      setCheckout({ ...d, status: 'pending' });
    } catch {
      setError('Sem conexão. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(checkout.qrCode);
      setCopied(true);
    } catch {}
  }

  const remaining = checkout ? Math.max(0, new Date(checkout.expiresAt).getTime() - now) : 0;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');

  const zoomIn = () => zoomAt(g.current.cw / 2, g.current.ch / 2, 1.6);
  const zoomOut = () => zoomAt(g.current.cw / 2, g.current.ch / 2, 1 / 1.6);

  return (
    <>
      <header className="header">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <span style={{ background: '#D62828' }} />
            <span style={{ background: '#2A9D3A' }} />
            <span style={{ background: '#F2C200' }} />
            <span style={{ background: '#1D4ED8' }} />
          </div>
          <div>
            <div className="brand-name">pinte seu voto</div>
            <div className="brand-sub">pinteseuvotofxl.com</div>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <b>{num(W * H)}</b>
            <span>quadradinhos no mural</span>
          </div>
          <div className="stat">
            <b>{brl(PRICE).replace(',00', '')}</b>
            <span>por quadradinho</span>
          </div>
        </div>
      </header>

      <div className="hero">
        <h1>Deixe seu voto!</h1>
        <p>Escolha uma cor, pinte quantos quadradinhos quiser e deixe sua mensagem. {brl(PRICE)} cada.</p>
      </div>

      <main className="layout">
        <aside className="card buy" aria-label="Comprar quadradinhos">
          <div className="field" style={{ gap: 12 }}>
            <h2>1. Escolha a cor</h2>
            <div className="swatches">
              {COLORS.map((c, i) => (
                <div className="swatch" key={c.name}>
                  <button
                    aria-label={c.name}
                    aria-pressed={color === i}
                    onClick={() => setColor(i)}
                    style={{ background: c.hex }}
                  />
                  {c.name}
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <h2>2. Sua mensagem</h2>
            <div className="field">
              <label htmlFor="nick">Nome ou apelido</label>
              <input
                id="nick"
                maxLength={MAX_NICK}
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="Como vai aparecer no ranking"
              />
            </div>
            <div className="field">
              <label htmlFor="msg">Mensagem (uma frase)</label>
              <input
                id="msg"
                maxLength={MAX_MSG}
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="BORA ..."
              />
              <span className="counter">{msg.length}/{MAX_MSG}</span>
            </div>
            <div className="field">
              <label htmlFor="email">E-mail (para o comprovante do Pix)</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
          </div>

          <div className="section">
            <h2>3. Pinte e pague</h2>
            <div className="row">
              <span>Selecionados</span>
              <b>{num(selCount)} quadradinho{selCount === 1 ? '' : 's'}</b>
            </div>
            <div className="row">
              <span>Total</span>
              <span className="total">{brl(total)}</span>
            </div>
            {selCount > 0 && (
              <button className="link" onClick={clearSelection} style={{ alignSelf: 'flex-start' }}>
                Limpar seleção
              </button>
            )}
          </div>

          {error && <div className="error" role="alert">{error}</div>}

          <button className="btn" disabled={!canPay} onClick={pay}>
            {busy ? 'Gerando Pix...' : `Pagar ${brl(total)} com Pix`}
          </button>
          {selCount === 0 && <p className="hint">Clique ou arraste no mural para escolher seus quadradinhos.</p>}
        </aside>

        <section className="mural-col" aria-label="Mural">
          <div className="toolbar">
            <div className="toggle" role="group" aria-label="Modo">
              <button aria-pressed={mode === 'pintar'} onClick={() => setMode('pintar')}>Pintar</button>
              <button aria-pressed={mode === 'mover'} onClick={() => setMode('mover')}>Mover</button>
            </div>
            <button className="btn-light" onClick={fit}>Ver mural inteiro</button>
          </div>

          <div className="mural" ref={wrapRef}>
            <canvas
              ref={canvasRef}
              className="main"
              style={{ cursor: mode === 'mover' ? 'grab' : 'crosshair' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={onPointerLeave}
            />
            <div className="zoom">
              <button aria-label="Aproximar" onClick={zoomIn}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round"><path d="M9 3v12M3 9h12" /></svg>
              </button>
              <button aria-label="Afastar" onClick={zoomOut}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round"><path d="M3 9h12" /></svg>
              </button>
            </div>
            <div className="minimap">
              <span>Mural inteiro</span>
              <canvas
                ref={miniRef}
                width={320}
                height={240}
                aria-label="Mapa do mural. Clique para ir até um ponto."
                role="img"
                onPointerDown={onMiniPointer}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="coords">
              {hover ? `x ${num(hover.x + 1)} · y ${num(hover.y + 1)}` : 'Role para dar zoom'}
            </div>
          </div>
          <p className="hint">
            Pintar: clique ou arraste para selecionar (clique de novo para tirar). Mover: arraste para andar
            pelo mural. No computador, segure Shift ou use o botão direito para andar sem trocar de modo.
            No celular, use dois dedos para dar zoom.
          </p>
        </section>

        <aside className="card ranking" aria-label="Ranking">
          <h2>Maiores pintores</h2>
          {ranking === null && <div className="empty">Carregando...</div>}
          {ranking && ranking.length === 0 && (
            <div className="empty">Ninguém pintou ainda. Seja o primeiro!</div>
          )}
          {ranking &&
            ranking.map((r, i) => (
              <div className="rank-item" key={r.nickname + i}>
                <span className="rank-pos">{i + 1}</span>
                <span className="rank-dot" style={{ background: COLORS[r.color]?.hex || '#ccc' }} />
                <div className="rank-text">
                  <b>{r.nickname}</b>
                  {r.message && <span title={r.message}>{r.message}</span>}
                </div>
                <span className="rank-total">{num(r.total)}</span>
              </div>
            ))}
        </aside>
      </main>

      {checkout && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Pagamento Pix">
          <div className="modal">
            {checkout.status === 'pending' && (
              <>
                <h2>Pague com Pix</h2>
                <div className="row">
                  <span>{num(checkout.qty)} quadradinho{checkout.qty === 1 ? '' : 's'}</span>
                  <span className="total">{brl(checkout.amount)}</span>
                </div>
                {checkout.qrBase64 && (
                  <img className="qr" alt="QR Code do Pix" src={`data:image/png;base64,${checkout.qrBase64}`} />
                )}
                <div className="field">
                  <label htmlFor="copiacola">Pix copia e cola</label>
                  <div className="copy-row">
                    <input id="copiacola" readOnly value={checkout.qrCode} onFocus={(e) => e.target.select()} />
                    <button onClick={copyCode}>{copied ? 'Copiado!' : 'Copiar'}</button>
                  </div>
                </div>
                <div className="timer">Seus quadradinhos estão reservados por <b>{mm}:{ss}</b></div>
                <p className="hint">Assim que o Pix cair, eles são pintados na hora, na tela de todo mundo. Pode deixar esta janela aberta.</p>
                <button className="btn-light" onClick={() => setCheckout(null)}>Fechar</button>
              </>
            )}
            {checkout.status === 'paid' && (
              <>
                <h2>Pago!</h2>
                <div className="success">Seus {num(checkout.qty)} quadradinhos já estão pintados no mural. Valeu!</div>
                <button className="btn" onClick={() => setCheckout(null)}>Voltar ao mural</button>
              </>
            )}
            {checkout.status === 'expired' && (
              <>
                <h2>Tempo esgotado</h2>
                <p className="hint">A reserva venceu antes do Pix cair. Selecione os quadradinhos de novo para gerar outro Pix.</p>
                <button className="btn" onClick={() => setCheckout(null)}>Voltar ao mural</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
