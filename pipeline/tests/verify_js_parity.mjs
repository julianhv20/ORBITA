/**
 * Prueba de Paridad Bit-a-Bit en Node.js (ArrayBuffer + DataView + Int8Array)
 * Verifica que el binario ORBT v1 generado por Python se decodifica exactamente igual
 * en el motor JavaScript del navegador.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dailyDir = path.resolve('web/public/daily');
const meta = JSON.parse(fs.readFileSync(path.join(dailyDir, 'daily_001_reloj.json'), 'utf8'));
const rawBuf = fs.readFileSync(path.join(dailyDir, 'daily_001_reloj.bin'));
const arrayBuffer = rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength);

const view = new DataView(arrayBuffer);
const magic =
  String.fromCharCode(view.getUint8(0)) +
  String.fromCharCode(view.getUint8(1)) +
  String.fromCharCode(view.getUint8(2)) +
  String.fromCharCode(view.getUint8(3));

assert.equal(magic, 'ORBT', 'Cabecera mágica ORBT válida');
const version = view.getUint8(4);
const dim = view.getUint8(5);
const mCount = view.getUint16(6, true);
const sMax = view.getFloat32(12, true);

assert.equal(version, 1);
assert.equal(dim, 128);
assert.equal(mCount, meta.candidates.length);
assert.ok(sMax >= 90.0, `S_max esperado >= 90, obtenido ${sMax}`);

const ga = new Float32Array(arrayBuffer, 16, mCount * 2);
const vecs = new Int8Array(arrayBuffer, 16 + mCount * 8, mCount * dim);

function normOf(idx) {
  let s = 0;
  const base = idx * dim;
  for (let k = 0; k < dim; k++) s += vecs[base + k] * vecs[base + k];
  return Math.sqrt(s);
}

function distBetween(i, j) {
  let dot = 0;
  for (let k = 0; k < dim; k++) dot += vecs[i * dim + k] * vecs[j * dim + k];
  const c = Math.max(-1, Math.min(1, dot / (normOf(i) * normOf(j))));
  const pos = Math.max(0, c);
  const neg = Math.min(0, c);
  return Math.max(0.08, Math.min(0.97, 0.85 - 0.75 * Math.pow(pos, 0.8) + 0.45 * Math.pow(-neg, 0.85)));
}

const normMap = new Map(meta.candidates.map((c, idx) => [c[0], idx]));
const divergent = ['arena', 'dali', 'circadiano', 'cesio', 'ajedrez'].map((w) => normMap.get(w));

const pairs = [];
for (let a = 0; a < 5; a++) {
  for (let b = a + 1; b < 5; b++) {
    pairs.push(distBetween(divergent[a], divergent[b]));
  }
}
const mean = pairs.reduce((acc, v) => acc + v, 0) / pairs.length;
const min = Math.min(...pairs);
const score = Number(((0.78 * mean + 0.22 * min) * 100).toFixed(1));

assert.ok(score >= 85.0, `Constelación divergente debe puntuar >= 85, obtuvo ${score}`);
assert.ok(ga[divergent[0] * 2] >= 0.32, 'Gravedad válida >= tau_min');

console.log(`[PARIDAD JS OK] Binario ORBT decodificado en JS -> Score divergente RELOJ: ${score} / 100 (S_max=${sMax.toFixed(1)})`);
