/**
 * チューナーの音程検出。弦1本ぶんの波形を作って、セント単位で当たるかを見る。
 * 針が数セント動く表示なので、ビン幅 (約3Hz = C4 で約19セント) より細かい精度が要る。
 */
import { describe, expect, it } from 'vitest';
import { OPEN, STRING_NAME } from './chords';
import { detectPitch, nearestString, noteName } from './pitch';
import { spectrumDb } from '../testing/fft';
const SAMPLE_RATE = 48000;
const FFT_SIZE = 16384;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE;
/** ウクレレらしい倍音の振幅比 */
const PARTIALS = [1, 0.5, 0.3, 0.18];
/** 基本波が2倍音より弱い鳴り方。オクターブ違いに引っぱられないかを見る */
const PARTIALS_WEAK_F0 = [0.4, 1, 0.5, 0.25];
function midiToHz(midi, cents = 0) {
    return 440 * Math.pow(2, (midi - 69) / 12) * Math.pow(2, cents / 1200);
}
/** 弦1本を鳴らした時間波形 */
function renderString(midi, cents, partials = PARTIALS) {
    const sig = new Float64Array(FFT_SIZE);
    const f0 = midiToHz(midi, cents);
    for (let h = 0; h < partials.length; h++) {
        const f = f0 * (h + 1);
        if (f > SAMPLE_RATE / 2)
            break;
        const amp = partials[h] * 0.25;
        const phase = Math.random() * Math.PI * 2;
        for (let i = 0; i < FFT_SIZE; i++)
            sig[i] += amp * Math.sin((2 * Math.PI * f * i) / SAMPLE_RATE + phase);
    }
    return sig;
}
function detectCents(midi, cents, partials = PARTIALS) {
    const p = detectPitch(spectrumDb(renderString(midi, cents, partials)), BIN_HZ);
    return p == null ? null : (p.midi - midi) * 100;
}
describe('開放弦の音程', () => {
    for (let s = 0; s < OPEN.length; s++) {
        for (const cents of [0, 12, -12, 40, -40]) {
            it(`${STRING_NAME[s]} の ${cents >= 0 ? '+' : ''}${cents} セントを当てる`, () => {
                const got = detectCents(OPEN[s], cents);
                expect(got).not.toBeNull();
                expect(Math.abs(got - cents), `got ${got?.toFixed(1)} cents`).toBeLessThan(4);
            });
        }
    }
    it('基本波が2倍音より弱くても、オクターブを間違えない', () => {
        const got = detectCents(OPEN[1], 0, PARTIALS_WEAK_F0);
        expect(got).not.toBeNull();
        expect(Math.abs(got)).toBeLessThan(4);
    });
    it('無音では何も返さない', () => {
        expect(detectPitch(spectrumDb(new Float64Array(FFT_SIZE)), BIN_HZ)).toBeNull();
    });
});
describe('いちばん近い弦', () => {
    for (let s = 0; s < OPEN.length; s++) {
        it(`${STRING_NAME[s]} の近くなら ${STRING_NAME[s]} を指す`, () => {
            const t = nearestString(OPEN[s] - 0.3);
            expect(t?.index).toBe(s);
            expect(t.cents).toBeCloseTo(-30, 5);
        });
    }
    it('どの弦からも離れていれば決めない', () => {
        expect(nearestString(OPEN[1] - 3)).toBeNull();
    });
    it('音名はオクターブつきで出す', () => {
        expect(noteName(60)).toBe('C4');
        expect(noteName(69.2)).toBe('A4');
    });
});
