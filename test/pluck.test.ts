/**
 * お手本が本当にその高さで鳴っているかを、鳴らさずに確かめる。
 *
 * 作った波形をアプリ自身のピッチ検出 (detectPitch) に通す。採点で使っているのと
 * 同じ耳で聞かせることになるので、ここが合っていれば「弾いたつもりの音」と
 * 「アプリに聞こえる音」がずれていない。
 */
import { describe, expect, it } from 'vitest';
import { freqOf, pluckSamples } from '../src/audio/pluck';
import { chordMidi, LIB } from '../src/core/chords';
import { computeChroma, scoreChords } from '../src/core/chroma';
import { detectPitch } from '../src/core/pitch';
import { spectrumDb } from './fft';

const SR = 48000;
const N = 16384;

/** 波形の頭を切り出して、アプリのピッチ検出にかける */
function heardMidi(samples: Float32Array): number | null {
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = samples[i] ?? 0;
  const p = detectPitch(spectrumDb(win), SR / N);
  return p ? p.midi : null;
}

describe('pluckSamples', () => {
  it('狙った高さで鳴る (ウクレレの音域を一通り)', () => {
    // 開放の C4 から、よく使う範囲の上 (D5) まで
    for (let midi = 60; midi <= 74; midi++) {
      const heard = heardMidi(pluckSamples(SR, midi));
      expect(heard, `MIDI ${midi}`).not.toBeNull();
      expect(Math.abs((heard as number) - midi), `MIDI ${midi} → ${heard}`).toBeLessThan(0.5);
    }
  });

  it('C コードの4弦ぶんが、それぞれの高さで鳴る', () => {
    for (const midi of chordMidi('C')) {
      const heard = heardMidi(pluckSamples(SR, midi));
      expect(Math.abs((heard as number) - midi), `MIDI ${midi} → ${heard}`).toBeLessThan(0.5);
    }
  });

  it('高さが変わっても減衰の速さは揃う (高い音だけ先に消えない)', () => {
    // 1.2 秒地点の残り具合を、低い音と高い音で比べる
    const tail = (midi: number): number => {
      const d = pluckSamples(SR, midi);
      const at = Math.round(1.2 * SR);
      let sum = 0;
      for (let i = at; i < at + 2048; i++) sum += d[i] * d[i];
      return Math.sqrt(sum / 2048);
    };
    const low = tail(60);
    const high = tail(74);
    expect(high).toBeGreaterThan(low * 0.2);
    expect(high).toBeLessThan(low * 5);
  });

  it('最後まで暴れない (発散しない)', () => {
    for (const midi of [60, 67, 74]) {
      const d = pluckSamples(SR, midi);
      let peak = 0;
      for (const v of d) peak = Math.max(peak, Math.abs(v));
      expect(peak, `MIDI ${midi}`).toBeLessThanOrEqual(1);
    }
  });

  it('freqOf は A4 = 440Hz', () => {
    expect(freqOf(69)).toBeCloseTo(440, 6);
    expect(freqOf(60)).toBeCloseTo(261.626, 2);
  });
});

/**
 * お手本の和音を、アプリ自身のコード判定にかける。
 * 採点と一緒に鳴らす以上、お手本がマイクに回り込めばこの判定を通ることになるので、
 * 「狙ったコードとして聞こえる」ことは押さえておく。押さえ方を間違えていればここで落ちる。
 */
describe('お手本の和音', () => {
  /** ダウンストロークを1回ぶん合成する。4弦から順に少しずつずらしてなでる */
  function strummed(chord: string): Float64Array {
    const sig = new Float64Array(N);
    chordMidi(chord).forEach((midi, s) => {
      const d = pluckSamples(SR, midi);
      const off = Math.round(s * 0.013 * SR);
      for (let i = off; i < N; i++) sig[i] += d[i - off] * 0.25;
    });
    return sig;
  }

  for (const chord of LIB) {
    it(`${chord} が ${chord} として聞こえる`, () => {
      const chroma = new Float32Array(12);
      const maxDb = computeChroma(spectrumDb(strummed(chord)), SR / N, chroma);
      expect(maxDb).toBeGreaterThan(-82);
      const scored = scoreChords(chroma);
      expect(scored).not.toBeNull();
      // アプリの採点と同じ判定: 1位が一致するか、僅差 (0.04) に収まっていればよい
      const ok = scored!.best === chord || scored!.scores[chord] >= scored!.bestScore - 0.04;
      expect(ok, `best=${scored!.best} (${scored!.bestScore.toFixed(3)}) target=${scored!.scores[chord].toFixed(3)}`).toBe(true);
    });
  }
});
