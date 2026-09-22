/**
 * 弾いた範囲を、重なりのない区間の集まりとして持つ。
 *
 * 一時停止とシークが入ると「1回の練習 = 0拍目から止めた拍まで」ではなくなる。
 * 飛ばしたところを「鳴らせなかった」と数えず、弾き直したところを二重に数えないために、
 * 通った区間だけを足していく。単位は拍で、[from, to) の半開区間。
 */
export type Span = [number, number];

/** 区間を足す。重なっているものは1つにまとめる */
export function addSpan(spans: Span[], from: number, to: number): Span[] {
  if (!(to > from)) return spans;
  const all: Span[] = [...spans, [from, to]];
  all.sort((x, y) => x[0] - y[0]);
  const out: Span[] = [];
  for (const [a, b] of all) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** その位置から先を切り落とす。採点をやり直すときは、通った記録も同じところまで戻す */
export function cutSpans(spans: Span[], at: number): Span[] {
  const out: Span[] = [];
  for (const [a, b] of spans) {
    if (a >= at) continue;
    out.push([a, Math.min(b, at)]);
  }
  return out;
}

/** その位置が、通った区間の中にあるか */
export function inSpans(spans: Span[], at: number): boolean {
  return spans.some(([a, b]) => at >= a && at < b);
}
