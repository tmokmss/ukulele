/**
 * コードを「拍の上に置かれたスロット」として持つ。
 *
 * 練習モード (進行 × bpc 拍を延々と繰り返す) と楽譜モード (小節ごとに長さが変わり、
 * 終わりがあり、ストロークの位置も決まっている) の違いは、ここで吸収する。
 * 画面もエンジンも Timeline だけを見ればいい。
 */

export type Slot = { chord: string; beats: number };

/** 鳴らす向き。x はミュート (チャッ) */
export type Stroke = 'D' | 'U' | 'x';

/** 楽譜が「ここで鳴らす」と決めている位置。1周ぶんの拍で持つ */
export type Hit = { beat: number; dir: Stroke };

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
  /**
   * 鳴らす位置。ストローク指定のない楽譜と練習モードでは空になり、
   * そのときは「コードの切れ目だけを見る」従来の採点に落ちる
   */
  hits: Hit[];
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

/**
 * コード判定に必要な最短の長さ (秒)。
 * クロマ用の FFT は窓が約340msあるので、これより短いコードは前後が窓の中で混ざる。
 * 足りない曲ではコード判定を止めて、リズムだけを見る
 */
export const MIN_CHORD_SEC = 0.5;

type Options = { barBeats?: number; cycles?: number | null; hits?: Hit[] };

export function makeTimeline(slots: Slot[], opts: Options = {}): Timeline {
  const starts: number[] = [];
  let acc = 0;
  for (const s of slots) {
    starts.push(acc);
    acc += s.beats;
  }
  return {
    slots,
    starts,
    cycleBeats: acc,
    barBeats: opts.barBeats ?? 4,
    cycles: opts.cycles ?? null,
    hits: opts.hits ?? [],
  };
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

/** 全部で何回鳴らすか。ストローク指定が無ければ null */
export function hitCount(tl: Timeline): number | null {
  if (!tl.hits.length) return null;
  return tl.cycles == null ? null : tl.hits.length * tl.cycles;
}

/** そのテンポで、いちばん短いコードが何秒か */
export function shortestSlotSec(tl: Timeline, bpm: number): number {
  const beatDur = 60 / bpm;
  let min = Infinity;
  for (const s of tl.slots) min = Math.min(min, s.beats * beatDur);
  return min;
}

/** そのテンポでコード判定まで手が回るか。短いコードが混ざる曲はリズムだけ見る */
export function canJudgeChords(tl: Timeline, bpm: number): boolean {
  return shortestSlotSec(tl, bpm) >= MIN_CHORD_SEC;
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
 * そのコードで最初に鳴らすことになっている拍。
 * ストローク指定があると、コードが変わる拍が休符のことがある (食い込みの裏返し)。
 * そのときはコードの中の最初の打点で、チェンジのタイミングを測る
 */
export function firstHitBeat(tl: Timeline, p: Placed): number | null {
  if (!tl.hits.length) return p.startBeat;
  const cycle = Math.floor(p.startBeat / tl.cycleBeats);
  const local = p.startBeat - cycle * tl.cycleBeats;
  for (const h of tl.hits) {
    if (h.beat >= local && h.beat < local + p.beats) return cycle * tl.cycleBeats + h.beat;
  }
  return null;
}

/** その拍にいちばん近い打点 (周回をまたいで探す)。ストローク指定が無ければ null */
export function nearestHit(tl: Timeline, beat: number): { beat: number; dir: Stroke; gap: number } | null {
  const hits = tl.hits;
  if (!hits.length) return null;
  const cycle = Math.floor(beat / tl.cycleBeats);
  let best: { beat: number; dir: Stroke; i: number; c: number } | null = null;
  // 周をまたいだ直後は、前後の周の端が近いことがある
  for (const c of [cycle - 1, cycle, cycle + 1]) {
    for (let i = 0; i < hits.length; i++) {
      const b = c * tl.cycleBeats + hits[i].beat;
      if (!best || Math.abs(b - beat) < Math.abs(best.beat - beat)) best = { beat: b, dir: hits[i].dir, i, c };
    }
  }
  if (!best) return null;
  // 隣の打点までの距離。許容するズレの幅をここから決める
  const prev = best.i > 0 ? hits[best.i - 1].beat + best.c * tl.cycleBeats : hits[hits.length - 1].beat + (best.c - 1) * tl.cycleBeats;
  const next =
    best.i < hits.length - 1 ? hits[best.i + 1].beat + best.c * tl.cycleBeats : hits[0].beat + (best.c + 1) * tl.cycleBeats;
  const gap = Math.min(best.beat - prev, next - best.beat);
  return { beat: best.beat, dir: best.dir, gap };
}

/**
 * 拾ったストロークを、どの位置のぶんとみなすか。
 *  hit   … その位置のストローク (off は秒、+ が遅れ)
 *  extra … どこにも寄らなかった。楽譜が打点を決めているときだけ出る
 *  none  … 数えない (カウントイン中、曲の外、裏拍)
 */
export type Match =
  | { kind: 'hit'; at: number; off: number }
  | { kind: 'extra'; off: number }
  | { kind: 'none' };

export function matchStroke(tl: Timeline, beat: number, beatDur: number, endBeat: number | null): Match {
  // カウントイン中のストロークは数えない。いちばん広い許容 (250ms) の外まで下げる
  if (beat < -0.5) return { kind: 'none' };

  let at: number;
  let tol: number;
  if (tl.hits.length) {
    const h = nearestHit(tl, beat);
    if (!h) return { kind: 'none' };
    at = h.beat;
    // 隣の打点までの半分を、その打点のぶんとみなす
    tol = Math.min(0.5 * h.gap * beatDur, 0.25);
  } else {
    at = Math.round(beat);
    // 拍の ±30% (最大250ms) より外は裏拍とみなして無視する
    tol = Math.min(0.3 * beatDur, 0.25);
  }
  if (at < 0 || (endBeat != null && at >= endBeat)) return { kind: 'none' };

  const off = (beat - at) * beatDur;
  if (Math.abs(off) < tol) return { kind: 'hit', at, off };
  // 打点が決まっている曲では、どこにも寄らないストロークを「余分」として数える
  if (tl.hits.length && beat >= 0 && (endBeat == null || beat < endBeat)) return { kind: 'extra', off };
  return { kind: 'none' };
}

/** その拍までに鳴らすことになっていた回数。途中で止めたときの「期待した数」 */
export function hitsBefore(tl: Timeline, beat: number): number {
  if (!tl.hits.length || beat <= 0) return 0;
  const cycles = Math.floor(beat / tl.cycleBeats);
  const local = beat - cycles * tl.cycleBeats;
  let n = cycles * tl.hits.length;
  for (const h of tl.hits) if (h.beat < local) n++;
  return n;
}

/** from..to 拍のあいだの打点を、周回をまたいで並べる。レーンに描くために使う */
export function hitsInRange(tl: Timeline, from: number, to: number): Hit[] {
  if (!tl.hits.length) return [];
  const out: Hit[] = [];
  const total = totalBeats(tl);
  const last = total == null ? to : Math.min(to, total);
  for (let c = Math.floor(from / tl.cycleBeats); c * tl.cycleBeats <= last; c++) {
    if (c < 0) continue;
    if (tl.cycles != null && c >= tl.cycles) break;
    for (const h of tl.hits) {
      const b = c * tl.cycleBeats + h.beat;
      if (b >= from && b <= last) out.push({ beat: b, dir: h.dir });
    }
  }
  return out;
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
