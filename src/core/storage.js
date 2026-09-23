import { CHORDS } from './chords';
const SETTINGS_KEY = 'uke.settings';
const HISTORY_KEY = 'uke.history';
const HISTORY_MAX = 40;
function read(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
    }
    catch {
        return fallback;
    }
}
function write(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
        // プライベートブラウジングなどで書けないことがある。保存できなくても練習自体は続けられる
    }
}
export const DEFAULT_SETTINGS = {
    bpm: 70,
    bpc: 4,
    sessionSec: 60,
    clickOn: true,
    // 既定は切っておく。スピーカーのまま鳴らすと、お手本をマイクが拾って採点が壊れる
    demoOn: false,
    calibMs: null,
    sens: 6,
    prog: ['C', 'Am', 'F', 'G7'],
    mode: 'drill',
    songId: '',
};
export function loadSettings() {
    const s = { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
    const prog = (Array.isArray(s.prog) ? s.prog : []).filter((c) => CHORDS[c]);
    s.prog = prog.length ? prog : [...DEFAULT_SETTINGS.prog];
    if (s.mode !== 'score')
        s.mode = 'drill';
    if (typeof s.songId !== 'string')
        s.songId = '';
    return s;
}
export const saveSettings = (s) => write(SETTINGS_KEY, s);
export const loadHistory = () => read(HISTORY_KEY, []);
export function pushHistory(entry) {
    const next = [...loadHistory(), entry].slice(-HISTORY_MAX);
    write(HISTORY_KEY, next);
    return next;
}
export function clearHistory() {
    write(HISTORY_KEY, []);
    return [];
}
