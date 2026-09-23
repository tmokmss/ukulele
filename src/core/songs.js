/**
 * 楽譜はリポジトリの `songs/*.json` で管理する。
 *
 * 画面で打ち込むのではなく、Claude に書かせてコミットし、アプリはタイトルから選ぶだけ。
 * ビルドに同梱するので、取りに行く通信も GitHub Pages のパスの心配も要らない。
 * ファイル名がそのまま id (設定に残すのはこれ)、曲名は JSON の title。
 */
import { parseScore } from './score';
const files = import.meta.glob('../../songs/*.json', {
    eager: true,
    query: '?raw',
    import: 'default',
});
const songs = [];
const errors = [];
for (const [path, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
    const r = parseScore(text);
    if (r.ok)
        songs.push({ id, score: r.score });
    else
        errors.push({ id, error: r.error });
}
export const SONGS = songs;
export const SONG_ERRORS = errors;
export const findSong = (id) => songs.find((s) => s.id === id) ?? null;
