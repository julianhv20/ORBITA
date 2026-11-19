/**
 * Ranking diario de ÓRBITA (Vercel Function).
 * - POST: recibe las 5 palabras (indices de vocabulario) y RECALCULA el puntaje en el servidor
 *   con el mismo motor que el cliente; el puntaje enviado por el cliente se ignora.
 * - GET:  top 20 del dia + posicion del jugador.
 * Almacenamiento: Upstash Redis (REST). Variables: UPSTASH_REDIS_REST_URL/TOKEN o KV_REST_API_URL/TOKEN.
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(process.cwd(), 'web', 'public', 'v2');
const TARGET = 5;

let cache = null;

function normalize(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'ñ')
    .replace(/[^a-zñ]/g, '');
}

function load() {
  if (cache) return cache;
  const manifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));
  const buf = fs.readFileSync(path.join(DATA, manifest.vocab.bin));
  const dim = buf.readUInt8(5);
  const count = buf.readUInt32LE(6);
  const unit = new Float32Array(count * dim);
  for (let i = 0; i < count; i++) {
    let s = 0;
    for (let k = 0; k < dim; k++) {
      const v = buf.readInt8(10 + i * dim + k);
      s += v * v;
    }
    const inv = 1 / Math.sqrt(Math.max(s, 1e-9));
    for (let k = 0; k < dim; k++) unit[i * dim + k] = buf.readInt8(10 + i * dim + k) * inv;
  }
  cache = { manifest, dim, count, unit, days: new Map(), words: fs.readFileSync(path.join(DATA, manifest.vocab.words), 'utf8').split(/\r?\n/) };
  return cache;
}

function getDay(c, entry) {
  if (!c.days.has(entry.id)) c.days.set(entry.id, JSON.parse(fs.readFileSync(path.join(DATA, entry.file), 'utf8')));
  return c.days.get(entry.id);
}

function gameDay(manifest) {
  const epoch = Date.parse(`${manifest.epochDate}T00:00:00Z`);
  const shifted = Date.now() + manifest.tzOffsetMinutes * 60000;
  return {
    index: Math.max(0, Math.floor((shifted - epoch) / 86400000)),
    key: new Date(shifted).toISOString().slice(0, 10),
  };
}

function tangent(c, day, idx) {
  const d = c.dim;
  const core = day.coreIdx * d;
  let g = 0;
  for (let k = 0; k < d; k++) g += c.unit[idx * d + k] * c.unit[core + k];
  const u = new Float64Array(d);
  let n = 0;
  for (let k = 0; k < d; k++) {
    const x = c.unit[idx * d + k] - g * c.unit[core + k];
    u[k] = x;
    n += x * x;
  }
  const inv = 1 / Math.sqrt(Math.max(n, 1e-12));
  for (let k = 0; k < d; k++) u[k] *= inv;
  return { u, g };
}

function anchorMap(raw, an) {
  const pts = [[an.p01, 35], [an.p10, 55], [an.p50, 70], [an.p90, 85], [an.best, 97]];
  if (raw <= pts[0][0]) {
    const slope = (pts[1][1] - pts[0][1]) / Math.max(1e-6, pts[1][0] - pts[0][0]);
    return Math.max(8, pts[0][1] - (pts[0][0] - raw) * slope);
  }
  for (let i = 1; i < pts.length; i++) {
    if (raw <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((raw - x0) / Math.max(1e-6, x1 - x0)) * (y1 - y0);
    }
  }
  return Math.min(100, 97 + (raw - an.best) * 30);
}

function scoreWords(c, day, idxs) {
  const sc = c.manifest.scoring;
  const ts = idxs.map((i) => tangent(c, day, i));
  let sum = 0;
  let min = 9;
  let pairs = 0;
  for (let a = 0; a < ts.length; a++) {
    for (let b = a + 1; b < ts.length; b++) {
      let dot = 0;
      for (let k = 0; k < c.dim; k++) dot += ts[a].u[k] * ts[b].u[k];
      const d = 1 - dot;
      sum += d;
      min = Math.min(min, d);
      pairs++;
    }
  }
  const divergence = anchorMap(sc.wMean * (sum / pairs) + sc.wMin * min, day.anchors);
  const bridges = new Set(day.bridges);
  const tierValue = (i, j) => (bridges.has(i) ? sc.conn.bridge : ts[j].g >= day.tauNear ? sc.conn.near : sc.conn.far);
  const norm = day.hasBridges ? 1 : sc.conn.near;
  const conn = Math.min(1, idxs.reduce((acc, i, j) => acc + tierValue(i, j), 0) / idxs.length / norm);
  return Number(Math.min(100, sc.wDiv * divergence + sc.wConn * conn).toFixed(1));
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redis(cfg, commands) {
  const r = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).map((x) => x.result);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = redisConfig();
  if (!cfg) return res.status(503).json({ error: 'storage_not_configured' });

  try {
    const c = load();
    const today = gameDay(c.manifest);

    if (req.method === 'GET') {
      const day = String(req.query.day || today.key);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'bad_day' });
      const playerId = String(req.query.playerId || '');
      const cmds = [
        ['ZREVRANGE', `lb:${day}`, 0, 19, 'WITHSCORES'],
        ['ZCARD', `lb:${day}`],
      ];
      if (playerId) cmds.push(['ZREVRANK', `lb:${day}`, playerId], ['ZSCORE', `lb:${day}`, playerId]);
      const out = await redis(cfg, cmds);
      const flat = out[0] || [];
      const ids = [];
      const scores = [];
      for (let i = 0; i < flat.length; i += 2) {
        ids.push(flat[i]);
        scores.push(Number(flat[i + 1]));
      }
      const names = ids.length ? (await redis(cfg, [['HMGET', `lb:${day}:names`, ...ids]]))[0] : [];
      const top = ids.map((_, i) => ({ name: names[i] || 'Viajero', score: scores[i] }));
      const me = playerId && out[2] !== null && out[2] !== undefined ? { rank: Number(out[2]) + 1, score: Number(out[3]) } : null;
      return res.status(200).json({ total: Number(out[1] || 0), top, me });
    }

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const playerId = String(b.playerId || '');
      if (!/^[a-zA-Z0-9]{8,40}$/.test(playerId)) return res.status(400).json({ error: 'bad_player' });
      if (b.day !== today.key) return res.status(400).json({ error: 'wrong_day' });
      const entry = c.manifest.puzzles[today.index % c.manifest.puzzles.length];
      if (b.puzzleId !== entry.id) return res.status(400).json({ error: 'wrong_puzzle' });
      const day = getDay(c, entry);

      const words = Array.isArray(b.words) ? b.words.map(Number) : [];
      if (
        words.length !== TARGET ||
        new Set(words).size !== TARGET ||
        words.some((w) => !Number.isInteger(w) || w < 0 || w >= c.count || w === day.coreIdx)
      ) {
        return res.status(400).json({ error: 'bad_words' });
      }
      const roche = new Set(day.roche);
      if (words.some((w) => roche.has(normalize(c.words[w])))) return res.status(400).json({ error: 'roche_word' });

      const name = String(b.name || 'Viajero').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16) || 'Viajero';
      const score = scoreWords(c, day, words);
      const ttl = 60 * 60 * 24 * 120;
      const out = await redis(cfg, [
        ['ZADD', `lb:${today.key}`, 'NX', score, playerId],
        ['HSET', `lb:${today.key}:names`, playerId, name],
        ['EXPIRE', `lb:${today.key}`, ttl],
        ['EXPIRE', `lb:${today.key}:names`, ttl],
      ]);
      return res.status(200).json({ ok: true, score, accepted: out[0] === 1 });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e && e.message) });
  }
};
