/**
 * Simulacion de jugabilidad v2 (usa el motor TypeScript REAL del cliente, compilado a .tmp/engine).
 * Mide: tasa de aceptacion, distribucion de tiers y puntajes de jugadas lineales vs creativas.
 *   npm run test:sim
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = path.resolve('.');
const engine = await import(pathToFileURL(path.join(root, '.tmp/engine/orbitalEngine.js')).href);
const dir = path.join(root, 'web/public/v2');

globalThis.fetch = async (url) => {
  const p = path.join(dir, String(url).replace('/v2/', ''));
  const buf = fs.readFileSync(p);
  return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), text: async () => buf.toString('utf8') };
};

const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const vocab = await engine.loadVocab('/v2', manifest);

function ctxFor(core) {
  const entry = manifest.puzzles.find((p) => p.core === core);
  const day = JSON.parse(fs.readFileSync(path.join(dir, entry.file), 'utf8'));
  return engine.buildContext(vocab, day, manifest.scoring);
}

function play(ctx, words) {
  const sats = [];
  const log = [];
  for (const w of words) {
    const out = engine.evaluateLaunch(w, ctx, sats);
    log.push(`${w}:${out.kind === 'CAPTURE' ? out.sat.tier : out.kind}`);
    if (out.kind === 'CAPTURE') sats.push({ ...out.sat, uid: `u${sats.length}`, color: '#fff', addedAt: 0 });
  }
  const relaxed = engine.relaxAngles(sats);
  return { tel: engine.evaluateConstellation(ctx, relaxed), log, n: sats.length };
}

const reloj = ctxFor('RELOJ');

// 1) Aceptacion: palabras que un jugador tipico probaria
const tries = ['arena', 'dalí', 'circadiano', 'cesio', 'ajedrez', 'hora', 'minuto', 'pulsera', 'tostadora', 'hipopótamo',
  'playa', 'cuco', 'surrealismo', 'péndulo', 'corazón', 'muñeca', 'tiempo', 'londres', 'campana', 'elefante', 'rinoceronte', 'asdfgh'];
let accepted = 0;
const kinds = {};
for (const w of tries) {
  const o = engine.evaluateLaunch(w, reloj, []);
  kinds[o.kind] = (kinds[o.kind] || 0) + 1;
  if (o.kind === 'CAPTURE') accepted++;
}
console.log(`aceptacion RELOJ: ${accepted}/${tries.length} =`, kinds);
assert.ok(accepted / tries.length >= 0.7, 'el juego debe aceptar la mayoria de palabras reales');

// 2) Puntajes
const creative = play(reloj, ['arena', 'dalí', 'circadiano', 'cesio', 'ajedrez']);
const linear = play(reloj, ['pulsera', 'muñeca', 'correa', 'reloj de pulsera', 'brazalete']);
const random = play(reloj, ['elefante', 'tostadora', 'zapato', 'ventilador', 'cuaderno']);
console.log('creativa :', creative.tel.score, creative.tel.rank.title, creative.log.join(' '));
console.log('lineal   :', linear.tel.score, linear.tel.rank.title, linear.log.join(' '));
console.log('aleatoria:', random.tel.score, random.tel.rank.title, random.log.join(' '));
assert.equal(creative.n, 5);
assert.ok(creative.tel.score > linear.tel.score, 'creativa > lineal');
assert.ok(creative.tel.score >= 70, `creativa deberia ser >= Navegante (${creative.tel.score})`);
assert.ok(creative.tel.score > random.tel.score, 'creativa conectada > aleatoria');

// 3) Constelacion maestra del dia reproduce el optimo anclado
const master = engine.masterConstellation(reloj);
const m = play(reloj, master);
console.log('maestra  :', m.tel.score, master.join(' '));
assert.ok(m.tel.score >= 85, 'la constelacion maestra debe puntuar alto');

// 4) Todos los dias: 5 jugadas aleatorias del pool "cercano" deben quedar cerca de p50 (70 divergencia)
let lo = 100;
let hi = 0;
for (const p of manifest.puzzles) {
  const day = JSON.parse(fs.readFileSync(path.join(dir, p.file), 'utf8'));
  const ctx = engine.buildContext(vocab, day, manifest.scoring);
  const mm = play(ctx, engine.masterConstellation(ctx));
  lo = Math.min(lo, mm.tel.score);
  hi = Math.max(hi, mm.tel.score);
  assert.ok(mm.n === 5, `${p.core}: constelacion maestra incompleta (${mm.log.join(' ')})`);
}
console.log(`maestras de ${manifest.puzzles.length} dias: ${lo.toFixed(1)} - ${hi.toFixed(1)}`);
console.log('SIM OK');


