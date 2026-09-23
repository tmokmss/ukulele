import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LIB, PRESETS } from '../core/chords';
const MAX_LEN = 8;
export function Progression({ prog, onChange, disabled }) {
    const key = prog.join(',');
    const presetIdx = PRESETS.findIndex((p) => p.join(',') === key);
    return (_jsxs("section", { className: "block", "aria-label": "\u30B3\u30FC\u30C9\u9032\u884C", children: [_jsx("h2", { children: "\u30B3\u30FC\u30C9\u9032\u884C" }), _jsxs("select", { "aria-label": "\u3088\u304F\u4F7F\u3046\u9032\u884C\u304B\u3089\u9078\u3076", value: presetIdx >= 0 ? String(presetIdx) : 'custom', disabled: disabled, onChange: (e) => {
                    if (e.target.value !== 'custom')
                        onChange([...PRESETS[+e.target.value]]);
                }, children: [PRESETS.map((p, i) => (_jsx("option", { value: String(i), children: p.join(' → ') }, i))), _jsx("option", { value: "custom", children: "\u81EA\u5206\u3067\u7D44\u3093\u3060\u9032\u884C" })] }), _jsx("div", { className: "chips", children: prog.map((c, i) => (_jsxs("span", { style: { display: 'contents' }, children: [i > 0 && _jsx("span", { className: "sep", children: "\u2192" }), _jsxs("button", { type: "button", className: "chip in", "aria-label": `${c} を進行から外す`, disabled: disabled, onClick: () => {
                                if (prog.length > 1)
                                    onChange(prog.filter((_, j) => j !== i));
                            }, children: [c, _jsx("span", { "aria-hidden": "true", children: "\u00D7" })] })] }, `${c}-${i}`))) }), _jsx("p", { className: "sub", children: "\u30BF\u30C3\u30D7\u3057\u3066\u9032\u884C\u306B\u8DB3\u3059" }), _jsx("div", { className: "chips", children: LIB.map((c) => (_jsx("button", { type: "button", className: "chip", disabled: disabled, onClick: () => {
                        if (prog.length < MAX_LEN)
                            onChange([...prog, c]);
                    }, children: c }, c))) })] }));
}
