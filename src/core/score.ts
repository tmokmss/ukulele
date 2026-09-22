/**
 * 楽譜 (コード譜) を JSON で受け取り、タイムラインのスロットと打点に落とす。
 *
 * 書式は docs/score-format.md。要は「1小節 = 1つの文字列」で、
 * 小節の中にコードを並べると等分し、"." は前のコードを伸ばす。
 * ストロークは "D-DU-UDU" のような文字列で、文字数がそのまま小節の分割数になる。
 * 「|」で区切ると小節ごとに順番に当たるので、2小節で1周するパターンも書ける。
 *
 *   { "title": "きらきら星", "bpm": 90, "strum": "D-DU-UDU",
 *     "sections": [{ "name": "Aメロ", "repeat": 2, "bars": ["C", "F C"] }] }
 *
 * 書くのは Claude で、読めなかったときはこのエラー文をそのまま投げ返して直す。
 * だから「何小節目の何が悪いか」を、途中で止めずに全部返す。
 */
import { CHORDS, LIB } from './chords';
import { makeTimeline, type Hit, type Slot, type Stroke, type Timeline } from './timeline';

export type Score = {
  title: string;
  /** 楽譜が指定するテンポ。無ければ null で、いまの設定のまま */
  bpm: number | null;
  beatsPerBar: number;
  /** 曲全体を通す回数 */
  repeat: number;
  /** 1周ぶんのコード */
  slots: Slot[];
  /** 1周ぶんの打点。ストローク指定が無ければ空 */
  hits: Hit[];
  /** 1周ぶんの小節数 (セクションの繰り返しを展開したあと) */
  bars: number;
  /** 出てきた順の、使われているコード */
  chords: string[];
  /**
   * 画面に出すストローク。2小節以上で1周するパターンは "…|…" でつないである。
   * セクションごとに違えば null
   */
  strum: string | null;
  sections: { name: string; bars: number; repeat: number }[];
};

export type ParseResult = { ok: true; score: Score } | { ok: false; error: string };

/** 前のコードを伸ばす記号 */
const HOLD = ['.', '-', '%'];
/** ストロークの休み */
const REST = ['-', '.', '_'];
const MAX_BARS = 400;
const MAX_ERRORS = 6;
const DEFAULT_TITLE = '名前のない楽譜';
/** 拍をここまで割れる。16分より細かい位置には置けない */
const GRID_DIV = 4;

const err = (error: string): ParseResult => ({ ok: false, error });

type RawSection = { name: string; bars: string[]; repeat: number; strum: string[] | null };

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
  if (!('bars' in obj) && !('sections' in obj))
    return err('bars か sections がありません。小節を並べた配列を入れてください。');

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

  const top = readStrum(obj.strum, beatsPerBar, 'strum');
  if (!top.ok) return err(top.error);

  const sections = readSections(obj, beatsPerBar, top.strum);
  if (typeof sections === 'string') return err(sections);

  const slots: Slot[] = [];
  const hits: Hit[] = [];
  const errors: string[] = [];
  const unknown = new Set<string>();
  let beat = 0;
  let barNo = 0;

  for (const sec of sections) {
    for (let r = 0; r < sec.repeat; r++) {
      for (let bi = 0; bi < sec.bars.length; bi++) {
        const bar = sec.bars[bi];
        barNo++;
        const where = sec.name ? `${sec.name} ${barNo}小節目` : `${barNo}小節目`;
        const tokens = bar.split(/\s+/).filter(Boolean);
        if ((beatsPerBar * GRID_DIV) % tokens.length !== 0) {
          push(errors, `${where}「${bar}」: ${beatsPerBar}拍を${tokens.length}個に割れません。"C . F" のように "." で位置を作ってください。`);
        } else {
          const beats = beatsPerBar / tokens.length;
          for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (HOLD.includes(t)) {
              const prev = slots[slots.length - 1];
              if (!prev) push(errors, `${where}: 先頭に「${t}」は置けません。伸ばす元のコードがありません。`);
              else prev.beats += beats;
            } else if (CHORDS[t]) {
              slots.push({ chord: t, beats });
            } else {
              unknown.add(t);
            }
          }
        }
        if (sec.strum) {
          // パターンが複数あれば、小節の並びの先頭から順に当てる。
          // 繰り返しのたびに先頭へ戻るので、2小節パターンが途中でずれない
          const pat = sec.strum[bi % sec.strum.length];
          const step = beatsPerBar / pat.length;
          for (let i = 0; i < pat.length; i++) {
            const c = pat[i];
            if (!REST.includes(c)) hits.push({ beat: beat + i * step, dir: c as Stroke });
          }
        }
        beat += beatsPerBar;
      }
    }
  }

  if (unknown.size)
    push(errors, `使えないコードがあります: ${[...unknown].join(' ')}\n使えるのは ${LIB.join(' ')} です。`);
  if (!barNo) return err('小節がありません。');
  if (barNo > MAX_BARS) return err(`小節が多すぎます (${barNo})。${MAX_BARS} まで。`);
  if (errors.length) return err(errors.join('\n'));
  if (!slots.length) return err('コードがありません。');

  const strums = new Set(sections.map((s) => (s.strum ?? []).join(' | ')));
  return {
    ok: true,
    score: {
      title,
      bpm,
      beatsPerBar,
      repeat,
      slots,
      hits,
      bars: barNo,
      chords: [...new Set(slots.map((s) => s.chord))],
      strum: strums.size === 1 ? ([...strums][0] || null) : null,
      sections: sections.map((s) => ({ name: s.name, bars: s.bars.length, repeat: s.repeat })),
    },
  };
}

/** 楽譜は「通す回数が決まっているタイムライン」 */
export function scoreTimeline(score: Score): Timeline {
  return makeTimeline(score.slots, { barBeats: score.beatsPerBar, cycles: score.repeat, hits: score.hits });
}

function push(errors: string[], msg: string): void {
  if (errors.length < MAX_ERRORS && !errors.includes(msg)) errors.push(msg);
}

/** sections が無ければ、bars 全体を1つのセクションとして扱う */
function readSections(
  obj: Record<string, unknown>,
  beatsPerBar: number,
  topStrum: string[] | null,
): RawSection[] | string {
  if (!('sections' in obj)) {
    const bars = flattenBars(obj.bars);
    if (typeof bars === 'string') return bars;
    return [{ name: '', bars, repeat: 1, strum: topStrum }];
  }
  if (!Array.isArray(obj.sections)) return 'sections は配列にしてください。';
  const out: RawSection[] = [];
  for (let i = 0; i < obj.sections.length; i++) {
    const s = obj.sections[i];
    if (typeof s !== 'object' || s === null || Array.isArray(s))
      return `sections の ${i + 1} 番目が { } になっていません。`;
    const sec = s as Record<string, unknown>;
    const name = typeof sec.name === 'string' ? sec.name.trim() : '';
    const where = name || `sections の ${i + 1} 番目`;
    if (!('bars' in sec)) return `${where}: bars がありません。`;
    const bars = flattenBars(sec.bars);
    if (typeof bars === 'string') return `${where}: ${bars}`;
    const repeat = intField(sec.repeat, 1, 1, 16);
    if (repeat == null) return `${where}: repeat は 1〜16 の整数にしてください。`;
    let strum = topStrum;
    if ('strum' in sec) {
      const r = readStrum(sec.strum, beatsPerBar, `${where} の strum`);
      if (!r.ok) return r.error;
      strum = r.strum;
    }
    out.push({ name, bars, repeat, strum });
  }
  return out;
}

type StrumResult = { ok: true; strum: string[] | null } | { ok: false; error: string };

/**
 * ストロークを正規化する。1つのパターンの文字数が、その小節の分割数になる。
 *
 * 小節は `bars` と同じく「|」で区切るか、配列で並べる。2つ以上あると、
 * 小節の並びの先頭から順に当てていく。ボサノバのように1周が2小節ある
 * パターンは、これで書く。
 *
 *   "D-D--U-- | D--U--D-"   ↔   ["D-D--U--", "D--U--D-"]
 *
 * 片方が休みだけでも通す (2小節パターンの裏返しとしてありうる)。
 * 1周のどこでも鳴らないときだけ断る。
 */
function readStrum(value: unknown, beatsPerBar: number, where: string): StrumResult {
  const bad = (error: string): StrumResult => ({ ok: false, error });
  if (value == null) return { ok: true, strum: null };
  const list: unknown[] = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string')
      return bad(`${where} は "D-DU-UDU" のような文字列か、その配列にしてください。`);
    for (const part of item.split('|')) {
      const s = part
        .replace(/\s+/g, '')
        .replace(/↓/g, 'D')
        .replace(/↑/g, 'U')
        .replace(/[dD]/g, 'D')
        .replace(/[uU]/g, 'U')
        .replace(/[xX]/g, 'x')
        .replace(/[._]/g, '-');
      if (!s) continue;
      if (!/^[DUx-]+$/.test(s))
        return bad(`${where}: 使えるのは D (ダウン)、U (アップ)、x (ミュート)、- (鳴らさない) です。`);
      if ((beatsPerBar * GRID_DIV) % s.length !== 0)
        return bad(`${where}: ${s.length}文字だと${beatsPerBar}拍を割り切れません。${divisors(beatsPerBar)} 文字のどれかにしてください。`);
      out.push(s);
    }
  }
  if (!out.length) return { ok: true, strum: null };
  if (!out.some((s) => s.split('').some((c) => c !== '-'))) return bad(`${where}: 1回も鳴らしません。`);
  return { ok: true, strum: out };
}

/** その拍子で使える文字数 (16分まで) */
function divisors(beatsPerBar: number): string {
  const n = beatsPerBar * GRID_DIV;
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out.join(' / ');
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
