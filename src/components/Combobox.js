import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
/** 大文字小文字・空白・ハイフン・中黒の違いでは外さない。"kirakira" で "kirakira-boshi" に当てる */
const fold = (s) => s.toLowerCase().replace(/[\s\-_・.'’]/g, '');
export function Combobox({ items, value, onChange, placeholder = '選ぶ', searchPlaceholder = '絞り込む', empty = '見つかりません', disabled, label, }) {
    const [open, setOpen] = useState(false);
    const current = items.find((i) => i.value === value);
    return (_jsxs(Popover.Root, { open: open, onOpenChange: setOpen, children: [_jsx(Popover.Trigger, { asChild: true, children: _jsxs("button", { type: "button", className: "combo-trigger", role: "combobox", "aria-expanded": open, "aria-label": label, disabled: disabled, children: [_jsx("span", { className: current ? 'v' : 'v ph', children: current?.label ?? placeholder }), _jsx("span", { className: "caret", "aria-hidden": "true", children: "\u25BE" })] }) }), _jsx(Popover.Portal, { children: _jsx(Popover.Content, { className: "combo-pop", align: "start", sideOffset: 6, children: _jsxs(Command
                    // 絞り込みは曲名・説明・keywords のどれかに当たればいい
                    , { 
                        // 絞り込みは曲名・説明・keywords のどれかに当たればいい
                        filter: (v, search, keywords) => [v, ...(keywords ?? [])].some((t) => fold(t).includes(fold(search))) ? 1 : 0, children: [_jsx(Command.Input, { className: "combo-input", placeholder: searchPlaceholder }), _jsxs(Command.List, { className: "combo-list", children: [_jsx(Command.Empty, { className: "combo-empty", children: empty }), items.map((i) => (_jsxs(Command.Item, { value: `${i.label} ${i.hint ?? ''}`, keywords: i.keywords, className: "combo-item", onSelect: () => {
                                            onChange(i.value);
                                            setOpen(false);
                                        }, children: [_jsxs("span", { className: "t", children: [i.label, i.value === value && _jsx("b", { "aria-hidden": "true", children: " \u2713" })] }), i.hint && _jsx("span", { className: "m", children: i.hint })] }, i.value)))] })] }) }) })] }));
}
