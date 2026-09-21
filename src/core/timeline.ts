/**
 * コードを「拍の上に置かれたスロット」として持つ。
 *
 * いまの練習モードは「進行 × 1コードあたり bpc 拍」だけを作るが、
 * 画面 (コードレーン) は長さがバラバラのスロットを前提に描く。
 * 曲や楽譜を流したくなったら buildTimeline の中身を差し替えれば、表示側は変わらない。
 */

export type Slot = { chord: string; beats: number };

export type Timeline = {
  slots: Slot[];
  /** slots[i] が1周目で始まる拍 */
  starts: number[];
  /** 1周ぶんの拍数 */
  cycleBeats: number;
};

/** タイムライン上の1コード。index は周回をまたいで増え続ける絶対番号 */
export type Placed = { index: number; chord: string; startBeat: number; beats: number };

export function makeTimeline(slots: Slot[]): Timeline {
  const starts: number[] = [];
  let acc = 0;
  for (const s of slots) {
    starts.push(acc);
    acc += s.beats;
  }
  return { slots, starts, cycleBeats: acc };
}

/** 練習モード: 進行のコードを bpc 拍ずつ並べる */
export function buildTimeline(prog: string[], bpc: number): Timeline {
  return makeTimeline(prog.map((chord) => ({ chord, beats: bpc })));
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

/** 絶対番号からコードと開始拍を引く。番号は負でも先でもよい */
export function placeSlot(tl: Timeline, index: number): Placed {
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

/** from..to (絶対番号) のスロットを並べて返す */
export function placeRange(tl: Timeline, from: number, to: number): Placed[] {
  const out: Placed[] = [];
  for (let i = from; i <= to; i++) out.push(placeSlot(tl, i));
  return out;
}
