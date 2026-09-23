import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { NOTE, OPEN, STRING_NAME } from '../core/chords';
import { nearestString, noteName, TUNE_OK_CENTS } from '../core/pitch';
import { describeTuning } from '../core/report';
import { useFrame } from '../hooks/useEngine';
/** 針が振り切れるズレ (セント) */
const SPAN = 50;
/** 音が消えてから表示を残す時間 (ms)。弦が減衰するたび消えると読めない */
const HOLD_MS = 900;
/** これ以上跳んだら弦を持ち替えたとみなし、平滑化せず追いつく (半音) */
const JUMP = 0.7;
const WAITING = '弦を1本ずつ鳴らしてください。';
const NO_MIC = 'マイクにつながっていません。';
/**
 * 開放弦のチューナー。いちばん近い弦を指して、ズレをセントで出す。
 * 毎フレーム動くので、値はすべて ref 経由で DOM に直接書く。
 */
export function Tuner({ engine, connected }) {
    const chips = useRef([]);
    const note = useRef(null);
    const cents = useRef(null);
    const pin = useRef(null);
    const msg = useRef(null);
    /** 平滑化した音の高さ (MIDI)。鳴っていなければ null */
    const held = useRef(null);
    const heldAt = useRef(0);
    // 音程の検出はここを開いているあいだだけ回す
    useEffect(() => engine.enableTuner(), [engine]);
    // 文字はすべて paint が書く。マイクが無いあいだはフレームが来ないので、ここから一度書く
    useEffect(() => {
        paint(held.current);
    }, [connected]);
    useFrame(engine, (f) => {
        const now = performance.now();
        if (f.pitch) {
            const m = f.pitch.midi;
            const prev = held.current;
            held.current = prev == null || Math.abs(m - prev) > JUMP ? m : prev + 0.3 * (m - prev);
            heldAt.current = now;
        }
        else if (held.current != null && now - heldAt.current > HOLD_MS) {
            held.current = null;
        }
        paint(held.current);
    });
    const paint = (midi) => {
        const t = midi == null ? null : nearestString(midi);
        for (let i = 0; i < OPEN.length; i++) {
            const on = t?.index === i;
            setClass(chips.current[i], on ? (Math.abs(t.cents) <= TUNE_OK_CENTS ? 'on ok' : 'on') : '');
        }
        setText(note.current, midi == null ? '—' : noteName(midi));
        setText(cents.current, t == null ? '' : `${t.cents > 0 ? '+' : ''}${Math.round(t.cents)} セント`);
        const d = describeTuning(t?.cents ?? 0);
        setText(msg.current, !connected ? NO_MIC : midi == null ? WAITING : t == null ? 'どの弦からも離れています。' : d.text);
        setClass(msg.current, `tmsg ${t == null || midi == null ? '' : d.tone}`);
        if (pin.current) {
            const x = t == null ? 0 : Math.max(-SPAN, Math.min(SPAN, t.cents));
            pin.current.style.left = `${50 + (x / SPAN) * 50}%`;
            pin.current.style.opacity = t == null ? '0' : '1';
            setClass(pin.current, `pin ${d.tone}`);
        }
    };
    return (_jsxs("section", { className: "block", "aria-label": "\u30A6\u30AF\u30EC\u30EC\u306E\u30C1\u30E5\u30FC\u30CB\u30F3\u30B0", children: [_jsx("h2", { children: "\u30A6\u30AF\u30EC\u30EC\u306E\u30C1\u30E5\u30FC\u30CB\u30F3\u30B0" }), _jsx("p", { className: "sub", style: { marginTop: 0 }, children: "4\u5F26\u304B\u3089\u9806\u306B1\u672C\u305A\u3064\u9CF4\u3089\u3057\u3066\u3001\u91DD\u3092\u307E\u3093\u4E2D\u306B\u5408\u308F\u305B\u307E\u3059\u3002" }), _jsx("div", { className: "tstr", children: STRING_NAME.map((name, i) => (_jsxs("div", { ref: (el) => {
                        chips.current[i] = el;
                    }, children: [name, _jsx("b", { children: NOTE[OPEN[i] % 12] })] }, name))) }), _jsxs("p", { className: "treading", children: [_jsx("b", { ref: note }), _jsx("span", { ref: cents })] }), _jsxs("div", { className: "tneedle", children: [_jsx("span", { className: "zone" }), _jsx("span", { className: "mid" }), _jsx("i", { className: "pin", ref: pin, style: { opacity: 0, left: '50%' } }), _jsx("span", { className: "end lo", children: "\u4F4E\u3044" }), _jsx("span", { className: "end hi", children: "\u9AD8\u3044" })] }), _jsx("p", { className: "tmsg", ref: msg })] }));
}
function setText(el, s) {
    if (el && el.textContent !== s)
        el.textContent = s;
}
function setClass(el, s) {
    const v = s.trim();
    if (el && el.className !== v)
        el.className = v;
}
