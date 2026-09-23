/** 区間を足す。重なっているものは1つにまとめる */
export function addSpan(spans, from, to) {
    if (!(to > from))
        return spans;
    const all = [...spans, [from, to]];
    all.sort((x, y) => x[0] - y[0]);
    const out = [];
    for (const [a, b] of all) {
        const last = out[out.length - 1];
        if (last && a <= last[1])
            last[1] = Math.max(last[1], b);
        else
            out.push([a, b]);
    }
    return out;
}
/** その位置から先を切り落とす。採点をやり直すときは、通った記録も同じところまで戻す */
export function cutSpans(spans, at) {
    const out = [];
    for (const [a, b] of spans) {
        if (a >= at)
            continue;
        out.push([a, Math.min(b, at)]);
    }
    return out;
}
/** その位置が、通った区間の中にあるか */
export function inSpans(spans, at) {
    return spans.some(([a, b]) => at >= a && at < b);
}
