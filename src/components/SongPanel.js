import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { findSong, SONG_ERRORS, SONGS } from '../core/songs';
import { Combobox } from './Combobox';
/** リポジトリに入っている楽譜を、タイトルで選ぶ */
export function SongPanel({ songId, running, bpm, onPick }) {
    const items = SONGS.map(({ id, score }) => ({
        value: id,
        label: score.title,
        // ファイル名はローマ字で付けてあるので、それだけでもアルファベットで引ける
        keywords: [id, ...score.keywords],
        hint: `${score.bars}小節 / ${score.beatsPerBar}拍子 / ${score.bpm ?? bpm} BPM · ${score.chords.join(' ')}`,
    }));
    return (_jsxs("section", { className: "block songs", "aria-label": "\u697D\u8B5C", children: [_jsx("h2", { children: "\u697D\u8B5C" }), SONGS.length === 0 ? (_jsx("p", { className: "empty", children: "songs/ \u306B\u697D\u8B5C\u304C\u3042\u308A\u307E\u305B\u3093\u3002" })) : (_jsx(Combobox, { label: "\u7DF4\u7FD2\u3059\u308B\u66F2", items: items, value: songId, disabled: running, placeholder: "\u66F2\u3092\u9078\u3076", searchPlaceholder: "\u66F2\u540D\u3067\u7D5E\u308A\u8FBC\u3080", empty: "\u305D\u306E\u540D\u524D\u306E\u66F2\u306F\u3042\u308A\u307E\u305B\u3093", onChange: (id) => {
                    const song = findSong(id);
                    if (song)
                        onPick(song);
                } })), SONG_ERRORS.map((e) => (_jsxs("p", { className: "note warn msg", children: ["songs/", e.id, ".json \u304C\u8AAD\u3081\u307E\u305B\u3093:", '\n', e.error] }, e.id)))] }));
}
