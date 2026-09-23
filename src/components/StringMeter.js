import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from 'react';
import { TEMPL } from '../core/chords';
import { useFrame } from '../hooks/useEngine';
const LABEL = ['4', '3', '2', '1'];
/**
 * いま鳴っているコードの、弦ごとの鳴り具合。
 * 光らない弦はミュートしている。毎フレーム更新するので DOM を直接書き換える。
 */
export function StringMeter({ engine, chord }) {
    const bars = useRef([]);
    useFrame(engine, (f) => {
        const tmpl = chord ? TEMPL[chord] : null;
        for (let i = 0; i < 4; i++) {
            const el = bars.current[i];
            if (!el)
                continue;
            const g = !tmpl || f.quiet ? 0 : Math.min(1, f.live[tmpl.stringPcs[i]] / f.liveMax);
            el.style.opacity = (0.16 + 0.84 * g).toFixed(2);
        }
    });
    return (_jsx("div", { className: "strmeter", "aria-label": "\u5F26\u3054\u3068\u306E\u9CF4\u308A", children: LABEL.map((n, i) => (_jsxs("div", { children: [_jsx("i", { ref: (el) => {
                        bars.current[i] = el;
                    } }), _jsx("span", { children: n })] }, n))) }));
}
