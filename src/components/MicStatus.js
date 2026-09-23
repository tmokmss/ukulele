import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * マイクの調子が悪いときだけ出る。
 * つながって動いているあいだは何も言わない (鳴っているかはレーンの点とチューナーが見せている)。
 */
export function MicStatus({ source, message, warn, disabled, onRetry }) {
    const connected = source === 'mic';
    if (connected && !message)
        return null;
    return (_jsxs("section", { className: "source", "aria-label": "\u30DE\u30A4\u30AF", children: [!connected && (_jsx("div", { className: "source-row", children: _jsx("button", { type: "button", className: "btn-sub", disabled: disabled, onClick: onRetry, children: "\u30DE\u30A4\u30AF\u3092\u4F7F\u3046" }) })), message && _jsx("p", { className: warn ? 'note warn' : 'note', children: message })] }));
}
