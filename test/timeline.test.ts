/**
 * タイムラインは「何拍目にどのコードか」だけを持ち、進行を無限に繰り返す。
 * 画面のレーンはここから前後のコードを引くので、周回をまたいだ番号が要になる。
 */
import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  canJudgeChords,
  firstHitBeat,
  hitsBefore,
  hitsInRange,
  isSlotStart,
  makeTimeline,
  matchStroke,
  nearestHit,
  placeRange,
  placeSlot,
  planEnd,
  slotIndexAt,
  type Hit,
} from '../src/core/timeline';

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
      const p = placeSlot(tl, slotIndexAt(tl, beat))!;
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

describe('終わりのあるタイムライン (楽譜)', () => {
  // 4拍 × 3コードを2周。楽譜はここでおしまい、という端がある
  const tl = makeTimeline(
    [
      { chord: 'C', beats: 4 },
      { chord: 'F', beats: 2 },
      { chord: 'G7', beats: 2 },
    ],
    { barBeats: 4, cycles: 2 },
  );

  it('外に出た番号は null', () => {
    expect(placeSlot(tl, -1)).toBeNull();
    expect(placeSlot(tl, 6)).toBeNull();
    expect(placeSlot(tl, 5)).toEqual({ index: 5, chord: 'G7', startBeat: 14, beats: 2 });
  });

  it('レーンに並べるときは、端から先を落とす', () => {
    expect(placeRange(tl, 4, 9).map((p) => p.chord)).toEqual(['F', 'G7']);
    expect(placeRange(tl, -1, 1).map((p) => p.chord)).toEqual(['C', 'F']);
  });

  it('終わりは回数ぶん', () => {
    expect(planEnd(tl, 70, 60)).toEqual({ slots: 6, beat: 16 });
  });
});

describe('isSlotStart', () => {
  const tl = buildTimeline(['C', 'Am'], 4);

  it('コードが変わる拍だけ true', () => {
    expect(isSlotStart(tl, 0)).toBe(true);
    expect(isSlotStart(tl, 2)).toBe(false);
    expect(isSlotStart(tl, 4)).toBe(true);
    expect(isSlotStart(tl, 8)).toBe(true);
    expect(isSlotStart(tl, -4)).toBe(false);
  });

  it('長さがバラバラでも切れ目を拾う', () => {
    const mixed = makeTimeline([
      { chord: 'C', beats: 3 },
      { chord: 'F', beats: 1 },
    ]);
    expect([0, 1, 2, 3, 4, 5].map((b) => isSlotStart(mixed, b))).toEqual([true, false, false, true, true, false]);
  });
});

describe('planEnd', () => {
  const tl = buildTimeline(['C', 'Am', 'F', 'G7'], 4);

  it('練習時間をコードの切れ目に寄せる', () => {
    // 70BPM で 60秒 = 70拍。4拍のコード17個 (68拍) と18個 (72拍) では、近い方
    expect(planEnd(tl, 70, 60)).toEqual({ slots: 18, beat: 72 });
    expect(planEnd(tl, 60, 60)).toEqual({ slots: 15, beat: 60 });
  });

  it('「止めるまで」は終わりがない', () => {
    expect(planEnd(tl, 70, 0)).toBeNull();
  });

  it('短すぎてもコード1つは残す', () => {
    expect(planEnd(tl, 70, 1)).toEqual({ slots: 1, beat: 4 });
  });
});

describe('打点 (ストローク指定のある楽譜)', () => {
  // 1小節4拍 × 2小節、島ストローク D-DU-UDU を2周
  const hits: Hit[] = [
    { beat: 0, dir: 'D' },
    { beat: 1, dir: 'D' },
    { beat: 1.5, dir: 'U' },
    { beat: 2.5, dir: 'U' },
    { beat: 3, dir: 'D' },
    { beat: 3.5, dir: 'U' },
  ];
  const tl = makeTimeline([{ chord: 'C', beats: 2 }, { chord: 'F', beats: 2 }], {
    barBeats: 4,
    cycles: 2,
    hits,
  });

  it('いちばん近い打点に寄せる。隣までの距離も返す', () => {
    expect(nearestHit(tl, 1.4)).toEqual({ beat: 1.5, dir: 'U', gap: 0.5 });
    expect(nearestHit(tl, 0.2)).toMatchObject({ beat: 0, dir: 'D' });
  });

  it('周をまたいだ直後は、次の周の頭に寄る', () => {
    expect(nearestHit(tl, 3.9)).toMatchObject({ beat: 4, dir: 'D' });
    expect(nearestHit(tl, 4.1)).toMatchObject({ beat: 4, dir: 'D' });
  });

  it('ストローク指定がなければ null', () => {
    expect(nearestHit(buildTimeline(['C'], 4), 1)).toBeNull();
  });

  it('その拍までに鳴らすはずだった回数', () => {
    expect(hitsBefore(tl, 0)).toBe(0);
    expect(hitsBefore(tl, 2)).toBe(3);
    expect(hitsBefore(tl, 4)).toBe(6);
    expect(hitsBefore(tl, 8)).toBe(12);
  });

  it('レーンに描くぶんだけ、周をまたいで並べる', () => {
    expect(hitsInRange(tl, 3, 5).map((h) => h.beat)).toEqual([3, 3.5, 4, 5]);
    // 曲の終わり (2周 = 8拍) より先は出さない
    expect(hitsInRange(tl, 7, 12).map((h) => h.beat)).toEqual([7, 7.5]);
  });

  it('コードの中で最初に鳴らす位置で、チェンジのタイミングを測る', () => {
    // 2拍目から始まる F は、打点が 2.5 にしかない
    expect(firstHitBeat(tl, placeSlot(tl, 1)!)).toBe(2.5);
    expect(firstHitBeat(tl, placeSlot(tl, 2)!)).toBe(4);
  });

  it('ストローク指定がなければ、コードの頭そのもの', () => {
    const plain = buildTimeline(['C', 'F'], 4);
    expect(firstHitBeat(plain, placeSlot(plain, 1)!)).toBe(4);
  });
});

describe('canJudgeChords', () => {
  it('コードが0.5秒を切るとコード判定をあきらめる', () => {
    const fast = makeTimeline([{ chord: 'C', beats: 0.5 }], { cycles: 1 });
    // 0.5拍 = 120BPM で 0.25秒
    expect(canJudgeChords(fast, 120)).toBe(false);
    // 60BPM なら 0.5秒
    expect(canJudgeChords(fast, 60)).toBe(true);
  });

  it('ふつうの進行の練習はいつでも判定できる', () => {
    expect(canJudgeChords(buildTimeline(['C', 'F'], 2), 180)).toBe(true);
  });
});

describe('matchStroke', () => {
  // 120BPM = 1拍 0.5秒。8分の打点 D-DU-UDU
  const beatDur = 0.5;
  const strum: Hit[] = [
    { beat: 0, dir: 'D' },
    { beat: 1, dir: 'D' },
    { beat: 1.5, dir: 'U' },
    { beat: 2.5, dir: 'U' },
    { beat: 3, dir: 'D' },
    { beat: 3.5, dir: 'U' },
  ];
  const withHits = makeTimeline([{ chord: 'C', beats: 4 }], { barBeats: 4, cycles: 2, hits: strum });
  const plain = buildTimeline(['C', 'F'], 4);

  it('打点の近くで鳴らせば、その打点のぶんになる', () => {
    const m = matchStroke(withHits, 1.06, beatDur, 8);
    expect(m).toMatchObject({ kind: 'hit', at: 1 });
    expect(m.kind === 'hit' && m.off).toBeCloseTo(0.03, 5);
    expect(matchStroke(withHits, 2.4, beatDur, 8)).toMatchObject({ kind: 'hit', at: 2.5 });
  });

  it('休符のところで鳴らすと余分になる', () => {
    // 2拍目は D-DU-UDU の "-"。いちばん近い打点 (1.5 と 2.5) から 0.25秒ずれている
    expect(matchStroke(withHits, 2, beatDur, 8).kind).toBe('extra');
  });

  it('カウントイン中と曲の外は数えない', () => {
    expect(matchStroke(withHits, -1, beatDur, 8)).toEqual({ kind: 'none' });
    expect(matchStroke(withHits, 8.2, beatDur, 8)).toEqual({ kind: 'none' });
  });

  it('打点のない曲では、拍に寄せて裏拍は捨てる', () => {
    expect(matchStroke(plain, 2.04, beatDur, null)).toMatchObject({ kind: 'hit', at: 2 });
    // 拍の ±30% の外。余分ではなく、単に数えない
    expect(matchStroke(plain, 2.5, beatDur, null)).toEqual({ kind: 'none' });
  });

  it('遅いテンポでも、許容は 250ms で頭打ち', () => {
    // 40BPM (1拍1.5秒) なら 30% は 450ms だが、250ms までしか許さない
    expect(matchStroke(plain, 0.2, 1.5, null)).toEqual({ kind: 'none' });
    expect(matchStroke(plain, 0.15, 1.5, null)).toMatchObject({ kind: 'hit', at: 0 });
  });
});
