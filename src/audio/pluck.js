/** 焼く長さ。これより長く伸びる音は作らない */
const LEN_SEC = 2.0;
/** -60dB まで落ちるまでの秒数。ウクレレは短めに切れる */
const DECAY_SEC = 1.6;
/** 弦をなでる間隔。ダウンはゆっくり、アップは少し速い */
const SPREAD_DOWN = 0.013;
const SPREAD_UP = 0.010;
export function freqOf(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}
/** 同じ音は毎回同じ波形にする。鳴るたびに音色が変わらないように */
function lcg(seed) {
    let s = (seed * 1103515245 + 12345) >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 4294967296;
    };
}
/**
 * 弾いた弦1音ぶんの波形を作る。
 *
 * Karplus-Strong は「最初に入れた波が、遅延ループを回りながら高い倍音から削れていく」形で、
 * 倍音の強さは最初に入れた波でほぼ決まる。ここをノイズにすると倍音の山が音ごとにばらつき、
 * 基音が第3倍音より弱くなることがある (耳では成立するが、ピッチ検出は基音を見失う)。
 * なので 1/h で減る倍音を積んだ波を入れて、基音がいちばん強い状態から始める。
 *
 * 遅延ループは 1周ごとに damp 倍になる。そのままだと高い音ほど早く消えるので、
 * 1秒あたり f 周することから逆算して、どの高さでも DECAY_SEC で消えるようにする。
 *
 * AudioBuffer を作らずに済ませてあるのは、鳴らさずに高さを確かめられるようにするため
 * (テストがここを直接叩いて、アプリのピッチ検出に通している)。
 */
export function pluckSamples(sampleRate, midi, lenSec = LEN_SEC) {
    const f = freqOf(midi);
    // 平均を取る分だけ遅延が半サンプル伸びるので、その手前を整数長にする
    const n = Math.max(2, Math.round(sampleRate / f - 0.5));
    const period = n + 0.5;
    const len = Math.ceil(lenSec * sampleRate);
    const d = new Float32Array(len);
    const damp = Math.pow(0.001, 1 / (f * DECAY_SEC));
    const rnd = lcg(midi);
    const harmonics = Math.max(1, Math.min(14, Math.floor(period / 2)));
    let peak = 0;
    for (let h = 1; h <= harmonics; h++) {
        const amp = 1 / Math.pow(h, 1.2);
        const phase = rnd() * Math.PI * 2;
        for (let i = 0; i <= n; i++)
            d[i] += amp * Math.sin((2 * Math.PI * h * i) / period + phase);
    }
    for (let i = 0; i <= n; i++)
        peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0)
        for (let i = 0; i <= n; i++)
            d[i] /= peak;
    for (let i = n + 1; i < len; i++)
        d[i] = (d[i - n] + d[i - n - 1]) * 0.5 * damp;
    // 弾いた頭のプツッという音を丸める
    const atk = Math.max(1, Math.round(sampleRate * 0.002));
    for (let i = 0; i < atk; i++)
        d[i] *= i / atk;
    return d;
}
function render(ctx, midi) {
    const buf = ctx.createBuffer(1, Math.ceil(LEN_SEC * ctx.sampleRate), ctx.sampleRate);
    buf.getChannelData(0).set(pluckSamples(ctx.sampleRate, midi));
    return buf;
}
/** ミュート (チャッ) の音。高さを持たないので1つ焼けば足りる */
function renderMute(ctx) {
    const sr = ctx.sampleRate;
    const len = Math.ceil(0.09 * sr);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
        lp += (Math.random() * 2 - 1 - lp) * 0.35;
        d[i] = lp * Math.pow(1 - i / len, 3);
    }
    return buf;
}
export class Pluck {
    ctx;
    cache = new Map();
    mute = null;
    out;
    constructor(ctx, volume) {
        this.ctx = ctx;
        this.out = ctx.createGain();
        this.out.gain.value = volume;
        this.out.connect(ctx.destination);
    }
    buf(midi) {
        let b = this.cache.get(midi);
        if (!b) {
            b = render(this.ctx, midi);
            this.cache.set(midi, b);
        }
        return b;
    }
    fire(t, buf, gain) {
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.value = gain;
        s.connect(g);
        g.connect(this.out);
        s.start(t);
    }
    /**
     * コードを1回弾く。
     * ダウンは4弦から1弦へ、アップは1弦から4弦へ、少しずつずらしてなでる。
     * ずらさないと和音が一度に出て、ウクレレというより鍵盤の音になる
     */
    strum(t, midi, dir) {
        if (dir === 'x') {
            if (!this.mute)
                this.mute = renderMute(this.ctx);
            this.fire(t, this.mute, 1);
            return;
        }
        if (midi.length < 4)
            return;
        const down = dir === 'D';
        const spread = down ? SPREAD_DOWN : SPREAD_UP;
        const order = down ? [0, 1, 2, 3] : [3, 2, 1, 0];
        order.forEach((s, k) => {
            // アップは弦をなで切らないことが多いので、低い弦ほど弱くする
            const gain = down ? 1 : 0.55 + 0.15 * k;
            this.fire(t + k * spread, this.buf(midi[s]), gain * 0.9);
        });
    }
    dispose() {
        this.out.disconnect();
        this.cache.clear();
        this.mute = null;
    }
}
