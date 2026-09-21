/**
 * 楽譜 (コード譜) を JSON で受け取り、タイムラインのスロットに落とす。
 *
 * 書式は docs/score-format.md。要は「1小節 = 1つの文字列」で、
 * 小節の中にコードを並べると等分し、"." は前のコードを伸ばす。
 *
 *   { "title": "きらきら星", "bpm": 90, "beatsPerBar": 4, "repeat": 2,
 *     "bars": ["C", "F C", "."] }
 *
 * 人が手で書くものなので、読めなかった理由は「何小節目の何が悪いか」まで返す。
 */
import { CHORDS, LIB } from './chords';
import { makeTimeline, type Slot, type Timeline } from './timeline';

export type Score = {
  title: string;
  /** 楽譜が指定するテンポ。無ければ null で、いまの設定のまま */
  bpm: number | null;
  beatsPerBar: number;
  /** 通す回数 */
  repeat: number;
  /** 1周ぶんのコード */
  slots: Slot[];
  /** 1周ぶんの小節数 */
  bars: number;
  /** 出てきた順の、使われているコード */
  chords: string[];
};

export type ParseResult = { ok: true; score: Score } | { ok: false; error: string };

/** 前のコードを伸ばす記号 */
const HOLD = ['.', '-', '%'];
const MAX_BARS = 400;
const DEFAULT_TITLE = '名前のない楽譜';

const err = (error: string): ParseResult => ({ ok: false, error });

export function parseScore(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return err(`JSON として読めません。${e instanceof Error ? e.message : ''}`);
  }
  // 小節だけの配列も受ける。["C", "F"] と書けば、あとは既定値
  const obj: Record<string, unknown> = Array.isArray(raw)
    ? { bars: raw }
    : typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  if (!('bars' in obj)) return err('bars がありません。小節を並べた配列を入れてください。');

  const beatsPerBar = intField(obj.beatsPerBar, 4, 1, 16);
  if (beatsPerBar == null) return err('beatsPerBar は 1〜16 の整数にしてください。');
  const repeat = intField(obj.repeat, 1, 1, 16);
  if (repeat == null) return err('repeat は 1〜16 の整数にしてください。');
  let bpm: number | null = null;
  if (obj.bpm != null) {
    if (typeof obj.bpm !== 'number' || !Number.isFinite(obj.bpm) || obj.bpm < 30 || obj.bpm > 240)
      return err('bpm は 30〜240 の数字にしてください。');
    bpm = Math.round(obj.bpm);
  }
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : DEFAULT_TITLE;

  const bars = flattenBars(obj.bars);
  if (typeof bars === 'string') return err(bars);
  if (!bars.length) return err('小節がありません。');
  if (bars.length > MAX_BARS) return err(`小節が多すぎます (${bars.length})。${MAX_BARS} まで。`);

  const slots: Slot[] = [];
  const unknown = new Set<string>();
  for (let i = 0; i < bars.length; i++) {
    const tokens = bars[i].split(/\s+/).filter(Boolean);
    if (beatsPerBar % tokens.length !== 0)
      return err(`${i + 1}小節目「${bars[i]}」: ${beatsPerBar}拍を${tokens.length}つに等分できません。`);
    const beats = beatsPerBar / tokens.length;
    for (const t of tokens) {
      if (HOLD.includes(t)) {
        const prev = slots[slots.length - 1];
        if (!prev) return err(`${i + 1}小節目: 先頭に「${t}」は置けません。伸ばす元のコードがありません。`);
        prev.beats += beats;
      } else if (CHORDS[t]) {
        slots.push({ chord: t, beats });
      } else {
        unknown.add(t);
      }
    }
  }
  if (unknown.size) return err(`使えないコードがあります: ${[...unknown].join(' ')}\n使えるのは ${LIB.join(' ')} です。`);

  return {
    ok: true,
    score: {
      title,
      bpm,
      beatsPerBar,
      repeat,
      slots,
      bars: bars.length,
      chords: [...new Set(slots.map((s) => s.chord))],
    },
  };
}

/** 楽譜は「通す回数が決まっているタイムライン」 */
export function scoreTimeline(score: Score): Timeline {
  return makeTimeline(score.slots, { barBeats: score.beatsPerBar, cycles: score.repeat });
}

/** 小節は配列でも1本の文字列でもよく、どちらも「|」で区切れる */
function flattenBars(value: unknown): string[] | string {
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (typeof v !== 'string') return `bars の ${i + 1} 番目が文字列ではありません。"C" のように書いてください。`;
    for (const bar of v.split('|')) {
      const t = bar.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

function intField(value: unknown, fallback: number, lo: number, hi: number): number | null {
  if (value == null) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < lo || value > hi) return null;
  return value;
}

export const SAMPLE_SCORE = `{
  "title": "きらきら星",
  "bpm": 90,
  "beatsPerBar": 4,
  "repeat": 2,
  "bars": [
    "C", "F C", "C", "G7 C",
    "F C", "F C", "F C", "G7 C",
    "C", "F C", "C", "G7 C"
  ]
}`;
