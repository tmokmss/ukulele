/**
 * コードを「拍の上に置かれたスロット」として持つ。
 *
 * 練習モード (進行 × bpc 拍を延々と繰り返す) と楽譜モード (小節ごとに長さが変わり、
 * 終わりがある) の違いは、ここで吸収する。画面もエンジンも Timeline だけを見ればいい。
 */

export type Slot = { chord: string; beats: number };

export type Timeline = {
  slots: Slot[];
  /** slots[i] が1周目で始まる拍 */
  starts: number[];
  /** 1周ぶんの拍数 */
  cycleBeats: number;
  /** クリックのアクセントを置く間隔。進行なら1コードの拍数、楽譜なら1小節の拍数 */
  barBeats: number;
  /** 通す回数。null は「止めるまで繰り返す」 */
  cycles: number | null;
};

/** タイムライン上の1コード。index は周回をまたいで増え続ける絶対番号 */
export type Placed = { index: number; chord: string; startBeat: number; beats: number };

/** 練習の終わり */
export type PlanEnd = {
  /** 採点するコードの数 */
  slots: number;
  /** 終わりの拍 */
  beat: number;
};

type Options = { barBeats?: number; cycles?: number | null };

export function makeTimeline(slots: Slot[], opts: Options = {}): Timeline {
  const starts: number[] = [];
  let acc = 0;
  for (const s of slots) {
    starts.push(acc);
    acc += s.beats;
  }
  return { slots, starts, cycleBeats: acc, barBeats: opts.barBeats ?? 4, cycles: opts.cycles ?? null };
}

/** 練習モード: 進行のコードを bpc 拍ずつ並べ、止めるまで繰り返す */
export function buildTimeline(prog: string[], bpc: number): Timeline {
  return makeTimeline(
    prog.map((chord) => ({ chord, beats: bpc })),
    { barBeats: bpc },
  );
}

/** 全部で何コードあるか。繰り返すタイムラインは null */
export function slotCount(tl: Timeline): number | null {
  return tl.cycles == null ? null : tl.slots.length * tl.cycles;
}

/** 全部で何拍あるか。繰り返すタイムラインは null */
export function totalBeats(tl: Timeline): number | null {
  return tl.cycles == null ? null : tl.cycleBeats * tl.cycles;
}

/** その拍を含むスロットの絶対番号。カウントイン中 (負の拍) は -1 */
export function slotIndexAt(tl: Timeline, beat: number): number {
  if (beat < 0) return -1;
  const cycle = Math.floor(beat / tl.cycleBeats);
  const local = beat - cycle * tl.cycleBeats;
  let i = tl.starts.length - 1;
  while (i > 0 && tl.starts[i] > local) i--;
  return cycle * tl.slots.length + i;
}

/**
 * 絶対番号からコードと開始拍を引く。
 * 繰り返すタイムラインは番号が負でも先でもよい。終わりがあるものは、外に出ると null
 */
export function placeSlot(tl: Timeline, index: number): Placed | null {
  const total = slotCount(tl);
  if (total != null && (index < 0 || index >= total)) return null;
  const n = tl.slots.length;
  const cycle = Math.floor(index / n);
  const i = index - cycle * n;
  return {
    index,
    chord: tl.slots[i].chord,
    startBeat: cycle * tl.cycleBeats + tl.starts[i],
    beats: tl.slots[i].beats,
  };
}

/** from..to (絶対番号) のスロットを並べて返す。タイムラインの外は詰めて落とす */
export function placeRange(tl: Timeline, from: number, to: number): Placed[] {
  const out: Placed[] = [];
  for (let i = from; i <= to; i++) {
    const p = placeSlot(tl, i);
    if (p) out.push(p);
  }
  return out;
}

/** その拍でコードが変わるか。ストロークを「チェンジ」として数えるかの判定に使う */
export function isSlotStart(tl: Timeline, beat: number): boolean {
  if (beat < 0) return false;
  const local = beat - Math.floor(beat / tl.cycleBeats) * tl.cycleBeats;
  return tl.starts.includes(local);
}

/**
 * 練習をどこで終えるか。
 * 楽譜は回数で決まっている。進行は練習時間から、いちばん近いコードの切れ目に寄せる
 */
export function planEnd(tl: Timeline, bpm: number, sessionSec: number): PlanEnd | null {
  const total = slotCount(tl);
  if (total != null) return { slots: total, beat: totalBeats(tl)! };
  if (!sessionSec) return null;
  const target = (sessionSec * bpm) / 60;
  let slots = 0;
  let beat = 0;
  while (beat < target) {
    beat += tl.slots[slots % tl.slots.length].beats;
    slots++;
  }
  const prev = beat - tl.slots[(slots - 1) % tl.slots.length].beats;
  if (slots > 1 && target - prev < beat - target) return { slots: slots - 1, beat: prev };
  return { slots, beat };
}
