/**
 * コードの定義と、そこから導く解析用テンプレート。
 * PoC (docs/legacy-poc.html) の CHORDS / TEMPL をそのまま移したもの。
 */
export const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** 開放弦の MIDI ノート番号。G4 C4 E4 A4 (4弦 → 1弦)、High-G 前提 */
export const OPEN = [67, 60, 64, 69];
export const STRING_NAME = ['4弦', '3弦', '2弦', '1弦'];
/** フレット番号は 4弦→1弦 (G C E A) の順 */
export const CHORDS = {
    C: [0, 0, 0, 3],
    Am: [2, 0, 0, 0],
    F: [2, 0, 1, 0],
    G: [0, 2, 3, 2],
    G7: [0, 2, 1, 2],
    D: [2, 2, 2, 0],
    Dsus2: [2, 2, 0, 0],
    D7: [2, 2, 2, 3],
    Dm: [2, 2, 1, 0],
    Em: [0, 4, 3, 2],
    A: [2, 1, 0, 0],
    A7: [0, 1, 0, 0],
    E7: [1, 2, 0, 2],
    C7: [0, 0, 0, 1],
    Bb: [3, 2, 1, 1],
    Am7: [0, 0, 0, 0],
};
export const LIB = Object.keys(CHORDS);
/** そのコードを押さえたときに各弦が出す実音 (MIDI ノート番号)。4弦 → 1弦。知らないコードは空 */
export function chordMidi(chord) {
    const frets = CHORDS[chord];
    return frets ? frets.map((f, i) => OPEN[i] + f) : [];
}
export const TEMPL = {};
for (const name of LIB) {
    const stringPcs = CHORDS[name].map((f, i) => (OPEN[i] + f) % 12);
    const pcs = [...new Set(stringPcs)];
    TEMPL[name] = { stringPcs, pcs, norm: Math.sqrt(pcs.length) };
}
export const PRESETS = [
    ['C', 'Am', 'F', 'G7'],
    ['C', 'F'],
    ['D', 'G'],
    ['D', 'Dsus2'],
    ['G', 'D', 'Em', 'C'],
    ['F', 'Bb'],
    ['A7', 'D', 'G'],
    ['Am', 'Dm', 'E7'],
];
/** 「○弦 (音名)」の表示。同じ音名が2弦にあるときは「4弦か1弦」になる */
export function weakLabel(chord, pc) {
    const strs = TEMPL[chord].stringPcs
        .map((p, i) => (p === pc ? STRING_NAME[i] : null))
        .filter((x) => x !== null);
    return `${strs.join('か')} (${NOTE[pc]})`;
}
