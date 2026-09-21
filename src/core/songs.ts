/**
 * 楽譜はリポジトリの `songs/*.json` で管理する。
 *
 * 画面で打ち込むのではなく、Claude に書かせてコミットし、アプリはタイトルから選ぶだけ。
 * ビルドに同梱するので、取りに行く通信も GitHub Pages のパスの心配も要らない。
 * ファイル名がそのまま id (設定に残すのはこれ)、曲名は JSON の title。
 */
import { parseScore, type Score } from './score';

export type Song = { id: string; score: Score };
/** 読めなかった楽譜。画面にそのまま出して、直す手がかりにする */
export type SongError = { id: string; error: string };

const files = import.meta.glob('../../songs/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const songs: Song[] = [];
const errors: SongError[] = [];
for (const [path, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
  const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
  const r = parseScore(text);
  if (r.ok) songs.push({ id, score: r.score });
  else errors.push({ id, error: r.error });
}

export const SONGS: Song[] = songs;
export const SONG_ERRORS: SongError[] = errors;

export const findSong = (id: string): Song | null => songs.find((s) => s.id === id) ?? null;
