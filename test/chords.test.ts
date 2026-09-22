/**
 * お手本はここで出した音をそのまま鳴らすので、オクターブがずれると曲にならない。
 * 開放弦 (G4 C4 E4 A4) を基準に、代表的なコードの実音を固定しておく。
 */
import { describe, expect, it } from 'vitest';
import { chordMidi, CHORDS, LIB, OPEN } from '../src/core/chords';

/** MIDI ノート番号を C4=60 基準の音名にする。読んで確かめられるように */
const NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const spell = (m: number): string => `${NAME[m % 12]}${Math.floor(m / 12) - 1}`;

describe('chordMidi', () => {
  it('開放弦は G4 C4 E4 A4', () => {
    expect(OPEN.map(spell)).toEqual(['G4', 'C4', 'E4', 'A4']);
  });

  it('C は 1弦だけ3フレットで、実音が C5 になる', () => {
    expect(chordMidi('C')).toEqual([67, 60, 64, 72]);
    expect(chordMidi('C').map(spell)).toEqual(['G4', 'C4', 'E4', 'C5']);
  });

  it('F は A4 C4 F4 A4', () => {
    expect(chordMidi('F').map(spell)).toEqual(['A4', 'C4', 'F4', 'A4']);
  });

  it('G7 は 4音そろう (G B D F)', () => {
    const pcs = new Set(chordMidi('G7').map((m) => NAME[m % 12]));
    expect(pcs).toEqual(new Set(['G', 'B', 'D', 'F']));
  });

  it('知らないコードは空を返す (鳴らさずに済ませる)', () => {
    expect(chordMidi('Xyz')).toEqual([]);
  });

  it('全コードが4弦ぶんの実音を持ち、開放弦以上の高さになる', () => {
    for (const name of LIB) {
      const midi = chordMidi(name);
      expect(midi, name).toHaveLength(4);
      midi.forEach((m, i) => {
        expect(m, `${name} の${4 - i}弦`).toBeGreaterThanOrEqual(OPEN[i]);
        expect(m - OPEN[i], `${name} の${4 - i}弦`).toBe(CHORDS[name][i]);
      });
    }
  });
});
