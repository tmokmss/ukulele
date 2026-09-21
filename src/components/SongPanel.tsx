import { scoreTimeline } from '../core/score';
import { findSong, SONG_ERRORS, SONGS, type Song } from '../core/songs';
import { canJudgeChords, MIN_CHORD_SEC } from '../core/timeline';
import { Combobox, type ComboItem } from './Combobox';

type Props = {
  /** いま選ばれている楽譜の id */
  songId: string;
  /** いま楽譜モードか */
  active: boolean;
  running: boolean;
  /** いまのテンポ。曲が bpm を持たないときの見積もりに使う */
  bpm: number;
  onPick: (song: Song) => void;
};

/** リポジトリに入っている楽譜を、タイトルで選ぶ */
export function SongPanel({ songId, active, running, bpm, onPick }: Props) {
  const items: ComboItem[] = SONGS.map(({ id, score }) => ({
    value: id,
    label: score.title,
    hint: `${score.bars}小節 / ${score.beatsPerBar}拍子 / ${score.bpm ?? bpm} BPM · ${score.chords.join(' ')}`,
  }));
  const chosen = findSong(songId);

  return (
    <section className="block songs" aria-label="楽譜">
      <h2>楽譜</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        曲を選ぶと、頭から通して練習できます。
      </p>

      {SONGS.length === 0 ? (
        <p className="empty">songs/ に楽譜がありません。</p>
      ) : (
        <Combobox
          label="練習する曲"
          items={items}
          value={songId}
          disabled={running}
          placeholder="曲を選ぶ"
          searchPlaceholder="曲名で絞り込む"
          empty="その名前の曲はありません"
          onChange={(id) => {
            const song = findSong(id);
            if (song) onPick(song);
          }}
        />
      )}

      {chosen && (
        <p className="note">
          {chosen.score.repeat > 1 ? `${chosen.score.repeat}周 · ` : ''}
          {chosen.score.hits.length
            ? `ストローク ${chosen.score.strum ?? 'セクションごと'}`
            : 'ストローク指定なし (コードの切れ目だけ採点)'}
          {canJudgeChords(scoreTimeline(chosen.score), chosen.score.bpm ?? bpm)
            ? ' · コードも採点'
            : ` · リズムだけ採点 (コードが${MIN_CHORD_SEC}秒未満)`}
          {active ? ' · いま練習中' : ''}
        </p>
      )}

      {SONG_ERRORS.map((e) => (
        <p key={e.id} className="note warn msg">
          songs/{e.id}.json が読めません:{'\n'}
          {e.error}
        </p>
      ))}

      <p className="note">
        楽譜は <code>songs/*.json</code> にあります。増やすときは Claude に <code>ukulele-score</code>{' '}
        スキルで書かせて、<code>npm run score</code> で確かめてからコミットしてください。
      </p>
    </section>
  );
}
