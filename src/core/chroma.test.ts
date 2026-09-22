/**
 * PoC から移したコード判定ロジックが、16コード全部で通ることを確かめる。
 * docs/notes.md にある「Blackman窓のFFTをNodeで再現して検証した」を、リポジトリに残る形にしたもの。
 */
import { describe, expect, it } from 'vitest';
import { CHORDS, LIB, OPEN, TEMPL } from './chords';
import { computeChroma, scoreChords } from './chroma';
import { spectrumDb } from '../testing/fft';

const SAMPLE_RATE = 48000;
const FFT_SIZE = 16384;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE;
/** ウクレレらしさを出すための倍音の振幅比 */
const PARTIALS = [1, 0.5, 0.3, 0.18];

function midiToHz(midi: number, cents: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12) * Math.pow(2, cents / 1200);
}

/** コードを鳴らした時間波形を作る。mute に弦番号を渡すとその弦を鳴らさない */
function renderChord(chord: string, cents: number, mute = -1): Float64Array {
  const frets = CHORDS[chord];
  const sig = new Float64Array(FFT_SIZE);
  for (let s = 0; s < 4; s++) {
    if (s === mute) continue;
    const f0 = midiToHz(OPEN[s] + frets[s], cents);
    for (let h = 0; h < PARTIALS.length; h++) {
      const f = f0 * (h + 1);
      if (f > SAMPLE_RATE / 2) break;
      const amp = (PARTIALS[h] * 0.25) / 4;
      const phase = Math.random() * Math.PI * 2;
      for (let i = 0; i < FFT_SIZE; i++) sig[i] += amp * Math.sin((2 * Math.PI * f * i) / SAMPLE_RATE + phase);
    }
  }
  return sig;
}

function analyze(chord: string, cents: number, mute = -1) {
  const db = spectrumDb(renderChord(chord, cents, mute));
  const chroma = new Float32Array(12);
  const maxDb = computeChroma(db, BIN_HZ, chroma);
  return { maxDb, chroma, scored: scoreChords(chroma) };
}

describe('コード判定', () => {
  for (const chord of LIB) {
    // アプリ側の判定と同じ: 1位が一致するか、僅差 (0.04) で収まっていれば通す
    for (const cents of [0, 20, -20]) {
      it(`${chord} を ${cents >= 0 ? '+' : ''}${cents} セントのずれで判定できる`, () => {
        const { maxDb, scored } = analyze(chord, cents);
        expect(maxDb).toBeGreaterThan(-82);
        expect(scored).not.toBeNull();
        const ok = scored!.best === chord || scored!.scores[chord] >= scored!.bestScore - 0.04;
        expect(ok, `best=${scored!.best} (${scored!.bestScore.toFixed(3)}) target=${scored!.scores[chord].toFixed(3)}`).toBe(true);
      });
    }
  }
});

describe('弱い弦の検出', () => {
  it('鳴らしている音はどれも弱いと判定されない', () => {
    const { chroma } = analyze('C', 0);
    const t = TEMPL['C'];
    let mx = 0;
    for (const pc of t.pcs) mx = Math.max(mx, chroma[pc]);
    expect(t.pcs.filter((pc) => chroma[pc] / mx < 0.16)).toEqual([]);
  });

  it('ミュートした弦の音が弱いと出る', () => {
    // C は 4弦G / 3弦C / 2弦E / 1弦C。2弦 (E) を止めると E が落ちる
    const ePc = TEMPL['C'].stringPcs[2];
    const { chroma } = analyze('C', 0, 2);
    const t = TEMPL['C'];
    let mx = 0;
    for (const pc of t.pcs) mx = Math.max(mx, chroma[pc]);
    expect(t.pcs.filter((pc) => chroma[pc] / mx < 0.16)).toContain(ePc);
  });
});
