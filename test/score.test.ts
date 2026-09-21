/**
 * 楽譜の JSON は人が手で書く。
 * 読めたときは「拍の上に並んだコード」に、読めないときは直せる文言になることを見る。
 */
import { describe, expect, it } from 'vitest';
import { parseScore, SAMPLE_SCORE, scoreTimeline } from '../src/core/score';

/** 読めた前提で中身を取り出す */
function ok(text: string) {
  const r = parseScore(text);
  if (!r.ok) throw new Error(`読めるはずが読めなかった: ${r.error}`);
  return r.score;
}

function ng(text: string): string {
  const r = parseScore(text);
  if (r.ok) throw new Error('読めないはずが読めてしまった');
  return r.error;
}

describe('小節をコードに割る', () => {
  it('1小節に1つなら、その小節ぜんぶ', () => {
    expect(ok('{"bars":["C","F"]}').slots).toEqual([
      { chord: 'C', beats: 4 },
      { chord: 'F', beats: 4 },
    ]);
  });

  it('小節に並べたぶんだけ等分する', () => {
    expect(ok('{"bars":["G7 C"]}').slots).toEqual([
      { chord: 'G7', beats: 2 },
      { chord: 'C', beats: 2 },
    ]);
    expect(ok('{"bars":["C Am F G7"]}').slots.map((s) => s.beats)).toEqual([1, 1, 1, 1]);
  });

  it('拍子は beatsPerBar で変わる', () => {
    expect(ok('{"beatsPerBar":3,"bars":["C","F Am Dm"]}')).toMatchObject({
      beatsPerBar: 3,
      slots: [
        { chord: 'C', beats: 3 },
        { chord: 'F', beats: 1 },
        { chord: 'Am', beats: 1 },
        { chord: 'Dm', beats: 1 },
      ],
    });
  });

  it('等分できない切り替えは "." で作る (3拍子の3拍目でチェンジ)', () => {
    expect(ok('{"beatsPerBar":3,"bars":["C . Am"]}').slots).toEqual([
      { chord: 'C', beats: 2 },
      { chord: 'Am', beats: 1 },
    ]);
  });

  it('等分できない並べ方は、何小節目か言って断る', () => {
    expect(ng('{"bars":["C","C F G7"]}')).toContain('2小節目');
  });
});

describe('コードを伸ばす', () => {
  it('"." は前のコードをそのぶん伸ばす', () => {
    expect(ok('{"bars":["C","."]}').slots).toEqual([{ chord: 'C', beats: 8 }]);
    expect(ok('{"bars":["C .","F"]}').slots).toEqual([
      { chord: 'C', beats: 4 },
      { chord: 'F', beats: 4 },
    ]);
  });

  it('"-" と "%" も同じ', () => {
    expect(ok('{"bars":["C","-","%"]}').slots).toEqual([{ chord: 'C', beats: 12 }]);
  });

  it('伸ばす元がないと断る', () => {
    expect(ng('{"bars":[".","C"]}')).toContain('1小節目');
  });
});

describe('小節の書き方', () => {
  it('| で区切って1行に書ける', () => {
    expect(ok('{"bars":"C | F | G7 C"}').bars).toBe(3);
    expect(ok('{"bars":["C | F","G7"]}').slots.map((s) => s.chord)).toEqual(['C', 'F', 'G7']);
  });

  it('余った | や空の小節は落とす', () => {
    expect(ok('{"bars":["C | F |"]}').bars).toBe(2);
  });

  it('配列だけでも楽譜になる', () => {
    expect(ok('["C","F"]')).toMatchObject({ bars: 2, beatsPerBar: 4, repeat: 1, title: '名前のない楽譜' });
  });
});

describe('曲の情報', () => {
  it('題名・テンポ・回数・使うコードを持つ', () => {
    expect(ok('{"title":" 練習曲 ","bpm":92.4,"repeat":3,"bars":["C","F","C"]}')).toMatchObject({
      title: '練習曲',
      bpm: 92,
      repeat: 3,
      bars: 3,
      chords: ['C', 'F'],
    });
  });

  it('省略したぶんは既定値、bpm は「指定なし」', () => {
    expect(ok('{"bars":["C"]}')).toMatchObject({ bpm: null, beatsPerBar: 4, repeat: 1 });
  });

  it('範囲の外の値は断る', () => {
    expect(ng('{"bpm":500,"bars":["C"]}')).toContain('bpm');
    expect(ng('{"repeat":0,"bars":["C"]}')).toContain('repeat');
    expect(ng('{"beatsPerBar":0,"bars":["C"]}')).toContain('beatsPerBar');
  });
});

describe('読めないもの', () => {
  it('JSON になっていない', () => {
    expect(ng('{"bars":')).toContain('JSON');
  });

  it('bars がない', () => {
    expect(ng('{"title":"曲"}')).toContain('bars');
  });

  it('知らないコードは、まとめて名前を出す', () => {
    const e = ng('{"bars":["C","Bm","F#m"]}');
    expect(e).toContain('Bm');
    expect(e).toContain('F#m');
  });
});

describe('タイムラインに乗せる', () => {
  it('回数ぶんで終わる', () => {
    const tl = scoreTimeline(ok('{"repeat":2,"bars":["C","F"]}'));
    expect(tl.cycleBeats).toBe(8);
    expect(tl.cycles).toBe(2);
    expect(tl.barBeats).toBe(4);
  });

  it('サンプルはそのまま練習できる', () => {
    const score = ok(SAMPLE_SCORE);
    expect(score.title).toBe('きらきら星');
    expect(score.bars).toBe(12);
    expect(scoreTimeline(score).cycleBeats).toBe(48);
  });
});
