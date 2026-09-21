/**
 * タイムラインは「何拍目にどのコードか」だけを持ち、進行を無限に繰り返す。
 * 画面のレーンはここから前後のコードを引くので、周回をまたいだ番号が要になる。
 */
import { describe, expect, it } from 'vitest';
import { buildTimeline, makeTimeline, placeRange, placeSlot, slotIndexAt } from '../src/core/timeline';

const PROG = ['C', 'Am', 'F', 'G7'];

describe('buildTimeline', () => {
  it('進行のコードを bpc 拍ずつ並べる', () => {
    const tl = buildTimeline(PROG, 4);
    expect(tl.slots).toEqual(PROG.map((chord) => ({ chord, beats: 4 })));
    expect(tl.starts).toEqual([0, 4, 8, 12]);
    expect(tl.cycleBeats).toBe(16);
  });

  it('長さがバラバラでも開始拍を積み上げる', () => {
    const tl = makeTimeline([
      { chord: 'C', beats: 4 },
      { chord: 'F', beats: 2 },
      { chord: 'G', beats: 2 },
    ]);
    expect(tl.starts).toEqual([0, 4, 6]);
    expect(tl.cycleBeats).toBe(8);
  });
});

describe('slotIndexAt', () => {
  const tl = buildTimeline(PROG, 4);

  it('カウントイン中 (負の拍) は -1', () => {
    expect(slotIndexAt(tl, -0.1)).toBe(-1);
    expect(slotIndexAt(tl, -4)).toBe(-1);
  });

  it('コードの区間は開始拍を含み、終わりの拍は次のコード', () => {
    expect(slotIndexAt(tl, 0)).toBe(0);
    expect(slotIndexAt(tl, 3.99)).toBe(0);
    expect(slotIndexAt(tl, 4)).toBe(1);
  });

  it('2周目以降は番号が続けて増える', () => {
    expect(slotIndexAt(tl, 16)).toBe(4);
    expect(slotIndexAt(tl, 20.5)).toBe(5);
    expect(slotIndexAt(tl, 35)).toBe(8);
  });

  it('長さがバラバラでも正しい区間を返す', () => {
    const mixed = makeTimeline([
      { chord: 'C', beats: 4 },
      { chord: 'F', beats: 2 },
    ]);
    expect(slotIndexAt(mixed, 3.5)).toBe(0);
    expect(slotIndexAt(mixed, 4)).toBe(1);
    expect(slotIndexAt(mixed, 5.9)).toBe(1);
    expect(slotIndexAt(mixed, 6)).toBe(2);
  });
});

describe('placeSlot', () => {
  const tl = buildTimeline(PROG, 4);

  it('番号からコードと開始拍を引ける', () => {
    expect(placeSlot(tl, 0)).toEqual({ index: 0, chord: 'C', startBeat: 0, beats: 4 });
    expect(placeSlot(tl, 2)).toEqual({ index: 2, chord: 'F', startBeat: 8, beats: 4 });
  });

  it('周回をまたいでも開始拍が続く', () => {
    expect(placeSlot(tl, 4)).toEqual({ index: 4, chord: 'C', startBeat: 16, beats: 4 });
    expect(placeSlot(tl, 5)).toEqual({ index: 5, chord: 'Am', startBeat: 20, beats: 4 });
  });

  it('負の番号 (1周前) も引ける', () => {
    expect(placeSlot(tl, -1)).toEqual({ index: -1, chord: 'G7', startBeat: -4, beats: 4 });
    expect(placeSlot(tl, -4)).toEqual({ index: -4, chord: 'C', startBeat: -16, beats: 4 });
  });

  it('slotIndexAt が返した番号の区間は、その拍を含む', () => {
    for (const beat of [0, 1.5, 4, 9.9, 16, 23]) {
      const p = placeSlot(tl, slotIndexAt(tl, beat));
      expect(beat).toBeGreaterThanOrEqual(p.startBeat);
      expect(beat).toBeLessThan(p.startBeat + p.beats);
    }
  });
});

describe('placeRange', () => {
  it('前後のコードを並べて返す', () => {
    const tl = buildTimeline(PROG, 4);
    expect(placeRange(tl, -1, 2).map((p) => p.chord)).toEqual(['G7', 'C', 'Am', 'F']);
    expect(placeRange(tl, -1, 2).map((p) => p.startBeat)).toEqual([-4, 0, 4, 8]);
  });

  it('コードが1つだけの進行でも繰り返せる', () => {
    const tl = buildTimeline(['C'], 2);
    expect(placeRange(tl, 0, 2).map((p) => p.startBeat)).toEqual([0, 2, 4]);
  });
});
