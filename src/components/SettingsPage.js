import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Adjust } from './Adjust';
import { MicStatus } from './MicStatus';
import { Tuner } from './Tuner';
/** 練習の前後に触るもの。楽器を合わせる (チューニング) と、採点の効き方 (調整) */
export function SettingsPage({ engine, source, onRetryMic, settings, patch, canAutoCalib, onAutoCalib, onBack }) {
    return (_jsxs(_Fragment, { children: [_jsxs("header", { children: [_jsxs("div", { className: "head", children: [_jsx("h1", { children: "\u8A2D\u5B9A" }), _jsxs("button", { type: "button", className: "btn-quiet", onClick: onBack, children: [_jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("path", { d: "M15 5l-7 7 7 7" }) }), "\u7DF4\u7FD2\u306B\u3082\u3069\u308B"] })] }), _jsx("p", { className: "lede", children: "\u697D\u5668\u3092\u5408\u308F\u305B\u3066\u3001\u63A1\u70B9\u306E\u52B9\u304D\u65B9\u3092\u6574\u3048\u307E\u3059\u3002" })] }), _jsx(MicStatus, { source: source.source, message: source.message, warn: source.warn, disabled: false, onRetry: onRetryMic }), _jsx(Tuner, { engine: engine, connected: source.source === 'mic' }), _jsx(Adjust, { settings: settings, patch: patch, canAutoCalib: canAutoCalib, onAutoCalib: onAutoCalib })] }));
}
