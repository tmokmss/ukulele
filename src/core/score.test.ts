/**
 * 楽譜の JSON は人が手で書く。
 * 読めたときは「拍の上に並んだコード」に、読めないときは直せる文言になることを見る。
 */
import { describe, expect, it } from 'vitest';
import { parseScore, scoreTimeline } from './score';
import { SONG_ERRORS, SONGS } from './songs';

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

  it('keywords は文字列1つでも配列でもいい', () => {
    expect(ok('{"keywords":"zousan","bars":["C"]}').keywords).toEqual(['zousan']);
    expect(ok('{"keywords":[" zousan ","","Elephant"],"bars":["C"]}').keywords).toEqual(['zousan', 'Elephant']);
    expect(ok('{"bars":["C"]}').keywords).toEqual([]);
    expect(ng('{"keywords":[1],"bars":["C"]}')).toContain('keywords');
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

});

/**
 * 楽譜はリポジトリで管理する。壊れたものが混ざるとアプリの一覧から消えるので、
 * ここで全部通しておく (画面に貼って気づくのでは遅い)
 */
describe('songs/ に入っている楽譜', () => {
  it('全部読める', () => {
    // 落ちたらエラー文がそのまま出る
    expect(SONG_ERRORS.map((e) => `songs/${e.id}.json: ${e.error}`)).toEqual([]);
    expect(SONGS.length).toBeGreaterThan(0);
  });

  it('曲名と小節と打点がそろっている', () => {
    for (const { id, score } of SONGS) {
      expect(`${id}: ${score.title}`).not.toContain('名前のない楽譜');
      expect(score.bars).toBeGreaterThan(0);
      expect(scoreTimeline(score).cycleBeats).toBeGreaterThan(0);
    }
  });
});

describe('ストローク', () => {
  it('文字数がその小節の分割数になる', () => {
    // 8文字 = 8分。"-" は鳴らさない
    expect(ok('{"strum":"D-DU-UDU","bars":["C"]}').hits).toEqual([
      { beat: 0, dir: 'D' },
      { beat: 1, dir: 'D' },
      { beat: 1.5, dir: 'U' },
      { beat: 2.5, dir: 'U' },
      { beat: 3, dir: 'D' },
      { beat: 3.5, dir: 'U' },
    ]);
  });

  it('4文字なら4分、16文字なら16分', () => {
    expect(ok('{"strum":"DDDD","bars":["C"]}').hits.map((h) => h.beat)).toEqual([0, 1, 2, 3]);
    expect(ok('{"strum":"DUDUDUDUDUDUDUDU","bars":["C"]}').hits.length).toBe(16);
  });

  it('小節ごとに同じパターンが並ぶ', () => {
    expect(ok('{"strum":"D-D-","bars":["C","F"]}').hits.map((h) => h.beat)).toEqual([0, 2, 4, 6]);
  });

  it('ミュートと矢印も読む', () => {
    expect(ok('{"strum":"D x ↓ ↑","bars":["C"]}').hits.map((h) => h.dir)).toEqual(['D', 'x', 'D', 'U']);
  });

  it('割り切れない文字数は、使える数を教えて断る', () => {
    const e = ng('{"strum":"DDD","bars":["C"]}');
    expect(e).toContain('3文字');
    expect(e).toContain('4拍');
  });

  it('知らない記号と、1回も鳴らさないパターンは断る', () => {
    expect(ng('{"strum":"DZDZ","bars":["C"]}')).toContain('D (ダウン)');
    expect(ng('{"strum":"----","bars":["C"]}')).toContain('1回も鳴らしません');
  });

  it('指定がなければ打点は空 (コードの切れ目だけ見る)', () => {
    expect(ok('{"bars":["C"]}').hits).toEqual([]);
  });
});

describe('2小節で1周するストローク (ボサノバなど)', () => {
  it('「|」で区切ると、小節ごとに順番に当たる', () => {
    // 1小節目は頭、2小節目は2拍目
    expect(ok('{"strum":"D--- | -D--","bars":["C","F"]}').hits.map((h) => h.beat)).toEqual([0, 5]);
  });

  it('配列でも同じように書ける', () => {
    expect(ok('{"strum":["D---","-D--"],"bars":["C","F"]}').hits.map((h) => h.beat)).toEqual([0, 5]);
  });

  it('小節ごとに細かさを変えられる', () => {
    // 1小節目は4分、2小節目は8分
    expect(ok('{"strum":"DDDD | D-D-D-D-","bars":["C","F"]}').hits.map((h) => h.beat)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('繰り返しのたびに先頭へ戻る (奇数小節でも周期がずれない)', () => {
    const s = ok('{"strum":"D--- | -D--","sections":[{"repeat":2,"bars":["C"]}]}');
    // 2周目も1小節目なので、また "D---" が当たる
    expect(s.hits.map((h) => h.beat)).toEqual([0, 4]);
  });

  it('片方の小節が休みだけでもいい', () => {
    expect(ok('{"strum":"D-D- | ----","bars":["C","F"]}').hits.map((h) => h.beat)).toEqual([0, 2]);
  });

  it('1周まるごと鳴らさないときだけ断る', () => {
    expect(ng('{"strum":"---- | ----","bars":["C","F"]}')).toContain('1回も鳴らしません');
  });

  it('画面には「|」でつないだ形で出す', () => {
    expect(ok('{"strum":"D--- | -D--","bars":["C","F"]}').strum).toBe('D--- | -D--');
  });

  it('割り切れない小節があれば、そこで断る', () => {
    expect(ng('{"strum":"DDDD | DDD","bars":["C","F"]}')).toContain('3文字');
  });
});

describe('セクション', () => {
  it('繰り返しを展開して並べる', () => {
    const s = ok('{"sections":[{"name":"A","repeat":2,"bars":["C","F"]},{"name":"B","bars":["G7"]}]}');
    expect(s.bars).toBe(5);
    expect(s.slots.map((x) => x.chord)).toEqual(['C', 'F', 'C', 'F', 'G7']);
    expect(s.sections).toEqual([
      { name: 'A', bars: 2, repeat: 2 },
      { name: 'B', bars: 1, repeat: 1 },
    ]);
  });

  it('ストロークはセクションごとに変えられる', () => {
    const s = ok('{"strum":"D-D-","sections":[{"bars":["C"]},{"strum":"DUDU","bars":["F"]}]}');
    expect(s.hits.map((h) => h.beat)).toEqual([0, 2, 4, 5, 6, 7]);
    // 混ざっているので「1つのパターン」としては出さない
    expect(s.strum).toBeNull();
  });

  it('小節をまたいでコードを伸ばせる', () => {
    const s = ok('{"sections":[{"bars":["C","."]},{"bars":["F"]}]}');
    expect(s.slots).toEqual([
      { chord: 'C', beats: 8 },
      { chord: 'F', beats: 4 },
    ]);
  });

  it('セクションの間違いは名前で示す', () => {
    expect(ng('{"sections":[{"name":"サビ","bars":["C"],"repeat":0}]}')).toContain('サビ');
    expect(ng('{"sections":[{"name":"A"}]}')).toContain('bars がありません');
  });
});

describe('細かい位置', () => {
  it('4拍を8つに割れる (3拍半で次のコードに食い込む)', () => {
    // C - - - - F - -  →  C が5つぶん (2.5拍)、F が3つぶん (1.5拍)
    expect(ok('{"bars":["C - - - - F - -"]}').slots).toEqual([
      { chord: 'C', beats: 2.5 },
      { chord: 'F', beats: 1.5 },
    ]);
  });

  it('16分まで。それより細かいと断る', () => {
    expect(ok('{"bars":["C . . . . . . . . . . . . . . ."]}').slots[0].beats).toBe(4);
    expect(ng('{"bars":["C . . . . . . . . . . . . . . . ."]}')).toContain('割れません');
  });
});

describe('エラーは全部まとめて返す', () => {
  it('小節ごとの間違いを並べる', () => {
    const e = ng('{"bars":["C F G7","Bm","C F G7 Am Dm"]}');
    expect(e).toContain('1小節目');
    expect(e).toContain('3小節目');
    expect(e).toContain('Bm');
  });
});
