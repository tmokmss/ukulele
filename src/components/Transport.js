import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 練習の再生まわり。始める・止める・一時停止・位置を動かす。
 *
 * マウスやタップで押したときだけフォーカスを外す。押したボタンにフォーカスが残ると、
 * 続けて押したスペースがそのボタンに吸われて、一時停止のつもりが「止める」になるため。
 * キーボードで押したとき (detail が 0) は、そのまま残す。
 */
function press(fn) {
    return (e) => {
        if (e.detail > 0)
            e.currentTarget.blur();
        fn();
    };
}
export function Transport({ running, paused, onToggle, onPause, onSeek, onScrub, onScrubStart, onScrubEnd, slot, total, }) {
    const at = Math.max(0, slot);
    return (_jsxs("section", { className: "transport", "aria-label": "\u7DF4\u7FD2\u306E\u64CD\u4F5C", children: [_jsx("button", { type: "button", className: running ? 'btn-main stop' : 'btn-main', onClick: press(onToggle), children: running ? '止める' : '練習を始める' }), _jsxs("div", { className: "tp-row", children: [_jsx("button", { type: "button", className: "btn-sub", disabled: !running, onClick: press(() => onSeek(-1)), children: "\u25C0 1\u3064\u524D" }), _jsx("button", { type: "button", className: paused ? 'btn-sub wide on' : 'btn-sub wide', disabled: !running, onClick: press(onPause), children: paused ? '再開' : '一時停止' }), _jsx("button", { type: "button", className: "btn-sub", disabled: !running, onClick: press(() => onSeek(1)), children: "1\u3064\u5148 \u25B6" })] }), total != null && (_jsxs("div", { className: "tp-seek", children: [_jsx("input", { type: "range", "aria-label": "\u7DF4\u7FD2\u3059\u308B\u4F4D\u7F6E", min: 0, max: Math.max(0, total - 1), step: 1, value: Math.min(at, total - 1), disabled: !running, onPointerDown: onScrubStart, onPointerUp: onScrubEnd, onPointerCancel: onScrubEnd, onChange: (e) => onScrub(+e.target.value) }), _jsx("output", { children: running ? `${at + 1} / ${total}` : `全 ${total}` })] })), _jsx("p", { className: "note", children: "\u30B9\u30DA\u30FC\u30B9\u3067\u4E00\u6642\u505C\u6B62\u3068\u518D\u958B\u3001\u2190 \u2192 \u3067\u30B3\u30FC\u30C9\u30921\u3064\u52D5\u304B\u305B\u307E\u3059\u3002" })] }));
}
