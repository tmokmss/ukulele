/**
 * 採点結果を日本語の文言にする。表示の都合だけを持ち、React には依存しない。
 */
import { median, timingClass } from './chroma';
import { weakLabel } from './chords';
import type { SegmentResult } from './types';

export type ResultText = {
  /** 「C: ジャスト (+12ms)」 */
  timing: string;
  tone: 'good' | 'warn' | 'miss';
  /** 「コードOK、全部の音が鳴っている」 */
  chord: string;
};

export function describeResult(r: SegmentResult): ResultText {
  let timing: string;
  let tone: ResultText['tone'];
  if (r.off == null) {
    timing = 'チェンジの音が聞こえなかった';
    tone = 'miss';
  } else {
    const ms = Math.round(r.off * 1000);
    tone = timingClass(ms);
    const word = tone === 'good' ? 'ジャスト' : ms > 0 ? '遅め' : '早め';
    timing = `${word} (${ms > 0 ? '+' : ''}${ms}ms)`;
  }

  let chord: string;
  if (!r.heard) chord = '音が小さくてコードを判定できなかった';
  else if (!r.ok) chord = `${r.best} に聞こえた`;
  else if (r.weak.length) chord = `コードOK、ただし ${r.weak.map((pc) => weakLabel(r.chord, pc)).join('、')} が弱い`;
  else chord = 'コードOK、全部の音が鳴っている';

  return { timing: `${r.chord}: ${timing}`, tone, chord };
}

/**
 * レーンのカードに直接のせる、ひと目ぶんの採点。
 * 詳しい内容 (何に聞こえたか、どの弦が弱いか) は describeResult の文章が持つ。
 */
export type CardVerdict = {
  tone: ResultText['tone'];
  /** コードが合っていたか。判定できなかったときは '?' */
  mark: '✓' | '✗' | '?' | '';
  /** 「ジャスト」「早め」「遅め」、音が拾えなければ「聞こえず」 */
  label: string;
};

export function cardVerdict(r: SegmentResult): CardVerdict {
  if (r.off == null) return { tone: 'miss', mark: '', label: '聞こえず' };
  const ms = Math.round(r.off * 1000);
  const tone = timingClass(ms);
  return {
    tone,
    mark: !r.heard ? '?' : r.ok ? '✓' : '✗',
    label: tone === 'good' ? 'ジャスト' : ms > 0 ? '遅め' : '早め',
  };
}

export type ChordBreakdown = { chord: string; notes: string; ok: number; n: number };

export type SessionSummary = {
  total: number;
  okN: number;
  okRate: number;
  /** 拍とのズレ (ms) の一覧。自動補正に使う */
  offsets: number[];
  /** ズレの絶対値の平均 */
  meanAbs: number | null;
  /** ズレの中央値。符号が偏っていれば機器の遅延を疑う */
  median: number | null;
  perChord: ChordBreakdown[];
};

export function summarize(results: SegmentResult[]): SessionSummary | null {
  if (!results.length) return null;
  const offsets = results.filter((r) => r.off != null).map((r) => r.off! * 1000);
  const okN = results.filter((r) => r.heard && r.ok).length;
  const meanAbs = offsets.length ? offsets.reduce((s, v) => s + Math.abs(v), 0) / offsets.length : null;
  const med = offsets.length ? median(offsets) : null;

  type Acc = { n: number; ok: number; silent: number; weak: Record<number, number>; as: Record<string, number> };
  const per = new Map<string, Acc>();
  for (const r of results) {
    let p = per.get(r.chord);
    if (!p) per.set(r.chord, (p = { n: 0, ok: 0, silent: 0, weak: {}, as: {} }));
    p.n++;
    if (r.heard && r.ok) p.ok++;
    if (r.off == null) p.silent++;
    for (const pc of r.weak) p.weak[pc] = (p.weak[pc] ?? 0) + 1;
    if (r.heard && !r.ok && r.best) p.as[r.best] = (p.as[r.best] ?? 0) + 1;
  }

  const perChord: ChordBreakdown[] = [];
  for (const [chord, p] of per) {
    const notes: string[] = [];
    for (const pc of Object.keys(p.weak)) notes.push(`${weakLabel(chord, +pc)} が弱い ${p.weak[+pc]}回`);
    for (const o of Object.keys(p.as)) notes.push(`${o} に聞こえた ${p.as[o]}回`);
    if (p.silent) notes.push(`入りの音なし ${p.silent}回`);
    perChord.push({ chord, notes: notes.length ? notes.join('、') : '問題なし', ok: p.ok, n: p.n });
  }

  return {
    total: results.length,
    okN,
    okRate: Math.round((okN / results.length) * 100),
    offsets,
    meanAbs,
    median: med,
    perChord,
  };
}
