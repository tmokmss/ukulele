import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { timingClass } from '../core/chroma';
import { ChordLane } from './ChordLane';
import { FretMini } from './FretMini';
import { StringMeter } from './StringMeter';
export const LANE_DOT_MAX = 12;
export function Stage({ engine, tl, anchor, verdicts, chord, next, phase, dots, feedback, chordJudge }) {
    return (_jsxs("section", { className: "stage", "aria-label": "\u3044\u307E\u306E\u30B3\u30FC\u30C9", children: [_jsx("p", { className: "phase", children: phase }), _jsx(ChordLane, { engine: engine, tl: tl, anchor: anchor, verdicts: verdicts }), _jsxs("div", { className: "under", children: [_jsxs("div", { children: [_jsxs("p", { className: "nowline", children: ["\u3044\u307E\u9CF4\u3063\u3066\u3044\u308B", _jsx("b", { children: chord ?? '—' })] }), chordJudge ? (_jsx(StringMeter, { engine: engine, chord: chord })) : (_jsx("p", { className: "note", style: { marginTop: 6 }, children: "\u30B3\u30FC\u30C9\u304C\u77ED\u3044\u306E\u3067\u3001\u3053\u306E\u66F2\u306F\u30EA\u30BA\u30E0\u3060\u3051\u63A1\u70B9\u3057\u307E\u3059\u3002" }))] }), _jsxs("div", { className: "nextshape", children: [_jsx("p", { className: "lbl", children: next ? 'つぎに押さえる形' : 'おしまい' }), next && _jsx(FretMini, { chord: next, w: 84, labels: true })] })] }), _jsxs("div", { className: "lane", "aria-hidden": "true", children: [_jsx("span", { children: "\u65E9\u3044" }), _jsxs("div", { className: "lane-track", children: [_jsx("i", { className: "lane-zone" }), _jsx("i", { className: "lane-mid" }), dots.map((d, i) => {
                                const age = dots.length - 1 - i;
                                return (_jsx("i", { className: `lane-dot ${timingClass(d.ms)}${d.big ? ' big' : ''}`, style: {
                                        left: `${50 + Math.max(-1, Math.min(1, d.ms / 150)) * 48}%`,
                                        opacity: 1 - age * 0.075,
                                    } }, d.id));
                            })] }), _jsx("span", { children: "\u9045\u3044" })] }), _jsx("div", { className: "feedback", "aria-live": "polite", children: feedback ? (_jsxs(_Fragment, { children: [_jsx("p", { className: feedback.tone ? `t ${feedback.tone}-t` : 't', children: feedback.timing }), feedback.chord && _jsx("p", { children: feedback.chord })] })) : (_jsx("p", { className: "t", children: "\u6E96\u5099\u304C\u3067\u304D\u305F\u3089\u3001\u7DF4\u7FD2\u3092\u59CB\u3081\u3066\u304F\u3060\u3055\u3044\u3002" })) })] }));
}
