/**
 * テスト用の最小 FFT。Web Audio の AnalyserNode.getFloatFrequencyData を再現する。
 * 本番コードからは使わない。
 */
/** 基数2の反復 FFT。re/im を破壊的に書き換える */
export function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1)
            j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        const wr = Math.cos(ang);
        const wi = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let cr = 1;
            let ci = 0;
            for (let k = 0; k < len / 2; k++) {
                const ur = re[i + k];
                const ui = im[i + k];
                const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
                const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
                re[i + k] = ur + vr;
                im[i + k] = ui + vi;
                re[i + k + len / 2] = ur - vr;
                im[i + k + len / 2] = ui - vi;
                const nr = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = nr;
            }
        }
    }
}
/** Web Audio が AnalyserNode に使う Blackman 窓 */
export function blackman(n, N) {
    return 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / N) + 0.08 * Math.cos((4 * Math.PI * n) / N);
}
/**
 * 時間波形を getFloatFrequencyData と同じスケールの dB スペクトルにする。
 * @returns 長さ N/2 の dB 配列
 */
export function spectrumDb(signal) {
    const N = signal.length;
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i++)
        re[i] = signal[i] * blackman(i, N);
    fft(re, im);
    const out = new Float32Array(N / 2);
    for (let k = 0; k < N / 2; k++) {
        const mag = Math.hypot(re[k], im[k]) / N;
        out[k] = 20 * Math.log10(Math.max(mag, 1e-12));
    }
    return out;
}
