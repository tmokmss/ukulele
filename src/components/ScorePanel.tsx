import { useMemo } from 'react';
import { LIB } from '../core/chords';
import { parseScore, SAMPLE_SCORE, scoreTimeline, type Score } from '../core/score';
import { canJudgeChords, MIN_CHORD_SEC } from '../core/timeline';

type Props = {
  text: string;
  onChange: (text: string) => void;
  /** この楽譜で練習する。テンポも楽譜のものに合わせる */
  onUse: (score: Score) => void;
  /** いま楽譜モードか */
  active: boolean;
  running: boolean;
  /** いまのテンポ。この曲でコードまで採点できるかの判断に使う */
  bpm: number;
};

/** 楽譜の JSON を貼る場所。読めたかどうかは打つそばから返す */
export function ScorePanel({ text, onChange, onUse, active, running, bpm }: Props) {
  const parsed = useMemo(() => (text.trim() ? parseScore(text) : null), [text]);
  const score = parsed?.ok ? parsed.score : null;
  const judge = useMemo(
    () => (score ? canJudgeChords(scoreTimeline(score), score.bpm ?? bpm) : false),
    [score, bpm],
  );

  return (
    <section className="block score" aria-label="楽譜">
      <h2>楽譜</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        コード譜を JSON で貼ると、その曲を頭から通して練習できます。
      </p>

      <textarea
        className="scorebox"
        aria-label="楽譜の JSON"
        rows={9}
        spellCheck={false}
        placeholder={'{\n  "title": "きらきら星",\n  "bpm": 90,\n  "strum": "D-DU-UDU",\n  "bars": ["C", "F C", "C", "G7 C"]\n}'}
        value={text}
        disabled={running}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="row">
        <button
          type="button"
          className="btn-sub use"
          disabled={!score || running}
          onClick={() => score && onUse(score)}
        >
          {active ? 'この楽譜を読み直す' : 'この楽譜で練習する'}
        </button>
        <button type="button" className="btn-sub" disabled={running} onClick={() => onChange(SAMPLE_SCORE)}>
          サンプルを入れる
        </button>
        {text.trim() && (
          <button type="button" className="btn-sub" disabled={running} onClick={() => onChange('')}>
            消す
          </button>
        )}
      </div>

      {parsed && !parsed.ok && <p className="note warn msg">{parsed.error}</p>}
      {score && (
        <div className="msg">
          <p className="note">
            「{score.title}」 {score.bars}小節 / {score.beatsPerBar}拍子
            {score.repeat > 1 ? ` / ${score.repeat}回` : ''}
            {score.bpm ? ` / ${score.bpm} BPM` : ''} · {score.chords.join(' ')}
            {active ? ' · いま練習中' : ''}
          </p>
          <p className="note">
            {score.hits.length
              ? `ストローク ${score.strum ?? 'セクションごと'} (1小節 ${score.hits.length / score.bars} 回) を採点します`
              : 'ストローク指定なし。コードの切れ目だけを採点します'}
            {judge
              ? ' · コードも採点します'
              : ` · コードが ${MIN_CHORD_SEC} 秒より短いので、リズムだけ採点します`}
          </p>
        </div>
      )}

      <details className="fmt">
        <summary>書き方</summary>
        <ul>
          <li>
            <code>bars</code> は1つが1小節。<code>"C"</code> ならその小節はぜんぶ C
          </li>
          <li>
            <code>"G7 C"</code> のように並べると、その小節を等分する (4拍なら2拍ずつ)
          </li>
          <li>
            <code>"."</code> は前のコードをそのぶん伸ばす。<code>"C"</code> <code>"."</code> で2小節のばし
          </li>
          <li>
            <code>"C | F | G7"</code> と <code>|</code> で区切って、1行にまとめてもいい
          </li>
          <li>
            <code>strum</code> は <code>"D-DU-UDU"</code> のように書く。<b>文字数がその小節の分割数</b>
            （8文字なら8分）。<code>D</code> ダウン <code>U</code> アップ <code>x</code> ミュート{' '}
            <code>-</code> 鳴らさない
          </li>
          <li>
            <code>sections</code> で <code>{'{ "name": "サビ", "repeat": 2, "bars": [...] }'}</code>{' '}
            と区切れる。<code>strum</code> はセクションごとに変えられる
          </li>
          <li>
            <code>title</code> / <code>bpm</code> / <code>beatsPerBar</code> (既定 4) / <code>repeat</code> (既定 1)
            は省略できる
          </li>
          <li>使えるコード: {LIB.join(' ')}</li>
        </ul>
      </details>
    </section>
  );
}
