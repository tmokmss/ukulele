import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CHORDS } from '../core/chords';
const N_FRET = 4;
/**
 * 押さえ方の図。光らせない静的な描画で、レーンのカードにも「つぎに押さえる形」にも使う。
 * 弦の鳴りの確認は StringMeter が持つ。
 */
export function FretMini({ chord, w, labels = false }) {
    const frets = CHORDS[chord] ?? [0, 0, 0, 0];
    const h = w * (labels ? 1.34 : 1.2);
    const pad = w * 0.13;
    const xs = [0, 1, 2, 3].map((i) => pad + (i * (w - 2 * pad)) / 3);
    const nut = h * (labels ? 0.3 : 0.28);
    const fh = (h - nut) / (N_FRET + 0.3);
    return (_jsxs("svg", { className: "fretmini", viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img", "aria-label": `${chord} の押さえ方: 4弦から ${frets.join(' ')}`, children: [labels &&
                'GCEA'.split('').map((n, i) => (_jsx("text", { x: xs[i], y: nut * 0.28, style: { fontSize: w * 0.11 }, children: n }, `l${i}`))), Array.from({ length: N_FRET }, (_, j) => (_jsx("line", { className: "m-fr", x1: xs[0], x2: xs[3], y1: nut + (j + 1) * fh, y2: nut + (j + 1) * fh }, j))), _jsx("line", { className: "m-nut", x1: xs[0] - 1, x2: xs[3] + 1, y1: nut, y2: nut }), xs.map((x, i) => (_jsx("line", { className: "m-str", x1: x, x2: x, y1: nut, y2: nut + N_FRET * fh }, `s${i}`))), frets.map((v, i) => v === 0 ? (_jsx("circle", { className: "m-open", cx: xs[i], cy: nut * 0.52, r: w * 0.065 }, `d${i}`)) : (_jsx("circle", { className: "m-dot", cx: xs[i], cy: nut + (v - 0.5) * fh, r: w * 0.1 }, `d${i}`)))] }));
}
