import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Segmented } from './Segmented';
export function Controls({ settings, patch, running, mode, scoreReady }) {
    const score = mode === 'score';
    return (_jsxs("section", { className: "controls", "aria-label": "\u7DF4\u7FD2\u306E\u8A2D\u5B9A", children: [_jsxs("div", { className: "row first", children: [_jsx("span", { className: "lbl", children: "\u7DF4\u7FD2\u3059\u308B\u3082\u306E" }), _jsx(Segmented, { label: "\u7DF4\u7FD2\u3059\u308B\u3082\u306E", options: [
                            { value: 'drill', label: 'コード進行' },
                            { value: 'score', label: '楽譜', disabled: !scoreReady },
                        ], value: mode, disabled: running, onChange: (v) => patch({ mode: v }) })] }), _jsxs("div", { className: "row", children: [_jsx("label", { htmlFor: "bpm", children: "\u30C6\u30F3\u30DD" }), _jsx("input", { type: "range", id: "bpm", min: 40, max: 180, step: 2, value: settings.bpm, disabled: running, onChange: (e) => patch({ bpm: +e.target.value }) }), _jsxs("output", { htmlFor: "bpm", children: [settings.bpm, " BPM"] })] }), !score && (_jsxs("div", { className: "row", children: [_jsx("span", { className: "lbl", children: "1\u30B3\u30FC\u30C9\u306E\u9577\u3055" }), _jsx(Segmented, { label: "1\u30B3\u30FC\u30C9\u306E\u9577\u3055", options: [
                            { value: 2, label: '2拍' },
                            { value: 4, label: '4拍' },
                            { value: 8, label: '8拍' },
                        ], value: settings.bpc, disabled: running, onChange: (v) => patch({ bpc: v }) })] })), !score && (_jsxs("div", { className: "row", children: [_jsx("span", { className: "lbl", children: "\u7DF4\u7FD2\u6642\u9593" }), _jsx(Segmented, { label: "\u7DF4\u7FD2\u6642\u9593", options: [
                            { value: 60, label: '1分' },
                            { value: 120, label: '2分' },
                            { value: 0, label: '止めるまで' },
                        ], value: settings.sessionSec, disabled: running, onChange: (v) => patch({ sessionSec: v }) })] })), _jsxs("div", { className: "row", children: [_jsx("span", { className: "lbl", children: "\u30AF\u30EA\u30C3\u30AF\u97F3" }), _jsx(Segmented, { label: "\u30AF\u30EA\u30C3\u30AF\u97F3", options: [
                            { value: true, label: 'あり' },
                            { value: false, label: 'なし' },
                        ], value: settings.clickOn, onChange: (v) => patch({ clickOn: v }) })] }), _jsxs("div", { className: "row", children: [_jsx("span", { className: "lbl", children: "\u304A\u624B\u672C" }), _jsx(Segmented, { label: "\u304A\u624B\u672C", options: [
                            { value: true, label: 'あり' },
                            { value: false, label: 'なし' },
                        ], value: settings.demoOn, onChange: (v) => patch({ demoOn: v }) })] }), score && _jsx("p", { className: "note", children: "\u30B3\u30FC\u30C9\u306E\u9577\u3055\u3068\u7DF4\u7FD2\u306E\u9577\u3055\u306F\u3001\u697D\u8B5C\u304C\u6C7A\u3081\u307E\u3059\u3002\u30C6\u30F3\u30DD\u3060\u3051\u5909\u3048\u3089\u308C\u307E\u3059\u3002" }), settings.demoOn && (_jsx("p", { className: "note warn", children: "\u304A\u624B\u672C\u306F\u5FC5\u305A\u30A4\u30E4\u30DB\u30F3\u3067\u805E\u3044\u3066\u304F\u3060\u3055\u3044\u3002\u30B9\u30D4\u30FC\u30AB\u30FC\u306E\u307E\u307E\u3060\u3068\u3001\u304A\u624B\u672C\u3092\u30DE\u30A4\u30AF\u304C\u62FE\u3063\u3066\u3001\u5F3E\u304B\u306A\u304F\u3066\u3082\u9AD8\u3044\u70B9\u304C\u51FA\u307E\u3059\u3002" })), _jsx("p", { className: "note", children: "\u30AF\u30EA\u30C3\u30AF\u97F3\u306F\u30A4\u30E4\u30DB\u30F3\u3067\u805E\u304F\u3068\u3001\u30DE\u30A4\u30AF\u3078\u306E\u56DE\u308A\u8FBC\u307F\u304C\u6E1B\u3063\u3066\u63A1\u70B9\u304C\u5B89\u5B9A\u3057\u307E\u3059\u3002" })] }));
}
