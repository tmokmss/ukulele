/**
 * クロマグラムの算出とコード照合。
 * PoC の computeChroma / scoreChords を、AudioContext に依存しない純関数として切り出したもの。
 * 定数は PoC のまま。実機で詰める前に値を動かすと、docs/notes.md の検証結果が効かなくなる。
 */
import { LIB, TEMPL } from './chords';

/** 解析する周波数の下限。Low-G はこの下限より低いので未対応 */
const F_LO = 235;
const F_HI = 1150;
/** これより高い倍音は重みを下げる */
const HARMONIC_ROLLOFF_HZ = 640;

/**
 * FFT の dB スペクトルからクロマ (12音階ごとのエネルギー) を作り、out に書く。
 * @param db getFloatFrequencyData の結果
 * @param binHz 1ビンあたりの周波数 (sampleRate / fftSize)
 * @param out 長さ12の出力バッファ (呼び出し側で使い回す)
 * @returns 帯域内の最大 dB。音が小さすぎるときは -200
 */
export function computeChroma(db: Float32Array, binHz: number, out: Float32Array): number {
  out.fill(0);
  const lo = Math.floor(F_LO / binHz);
  const hi = Math.ceil(F_HI / binHz);
  let maxDb = -200;
  for (let i = lo; i <= hi; i++) if (db[i] > maxDb) maxDb = db[i];
  if (!(maxDb > -82)) return -200;

  const floor = Math.max(maxDb - 38, -92);
  for (let i = lo + 1; i < hi; i++) {
    const b = Math.max(db[i], -140);
    if (b <= floor) continue;
    const a = Math.max(db[i - 1], -140);
    const c = Math.max(db[i + 1], -140);
    if (!(b > a && b >= c)) continue;
    // 放物線補間でピークの真の位置を出す (ビン幅より細かい分解能を稼ぐ)
    const den = a - 2 * b + c;
    const p = den ? (0.5 * (a - c)) / den : 0;
    const f = (i + p) * binHz;
    const midi = 69 + 12 * Math.log2(f / 440);
    const r = Math.round(midi);
    const dev = Math.abs(midi - r);
    if (dev > 0.42) continue;
    const w = f < HARMONIC_ROLLOFF_HZ ? 1 : Math.max(0.3, 1 - ((f - HARMONIC_ROLLOFF_HZ) / 510) * 0.7);
    out[((r % 12) + 12) % 12] += Math.pow(10, b / 33) * w * (1 - dev);
  }
  return maxDb;
}

export type ChordScores = {
  scores: Record<string, number>;
  best: string;
  bestScore: number;
};

/** クロマを全コードのテンプレートとコサイン類似度で照合する */
export function scoreChords(ch: Float32Array): ChordScores | null {
  let n = 0;
  for (let i = 0; i < 12; i++) n += ch[i] * ch[i];
  n = Math.sqrt(n);
  if (n < 1e-9) return null;

  const scores: Record<string, number> = {};
  let best = '';
  let bs = -1;
  for (const name of LIB) {
    const t = TEMPL[name];
    let dot = 0;
    for (const pc of t.pcs) dot += ch[pc];
    const sc = dot / (n * t.norm);
    scores[name] = sc;
    if (sc > bs) {
      bs = sc;
      best = name;
    }
  }
  return { scores, best, bestScore: bs };
}

/** ±50ms までジャスト、±110ms までは早め/遅め、それ以上は外れ */
export function timingClass(ms: number): 'good' | 'warn' | 'miss' {
  const a = Math.abs(ms);
  return a <= 50 ? 'good' : a <= 110 ? 'warn' : 'miss';
}

export function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
