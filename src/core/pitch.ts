/**
 * 鳴っている1音の基本周波数を出す。チューナー用。
 *
 * コード判定 (chroma.ts) は12音階に畳んでしまうので「いま何Hzか」が残らない。
 * こちらは弦を1本ずつ鳴らす前提で、倍音の並びから基本波のビンを選び、
 * 放物線補間でビン幅 (約3Hz) より細かい位置を出す。
 */
import { NOTE, OPEN, STRING_NAME } from './chords';

/** 基本周波数を探す範囲。3弦 C4 (262Hz) が1音下がっていても入る */
const F_LO = 180;
const F_HI = 900;
/** 倍音の重み。基本波が弱い弦でも、倍音の並びで基本周波数を決められる */
const HARMONIC_W = [1, 0.85, 0.6, 0.4];
/** これより静かなら鳴っていないとみなす */
const MIN_DB = -72;
/** いちばん強い山からこれだけ下の山は見ない (dB) */
const PEAK_RANGE_DB = 26;

/** ここに収まっていれば「合っている」とする (セント) */
export const TUNE_OK_CENTS = 5;
/** 開放弦からこれ以上離れていたら、どの弦か決めない (セント) */
const MAX_STRING_CENTS = 250;

export type Pitch = {
  hz: number;
  /** MIDI ノート番号 (小数)。半音を1とした高さ */
  midi: number;
};

/**
 * FFT の dB スペクトルから基本周波数を1つ拾う。
 * @param db getFloatFrequencyData の結果
 * @param binHz 1ビンあたりの周波数 (sampleRate / fftSize)
 */
export function detectPitch(db: Float32Array, binHz: number): Pitch | null {
  const lo = Math.max(2, Math.floor(F_LO / binHz));
  const hi = Math.min(db.length - 2, Math.ceil(F_HI / binHz));
  if (hi <= lo) return null;

  let maxDb = -200;
  for (let i = lo; i <= hi; i++) if (db[i] > maxDb) maxDb = db[i];
  if (maxDb < MIN_DB) return null;

  const floor = maxDb - PEAK_RANGE_DB;
  const mag = (i: number): number => (i < db.length ? Math.pow(10, Math.max(db[i], -140) / 20) : 0);
  // 弦の倍音はきっちり整数倍にならない。前後1ビンまで見て、いちばん強いところを倍音とする
  const magNear = (x: number): number => {
    const i = Math.round(x);
    return Math.max(mag(i - 1), mag(i), mag(i + 1));
  };

  let bestBin = -1;
  let bestScore = 0;
  for (let i = lo; i <= hi; i++) {
    if (db[i] <= floor) continue;
    if (!(db[i] > db[i - 1] && db[i] >= db[i + 1])) continue;
    let score = 0;
    for (let h = 0; h < HARMONIC_W.length; h++) score += HARMONIC_W[h] * magNear(i * (h + 1));
    if (score > bestScore) {
      bestScore = score;
      bestBin = i;
    }
  }
  if (bestBin < 0) return null;

  const a = Math.max(db[bestBin - 1], -140);
  const b = Math.max(db[bestBin], -140);
  const c = Math.max(db[bestBin + 1], -140);
  const den = a - 2 * b + c;
  const p = den ? (0.5 * (a - c)) / den : 0;
  const hz = (bestBin + p) * binHz;
  if (!(hz > 0)) return null;
  return { hz, midi: 69 + 12 * Math.log2(hz / 440) };
}

export type StringTarget = {
  /** 4弦→1弦 の並びでの番号 */
  index: number;
  /** 「3弦」 */
  name: string;
  /** 開放弦の音名 「C」 */
  note: string;
  /** 開放弦からのズレ (セント)。負なら低い */
  cents: number;
};

/** いちばん近い開放弦。どれからも離れていれば null */
export function nearestString(midi: number): StringTarget | null {
  let best = 0;
  for (let i = 1; i < OPEN.length; i++) {
    if (Math.abs(midi - OPEN[i]) < Math.abs(midi - OPEN[best])) best = i;
  }
  const cents = (midi - OPEN[best]) * 100;
  if (Math.abs(cents) > MAX_STRING_CENTS) return null;
  return { index: best, name: STRING_NAME[best], note: NOTE[OPEN[best] % 12], cents };
}

/** 「C4」の形の音名。オクターブは MIDI の慣例 (C4 = 60) */
export function noteName(midi: number): string {
  const r = Math.round(midi);
  return `${NOTE[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}
