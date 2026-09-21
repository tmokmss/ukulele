import type { HistoryEntry, Settings } from './types';
import { CHORDS } from './chords';

const SETTINGS_KEY = 'uke.settings';
const HISTORY_KEY = 'uke.history';
const HISTORY_MAX = 40;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // プライベートブラウジングなどで書けないことがある。保存できなくても練習自体は続けられる
  }
}

export const DEFAULT_SETTINGS: Settings = {
  bpm: 70,
  bpc: 4,
  sessionSec: 60,
  clickOn: true,
  calibMs: null,
  sens: 6,
  prog: ['C', 'Am', 'F', 'G7'],
  mode: 'drill',
  songId: '',
};

export function loadSettings(): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY, {}) };
  const prog = (Array.isArray(s.prog) ? s.prog : []).filter((c) => CHORDS[c]);
  s.prog = prog.length ? prog : [...DEFAULT_SETTINGS.prog];
  if (s.mode !== 'score') s.mode = 'drill';
  if (typeof s.songId !== 'string') s.songId = '';
  return s;
}

export const saveSettings = (s: Settings): void => write(SETTINGS_KEY, s);

export const loadHistory = (): HistoryEntry[] => read<HistoryEntry[]>(HISTORY_KEY, []);

export function pushHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [...loadHistory(), entry].slice(-HISTORY_MAX);
  write(HISTORY_KEY, next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  write(HISTORY_KEY, []);
  return [];
}
