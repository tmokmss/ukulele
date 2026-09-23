/**
 * コードを「拍の上に置かれたスロット」として持つ。
 *
 * 練習モード (進行 × bpc 拍を延々と繰り返す) と楽譜モード (小節ごとに長さが変わり、
 * 終わりがあり、ストロークの位置も決まっている) の違いは、ここで吸収する。
 * 画面もエンジンも Timeline だけを見ればいい。
 */
/**
 * コード判定に必要な最短の長さ (秒)。
 * クロマ用の FFT は窓が約340msあるので、これより短いコードは前後が窓の中で混ざる。
 * 足りない曲ではコード判定を止めて、リズムだけを見る
 */
export const MIN_CHORD_SEC = 0.5;
export function makeTimeline(slots, opts = {}) {
    const starts = [];
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
export function buildTimeline(prog, bpc) {
    return makeTimeline(prog.map((chord) => ({ chord, beats: bpc })), { barBeats: bpc });
}
/** 全部で何コードあるか。繰り返すタイムラインは null */
export function slotCount(tl) {
    return tl.cycles == null ? null : tl.slots.length * tl.cycles;
}
/** 全部で何拍あるか。繰り返すタイムラインは null */
export function totalBeats(tl) {
    return tl.cycles == null ? null : tl.cycleBeats * tl.cycles;
}
/** 全部で何回鳴らすか。ストローク指定が無ければ null */
export function hitCount(tl) {
    if (!tl.hits.length)
        return null;
    return tl.cycles == null ? null : tl.hits.length * tl.cycles;
}
/** そのテンポで、いちばん短いコードが何秒か */
export function shortestSlotSec(tl, bpm) {
    const beatDur = 60 / bpm;
    let min = Infinity;
    for (const s of tl.slots)
        min = Math.min(min, s.beats * beatDur);
    return min;
}
/** そのテンポでコード判定まで手が回るか。短いコードが混ざる曲はリズムだけ見る */
export function canJudgeChords(tl, bpm) {
    return shortestSlotSec(tl, bpm) >= MIN_CHORD_SEC;
}
/** その拍を含むスロットの絶対番号。カウントイン中 (負の拍) は -1 */
export function slotIndexAt(tl, beat) {
    if (beat < 0)
        return -1;
    const cycle = Math.floor(beat / tl.cycleBeats);
    const local = beat - cycle * tl.cycleBeats;
    let i = tl.starts.length - 1;
    while (i > 0 && tl.starts[i] > local)
        i--;
    return cycle * tl.slots.length + i;
}
/**
 * 絶対番号からコードと開始拍を引く。
 * 繰り返すタイムラインは番号が負でも先でもよい。終わりがあるものは、外に出ると null
 */
export function placeSlot(tl, index) {
    const total = slotCount(tl);
    if (total != null && (index < 0 || index >= total))
        return null;
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
export function placeRange(tl, from, to) {
    const out = [];
    for (let i = from; i <= to; i++) {
        const p = placeSlot(tl, i);
        if (p)
            out.push(p);
    }
    return out;
}
/** その拍でコードが変わるか。ストロークを「チェンジ」として数えるかの判定に使う */
export function isSlotStart(tl, beat) {
    if (beat < 0)
        return false;
    const local = beat - Math.floor(beat / tl.cycleBeats) * tl.cycleBeats;
    return tl.starts.includes(local);
}
/**
 * そのコードで最初に鳴らすことになっている拍。
 * ストローク指定があると、コードが変わる拍が休符のことがある (食い込みの裏返し)。
 * そのときはコードの中の最初の打点で、チェンジのタイミングを測る
 */
export function firstHitBeat(tl, p) {
    if (!tl.hits.length)
        return p.startBeat;
    const cycle = Math.floor(p.startBeat / tl.cycleBeats);
    const local = p.startBeat - cycle * tl.cycleBeats;
    for (const h of tl.hits) {
        if (h.beat >= local && h.beat < local + p.beats)
            return cycle * tl.cycleBeats + h.beat;
    }
    return null;
}
/** その拍にいちばん近い打点 (周回をまたいで探す)。ストローク指定が無ければ null */
export function nearestHit(tl, beat) {
    const hits = tl.hits;
    if (!hits.length)
        return null;
    const cycle = Math.floor(beat / tl.cycleBeats);
    let best = null;
    // 周をまたいだ直後は、前後の周の端が近いことがある
    for (const c of [cycle - 1, cycle, cycle + 1]) {
        for (let i = 0; i < hits.length; i++) {
            const b = c * tl.cycleBeats + hits[i].beat;
            if (!best || Math.abs(b - beat) < Math.abs(best.beat - beat))
                best = { beat: b, dir: hits[i].dir, i, c };
        }
    }
    if (!best)
        return null;
    // 隣の打点までの距離。許容するズレの幅をここから決める
    const prev = best.i > 0 ? hits[best.i - 1].beat + best.c * tl.cycleBeats : hits[hits.length - 1].beat + (best.c - 1) * tl.cycleBeats;
    const next = best.i < hits.length - 1 ? hits[best.i + 1].beat + best.c * tl.cycleBeats : hits[0].beat + (best.c + 1) * tl.cycleBeats;
    const gap = Math.min(best.beat - prev, next - best.beat);
    return { beat: best.beat, dir: best.dir, gap };
}
export function matchStroke(tl, beat, beatDur, endBeat) {
    // カウントイン中のストロークは数えない。いちばん広い許容 (250ms) の外まで下げる
    if (beat < -0.5)
        return { kind: 'none' };
    let at;
    let tol;
    if (tl.hits.length) {
        const h = nearestHit(tl, beat);
        if (!h)
            return { kind: 'none' };
        at = h.beat;
        // 隣の打点までの半分を、その打点のぶんとみなす
        tol = Math.min(0.5 * h.gap * beatDur, 0.25);
    }
    else {
        at = Math.round(beat);
        // 拍の ±30% (最大250ms) より外は裏拍とみなして無視する
        tol = Math.min(0.3 * beatDur, 0.25);
    }
    if (at < 0 || (endBeat != null && at >= endBeat))
        return { kind: 'none' };
    const off = (beat - at) * beatDur;
    if (Math.abs(off) < tol)
        return { kind: 'hit', at, off };
    // 打点が決まっている曲では、どこにも寄らないストロークを「余分」として数える
    if (tl.hits.length && beat >= 0 && (endBeat == null || beat < endBeat))
        return { kind: 'extra', off };
    return { kind: 'none' };
}
/** その拍までに鳴らすことになっていた回数。途中で止めたときの「期待した数」 */
export function hitsBefore(tl, beat) {
    if (!tl.hits.length || beat <= 0)
        return 0;
    const cycles = Math.floor(beat / tl.cycleBeats);
    const local = beat - cycles * tl.cycleBeats;
    let n = cycles * tl.hits.length;
    for (const h of tl.hits)
        if (h.beat < local)
            n++;
    return n;
}
/** from..to 拍のあいだの打点を、周回をまたいで並べる。レーンに描くために使う */
export function hitsInRange(tl, from, to) {
    if (!tl.hits.length)
        return [];
    const out = [];
    const total = totalBeats(tl);
    const last = total == null ? to : Math.min(to, total);
    for (let c = Math.floor(from / tl.cycleBeats); c * tl.cycleBeats <= last; c++) {
        if (c < 0)
            continue;
        if (tl.cycles != null && c >= tl.cycles)
            break;
        for (const h of tl.hits) {
            const b = c * tl.cycleBeats + h.beat;
            if (b >= from && b <= last)
                out.push({ beat: b, dir: h.dir });
        }
    }
    return out;
}
/**
 * 練習をどこで終えるか。
 * 楽譜は回数で決まっている。進行は練習時間から、いちばん近いコードの切れ目に寄せる
 */
export function planEnd(tl, bpm, sessionSec) {
    const total = slotCount(tl);
    if (total != null)
        return { slots: total, beat: totalBeats(tl) };
    if (!sessionSec)
        return null;
    const target = (sessionSec * bpm) / 60;
    let slots = 0;
    let beat = 0;
    while (beat < target) {
        beat += tl.slots[slots % tl.slots.length].beats;
        slots++;
    }
    const prev = beat - tl.slots[(slots - 1) % tl.slots.length].beats;
    if (slots > 1 && target - prev < beat - target)
        return { slots: slots - 1, beat: prev };
    return { slots, beat };
}
