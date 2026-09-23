import { jsx as _jsx } from "react/jsx-runtime";
/** 択一のピル型スイッチ。押されている側を aria-pressed で示す */
export function Segmented({ options, value, onChange, disabled, label }) {
    return (_jsx("div", { className: "seg", role: "group", "aria-label": label, children: options.map((o) => (_jsx("button", { type: "button", "aria-pressed": o.value === value, disabled: disabled || o.disabled, onClick: () => onChange(o.value), children: o.label }, String(o.value)))) }));
}
