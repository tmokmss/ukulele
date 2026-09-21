/**
 * 採点結果を日本語の文言にする。表示の都合だけを持ち、React には依存しない。
 */
import { median, timingClass } from './chroma';
import { weakLabel } from './chords';
import { totalBeats, type Timeline } from './timeline';
import type { RhythmTally, SegmentResult, SessionResult, TickInfo } from './types';

/**
 * 画面の上に出す「いまどこか」。
 * 終わりが決まっている楽譜は小節で、止めるまで繰り返す進行は残り時間で言う
 */
export function phaseText(tl: Timeline, tick: TickInfo | null): string {
  if (!tick) return '最初のコード';
  if (tick.beat < 0) return 'カウントイン';
  const total = totalBeats(tl);
  if (total != null) {
    const bar = Math.min(Math.floor(tick.beat / tl.barBeats) + 1, Math.ceil(total / tl.barBeats));
    return `${bar} / ${Math.ceil(total / tl.barBeats)} 小節`;
  }
  if (tick.leftSec != null) {
    return `残り ${Math.floor(tick.leftSec / 60)}:${String(Math.floor(tick.leftSec % 60)).padStart(2, '0')}`;
  }
  return `${tick.slot + 1} コード目`;
}

export type ResultText = {
  /** 「C: ジャスト (+12ms)」 */
  timing: string;
  tone: 'good' | 'warn' | 'miss';
  /** 「コードOK、全部の音が鳴っている」 */
  chord: string;
};

export function describeResult(r: SegmentResult, chordJudged: boolean): ResultText {
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
  if (!chordJudged) chord = '';
  else if (!r.heard) chord = '音が小さくてコードを判定できなかった';
  else if (!r.ok) chord = `${r.best} に聞こえた`;
  else if (r.weak.length) chord = `コードOK、ただし ${r.weak.map((pc) => weakLabel(r.chord, pc)).join('、')} が弱い`;
  else chord = 'コードOK、全部の音が鳴っている';

  return { timing: `${r.chord}: ${timing}`, tone, chord };
}

export type ChordBreakdown = { chord: string; notes: string; ok: number; n: number };

/** ストロークの採点。粒の揃いは、拾えた音の強さのばらつきで見る */
export type RhythmSummary = {
  expected: number;
  played: number;
  extra: number;
  /** 拾えた割合 (%) */
  playRate: number;
  meanAbs: number | null;
  /** 強さのばらつき (変動係数)。小さいほど粒が揃っている */
  spread: number | null;
  evenness: string;
};

export type SessionSummary = {
  total: number;
  okN: number;
  okRate: number;
  /** コードまで採点したか。false ならリズムだけの結果 */
  chordJudged: boolean;
  rhythm: RhythmSummary | null;
  /** 拍とのズレ (ms) の一覧。自動補正に使う */
  offsets: number[];
  /** ズレの絶対値の平均 */
  meanAbs: number | null;
  /** ズレの中央値。符号が偏っていれば機器の遅延を疑う */
  median: number | null;
  perChord: ChordBreakdown[];
};

export function summarize({ results, rhythm, chordJudged }: SessionResult): SessionSummary | null {
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
    if (!chordJudged) {
      if (p.silent) notes.push(`入りの音なし ${p.silent}回`);
      perChord.push({ chord, notes: notes.length ? notes.join('、') : '問題なし', ok: p.ok, n: p.n });
      continue;
    }
    for (const pc of Object.keys(p.weak)) notes.push(`${weakLabel(chord, +pc)} が弱い ${p.weak[+pc]}回`);
    for (const o of Object.keys(p.as)) notes.push(`${o} に聞こえた ${p.as[o]}回`);
    if (p.silent) notes.push(`入りの音なし ${p.silent}回`);
    perChord.push({ chord, notes: notes.length ? notes.join('、') : '問題なし', ok: p.ok, n: p.n });
  }

  return {
    total: results.length,
    okN,
    okRate: Math.round((okN / results.length) * 100),
    chordJudged,
    rhythm: summarizeRhythm(rhythm),
    offsets,
    meanAbs,
    median: med,
    perChord,
  };
}

function summarizeRhythm(t: RhythmTally | null): RhythmSummary | null {
  if (!t || !t.expected) return null;
  const meanAbs = t.offsets.length ? t.offsets.reduce((s, v) => s + Math.abs(v), 0) / t.offsets.length : null;
  let spread: number | null = null;
  if (t.levels.length >= 4) {
    const mean = t.levels.reduce((s, v) => s + v, 0) / t.levels.length;
    const varia = t.levels.reduce((s, v) => s + (v - mean) * (v - mean), 0) / t.levels.length;
    spread = mean > 0.02 ? Math.sqrt(varia) / mean : null;
  }
  return {
    expected: t.expected,
    played: t.played,
    extra: t.extra,
    playRate: Math.round((t.played / t.expected) * 100),
    meanAbs,
    spread,
    evenness: spread == null ? '…' : spread < 0.2 ? '揃っている' : spread < 0.4 ? 'ややばらつく' : 'ばらつく',
  };
}
