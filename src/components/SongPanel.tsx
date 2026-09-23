import { findSong, SONG_ERRORS, SONGS, type Song } from '../core/songs';
import { Combobox, type ComboItem } from './Combobox';

type Props = {
  /** いま選ばれている楽譜の id */
  songId: string;
  running: boolean;
  /** いまのテンポ。曲が bpm を持たないときの見積もりに使う */
  bpm: number;
  onPick: (song: Song) => void;
};

/** リポジトリに入っている楽譜を、タイトルで選ぶ */
export function SongPanel({ songId, running, bpm, onPick }: Props) {
  const items: ComboItem[] = SONGS.map(({ id, score }) => ({
    value: id,
    label: score.title,
    hint: `${score.bars}小節 / ${score.beatsPerBar}拍子 / ${score.bpm ?? bpm} BPM · ${score.chords.join(' ')}`,
  }));

  return (
    <section className="block songs" aria-label="楽譜">
      <h2>楽譜</h2>

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

      {SONG_ERRORS.map((e) => (
        <p key={e.id} className="note warn msg">
          songs/{e.id}.json が読めません:{'\n'}
          {e.error}
        </p>
      ))}
    </section>
  );
}
