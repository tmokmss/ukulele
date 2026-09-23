import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
const SPARK_POINTS = 14;
const LIST_ROWS = 8;
export function HistoryPanel({ history, onClear }) {
    if (!history.length) {
        return (_jsxs("section", { className: "block", "aria-label": "\u3053\u308C\u307E\u3067\u306E\u8A18\u9332", children: [_jsx("h2", { children: "\u3053\u308C\u307E\u3067\u306E\u8A18\u9332" }), _jsx("p", { className: "empty", children: "\u307E\u3060\u8A18\u9332\u304C\u3042\u308A\u307E\u305B\u3093\u30021\u56DE\u7DF4\u7FD2\u3059\u308B\u3068\u3053\u3053\u306B\u6B8B\u308A\u307E\u3059\u3002" })] }));
    }
    const pts = history.filter((x) => x.meanAbs != null).slice(-SPARK_POINTS);
    const xy = pts.length >= 2
        ? (() => {
            const mx = Math.max(60, ...pts.map((p) => p.meanAbs));
            return pts.map((p, i) => [6 + i * (288 / (pts.length - 1)), 48 - (p.meanAbs / mx) * 40]);
        })()
        : null;
    return (_jsxs("section", { className: "block", "aria-label": "\u3053\u308C\u307E\u3067\u306E\u8A18\u9332", children: [_jsx("h2", { children: "\u3053\u308C\u307E\u3067\u306E\u8A18\u9332" }), xy && (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "spark", viewBox: "0 0 300 54", preserveAspectRatio: "none", role: "img", "aria-label": "\u5E73\u5747\u30BA\u30EC\u306E\u63A8\u79FB", children: [_jsx("polyline", { points: xy.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') }), _jsx("circle", { cx: xy[xy.length - 1][0].toFixed(1), cy: xy[xy.length - 1][1].toFixed(1), r: 3.5 })] }), _jsx("p", { className: "note", style: { marginTop: 2 }, children: "\u5E73\u5747\u30BA\u30EC\u306E\u63A8\u79FB\u3002\u4E0B\u304C\u308B\u307B\u3069\u826F\u3044\u3002" })] })), _jsx("ul", { className: "list", children: history
                    .slice(-LIST_ROWS)
                    .reverse()
                    .map((x) => {
                    const d = new Date(x.ts);
                    return (_jsxs("li", { children: [_jsxs("span", { children: [_jsx("b", { children: x.title ?? x.prog.split(' ').join(' → ') }), " ", x.bpm, "BPM"] }), _jsxs("span", { children: [x.rhythmOnly ? 'リズム ' : '', x.okRate, "% / ", x.meanAbs == null ? '…' : `${x.meanAbs}ms`, "\u3000", d.getMonth() + 1, "/", d.getDate()] })] }, x.ts));
                }) }), _jsx("div", { className: "row", children: _jsx("button", { type: "button", className: "btn-sub", onClick: onClear, children: "\u8A18\u9332\u3092\u6D88\u3059" }) })] }));
}
