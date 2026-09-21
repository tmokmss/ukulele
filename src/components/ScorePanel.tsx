import { useMemo } from 'react';
import { LIB } from '../core/chords';
import { parseScore, SAMPLE_SCORE, type Score } from '../core/score';

type Props = {
  text: string;
  onChange: (text: string) => void;
  /** この楽譜で練習する。テンポも楽譜のものに合わせる */
  onUse: (score: Score) => void;
  /** いま楽譜モードか */
  active: boolean;
  running: boolean;
};

/** 楽譜の JSON を貼る場所。読めたかどうかは打つそばから返す */
export function ScorePanel({ text, onChange, onUse, active, running }: Props) {
  const parsed = useMemo(() => (text.trim() ? parseScore(text) : null), [text]);
  const score = parsed?.ok ? parsed.score : null;

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
        placeholder={'{\n  "title": "きらきら星",\n  "bpm": 90,\n  "bars": ["C", "F C", "C", "G7 C"]\n}'}
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
        <p className="note msg">
          「{score.title}」 {score.bars}小節 / {score.beatsPerBar}拍子{score.repeat > 1 ? ` / ${score.repeat}回` : ''}
          {score.bpm ? ` / ${score.bpm} BPM` : ''} · {score.chords.join(' ')}
          {active ? ' · いま練習中' : ''}
        </p>
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
            <code>title</code> / <code>bpm</code> / <code>beatsPerBar</code> (既定 4) / <code>repeat</code> (既定 1)
            は省略できる
          </li>
          <li>使えるコード: {LIB.join(' ')}</li>
        </ul>
      </details>
    </section>
  );
}
