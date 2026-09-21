/**
 * 音の入力・メトロノーム・解析・採点を持つエンジン。
 *
 * React に依存しない。理由は2つ:
 *  - 解析は requestAnimationFrame 1フレームごとに走るので、React の再レンダリングに乗せられない
 *  - 時刻はすべて AudioContext.currentTime 基準で、React のレンダリング周期とは無関係
 * UI へは「拍やコードが変わった」「1コードぶんの採点が出た」といった粒度のイベントで伝え、
 * 毎フレームの値 (レベルメーター、クロマ、押さえ方の光り方) だけ onFrame で直接渡す。
 */
import { CHORDS, OPEN, TEMPL } from '../core/chords';
import { computeChroma, scoreChords } from '../core/chroma';
import type { SegmentResult, Settings, SourceKind } from '../core/types';

const COUNT_IN = 4;
/** オンセット検出に使う帯域。クリック音 (2000/2600Hz) を避けてある */
const ONSET_LO_HZ = 240;
const ONSET_HI_HZ = 1300;

export type SourceState = { source: SourceKind; message: string | null; warn: boolean };

export type TickInfo = {
  phase: string;
  chord: string;
  next: string;
  /** 小節内の拍 (0始まり)。カウントイン中は -1 */
  beat: number;
};

export type FrameInfo = {
  /** 入力レベル 0..1 */
  level: number;
  /** 平滑化したクロマ (長さ12)。毎フレーム上書きされるので保持しないこと */
  live: Float32Array;
  liveMax: number;
  quiet: boolean;
  /** いちばん近いコード。判定できないときは null */
  heard: string | null;
};

export type OnsetInfo = { ms: number; isChange: boolean };

type EventMap = {
  source: SourceState;
  /** マイク接続時に推定した遅延補正 (ms) */
  calib: number;
  running: boolean;
  tick: TickInfo;
  onset: OnsetInfo;
  result: SegmentResult;
  end: SegmentResult[];
};

type Plan = { chord: string; late: number; mute: number };

type Run = {
  t0: number;
  beatDur: number;
  segDur: number;
  endSeg: number | null;
  endK: number | null;
  nextK: number;
  beatHits: Map<number, number>;
  acc: Map<number, { sum: Float32Array; n: number }>;
  finalized: number;
  results: SegmentResult[];
  plans: Record<number, Plan>;
  timer: ReturnType<typeof setInterval>;
};

export class TrainerEngine {
  private settings: Settings;
  private listeners = new Map<keyof EventMap, Set<(p: never) => void>>();
  private frameListeners = new Set<(f: FrameInfo) => void>();

  private ctx: AudioContext | null = null;
  private inputBus!: GainNode;
  private synthBus!: GainNode;
  private aBig!: AnalyserNode;
  private aSmall!: AnalyserNode;
  private bigDb!: Float32Array<ArrayBuffer>;
  private smallDb!: Float32Array<ArrayBuffer>;
  private sPrev!: Float32Array<ArrayBuffer>;
  private tdBuf!: Float32Array<ArrayBuffer>;
  private sLo = 0;
  private sHi = 0;
  private rafId = 0;

  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private activeVoices: GainNode[] = [];

  source: SourceKind = 'none';
  private run: Run | null = null;

  private frameCh = new Float32Array(12);
  private live = new Float32Array(12);
  private fluxAvg = 0;
  private lastOnset = -1;
  private lastTickKey = '';
  /** 押さえ方の図を光らせる対象。練習中は現在のコード、停止中は表示中のコード */
  private displayChord: string | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  // ---------- events ----------
  on<K extends keyof EventMap>(name: K, fn: (p: EventMap[K]) => void): () => void {
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    const held = fn as (p: never) => void;
    set.add(held);
    return () => {
      set.delete(held);
    };
  }

  private emit<K extends keyof EventMap>(name: K, payload: EventMap[K]): void {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const fn of set) (fn as (p: EventMap[K]) => void)(payload);
  }

  /** 毎フレーム呼ばれる。React の state には載せず、DOM を直接書き換える用 */
  onFrame(fn: (f: FrameInfo) => void): () => void {
    this.frameListeners.add(fn);
    return () => {
      this.frameListeners.delete(fn);
    };
  }

  setSettings(s: Settings): void {
    this.settings = s;
    if (!this.run) this.displayChord = s.prog[0] ?? null;
  }

  get isRunning(): boolean {
    return this.run !== null;
  }

  // ---------- audio graph ----------
  private ensureCtx(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.inputBus = ctx.createGain();
    this.synthBus = ctx.createGain();
    // 大きい FFT はコード判定用。C4 (約262Hz) と隣の半音の差 15Hz を分けるために 16384 必要
    this.aBig = ctx.createAnalyser();
    this.aBig.fftSize = 16384;
    this.aBig.smoothingTimeConstant = 0;
    // 小さい FFT はストローク検出用。時間分解能を優先する
    this.aSmall = ctx.createAnalyser();
    this.aSmall.fftSize = 1024;
    this.aSmall.smoothingTimeConstant = 0;
    // Analyser は接続先がないと動かないブラウザがあるので、無音の sink につなぐ
    const sink = ctx.createGain();
    sink.gain.value = 0;
    this.inputBus.connect(this.aBig);
    this.inputBus.connect(this.aSmall);
    this.aBig.connect(sink);
    this.aSmall.connect(sink);
    sink.connect(ctx.destination);
    this.synthBus.connect(this.inputBus);
    this.synthBus.connect(ctx.destination);

    this.bigDb = new Float32Array(this.aBig.frequencyBinCount);
    this.smallDb = new Float32Array(this.aSmall.frequencyBinCount);
    this.sPrev = new Float32Array(this.aSmall.frequencyBinCount);
    this.tdBuf = new Float32Array(this.aSmall.fftSize);
    const hz = ctx.sampleRate / this.aSmall.fftSize;
    this.sLo = Math.max(1, Math.floor(ONSET_LO_HZ / hz));
    this.sHi = Math.ceil(ONSET_HI_HZ / hz);
    this.rafId = requestAnimationFrame(this.loop);
  }

  private dropMic(): void {
    if (this.micNode) {
      try {
        this.micNode.disconnect();
      } catch {
        // すでに切れている
      }
      this.micNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
  }

  async useMic(): Promise<void> {
    if (this.run) return;
    this.ensureCtx();
    const ctx = this.ctx!;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.source = 'none';
      this.emitSource('この画面ではマイクが使えません。localhost か GitHub Pages など HTTPS で開くと使えます。テスト音ならこのまま試せます。', true);
      return;
    }
    try {
      // 3つとも false にしないと、楽器の音が加工されて検出が壊れる
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.micNode = ctx.createMediaStreamSource(this.micStream);
      this.micNode.connect(this.inputBus);
      this.source = 'mic';
      if (this.settings.calibMs == null) {
        const tr = this.micStream.getAudioTracks()[0];
        const inLat = (tr?.getSettings() as { latency?: number } | undefined)?.latency ?? 0.01;
        const est = ((ctx.outputLatency || 0) + (ctx.baseLatency || 0) + inLat + 0.03) * 1000;
        this.emit('calib', Math.min(300, Math.max(0, Math.round(est / 5) * 5)));
      }
      this.emitSource('マイクにつながりました。ウクレレを鳴らすと下のグラフが動きます。', false);
    } catch (err) {
      this.dropMic();
      this.source = 'none';
      const name = err instanceof Error ? err.name : 'error';
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      this.emitSource(
        denied
          ? 'マイクが許可されませんでした。ブラウザの設定でこのサイトのマイクを許可してください。テスト音ならこのまま試せます。'
          : `マイクを開けませんでした (${name})。テスト音ならこのまま試せます。`,
        true,
      );
    }
  }

  useSynth(): void {
    if (this.run) return;
    this.ensureCtx();
    this.dropMic();
    this.source = 'synth';
    this.emitSource('テスト音は自動で演奏します。わざとズレ、ミュート、押さえ間違いを混ぜるので、採点の動きを確認できます。', false);
  }

  private emitSource(message: string | null, warn: boolean): void {
    this.emit('source', { source: this.source, message, warn });
  }

  // ---------- synth ----------
  private damp(t: number): void {
    for (const g of this.activeVoices) {
      try {
        if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(t);
        else g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.012);
      } catch {
        // 停止済みのノード
      }
    }
    this.activeVoices = [];
  }

  private pluck(midi: number, t: number, vel: number): void {
    const ctx = this.ctx!;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 1.3);
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(this.synthBus);
    o.start(t);
    o2.start(t);
    o.stop(t + 1.4);
    o2.stop(t + 1.4);
    this.activeVoices.push(g);
  }

  /** mute に弦番号を渡すと、その弦だけ鳴らさない (ミュートの再現) */
  private strum(name: string, t: number, mute: number): void {
    const ctx = this.ctx;
    if (!ctx || !CHORDS[name]) return;
    t = Math.max(t, ctx.currentTime + 0.005);
    this.damp(t);
    CHORDS[name].forEach((f, i) => {
      if (i !== mute) this.pluck(OPEN[i] + f, t + i * 0.012, 0.2);
    });
  }

  /** 「この音を鳴らす」ボタン用 */
  playCurrentChord(): void {
    if (!this.ctx || this.source !== 'synth' || this.run || !this.displayChord) return;
    this.strum(this.displayChord, this.ctx.currentTime + 0.02, -1);
  }

  // ---------- metronome ----------
  private click(t: number, accent: boolean): void {
    const ctx = this.ctx!;
    // 解析帯域 (240〜1300Hz) の外に置いて、マイクへの回り込みを検出しないようにする
    const o = ctx.createOscillator();
    o.frequency.value = accent ? 2600 : 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.28, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.07);
  }

  /** テスト音モードで、わざとズレ・ミュート・押さえ間違いを混ぜる */
  private planFor(s: number): Plan {
    const run = this.run!;
    if (run.plans[s]) return run.plans[s];
    const r = Math.random;
    const prog = this.settings.prog;
    const wrong = s > 0 && prog.length > 1 && r() < 0.08;
    const p: Plan = {
      chord: wrong ? prog[(s - 1) % prog.length] : prog[s % prog.length],
      late: r() < 0.35 ? 0.04 + r() * 0.09 : 0,
      mute: r() < 0.2 ? Math.floor(r() * 4) : -1,
    };
    return (run.plans[s] = p);
  }

  private scheduler = (): void => {
    const run = this.run;
    const ctx = this.ctx;
    if (!run || !ctx) return;
    const { bpc, clickOn } = this.settings;
    const horizon = ctx.currentTime + 0.15;
    while (run.nextK * run.beatDur + run.t0 < horizon) {
      const k = run.nextK;
      const t = run.t0 + k * run.beatDur;
      if (run.endK == null || k < run.endK) {
        if (clickOn) this.click(t, k >= 0 ? k % bpc === 0 : k === -COUNT_IN);
        if (this.source === 'synth' && k >= 0) {
          const p = this.planFor(Math.floor(k / bpc));
          this.strum(p.chord, t + (Math.random() - 0.5) * 0.04 + (k % bpc === 0 ? p.late : 0), p.mute);
        }
      }
      run.nextK++;
    }
  };

  // ---------- analysis ----------
  private calibSec(): number {
    return this.source === 'mic' ? (this.settings.calibMs || 0) / 1000 : 0.02;
  }

  /** スペクトルフラックスでストロークの立ち上がりを拾う */
  private detectOnset(now: number): void {
    this.aSmall.getFloatFrequencyData(this.smallDb);
    let flux = 0;
    for (let i = this.sLo; i <= this.sHi; i++) {
      const m = Math.pow(10, Math.max(this.smallDb[i], -120) / 20);
      const d = m - this.sPrev[i];
      if (d > 0) flux += d;
      this.sPrev[i] = m;
    }
    const gate = 0.03 * Math.pow(0.6, this.settings.sens - 3);
    const thr = this.fluxAvg * 2.2 + gate;
    this.fluxAvg += 0.06 * (Math.min(flux, thr * 2) - this.fluxAvg);
    // 不応期 110ms。1回のストロークを何度も数えないため
    if (flux > thr && now - this.lastOnset > 0.11) {
      this.lastOnset = now;
      const run = this.run;
      if (run) {
        const tA = now - 0.012 - this.calibSec();
        const k = Math.round((tA - run.t0) / run.beatDur);
        const off = tA - (run.t0 + k * run.beatDur);
        // 拍の ±30% (最大250ms) より外は裏拍とみなして無視する
        if (k >= 0 && (run.endK == null || k < run.endK) && Math.abs(off) < Math.min(0.3 * run.beatDur, 0.25)) {
          const prev = run.beatHits.get(k);
          if (prev == null || Math.abs(off) < Math.abs(prev)) run.beatHits.set(k, off);
          this.emit('onset', { ms: off * 1000, isChange: k % this.settings.bpc === 0 });
        }
      }
    }
  }

  private inputLevel(): number {
    this.aSmall.getFloatTimeDomainData(this.tdBuf);
    let s = 0;
    for (let i = 0; i < this.tdBuf.length; i++) s += this.tdBuf[i] * this.tdBuf[i];
    const db = 10 * Math.log10(s / this.tdBuf.length + 1e-12);
    return Math.min(1, Math.max(0, (db + 70) / 60));
  }

  // ---------- drill ----------
  start(): boolean {
    if (this.source === 'none') {
      this.emitSource('先に「マイクを使う」か「テスト音で試す」を選んでください。', true);
      return false;
    }
    this.ensureCtx();
    const ctx = this.ctx!;
    const { bpm, bpc, sessionSec } = this.settings;
    const beatDur = 60 / bpm;
    const segDur = beatDur * bpc;
    const nSeg = sessionSec ? Math.max(1, Math.round(sessionSec / segDur)) : null;
    this.run = {
      t0: ctx.currentTime + 0.2 + COUNT_IN * beatDur,
      beatDur,
      segDur,
      endSeg: nSeg,
      endK: nSeg ? nSeg * bpc : null,
      nextK: -COUNT_IN,
      beatHits: new Map(),
      acc: new Map(),
      finalized: 0,
      results: [],
      plans: {},
      timer: setInterval(this.scheduler, 25),
    };
    this.lastTickKey = '';
    this.scheduler();
    this.emit('running', true);
    return true;
  }

  stop(byUser: boolean): void {
    const run = this.run;
    const ctx = this.ctx;
    if (!run || !ctx) return;
    clearInterval(run.timer);
    const tA = ctx.currentTime - this.calibSec();
    const s = Math.floor((tA - run.t0) / run.segDur);
    // 手で止めたときは、そのコードを6割以上弾いていれば採点に入れる
    if (byUser && s >= 0 && tA - run.t0 - s * run.segDur > 0.6 * run.segDur) this.finalizeUpTo(s + 1);
    else this.finalizeUpTo(s);
    this.damp(ctx.currentTime);
    const results = run.results;
    this.run = null;
    this.displayChord = this.settings.prog[0] ?? null;
    this.emit('running', false);
    this.emit('end', results);
  }

  private finalizeUpTo(sEnd: number): void {
    const run = this.run!;
    while (run.finalized < sEnd && (run.endSeg == null || run.finalized < run.endSeg)) {
      this.finalizeSegment(run.finalized++);
    }
  }

  private finalizeSegment(s: number): void {
    const run = this.run!;
    const { prog, bpc } = this.settings;
    const chord = prog[s % prog.length];
    const t = TEMPL[chord];
    const off = run.beatHits.get(s * bpc);
    const a = run.acc.get(s);
    const r: SegmentResult = { s, chord, off: off == null ? null : off, heard: false, ok: false, best: null, weak: [] };
    if (a && a.n >= 3) {
      const sc = scoreChords(a.sum);
      if (sc) {
        r.heard = true;
        r.best = sc.best;
        // 僅差なら狙ったコードとして通す
        r.ok = sc.best === chord || sc.scores[chord] >= sc.bestScore - 0.04;
        let mx = 0;
        for (const pc of t.pcs) mx = Math.max(mx, a.sum[pc]);
        if (r.ok && mx > 0) r.weak = t.pcs.filter((pc) => a.sum[pc] / mx < 0.16);
      }
    }
    run.results.push(r);
    run.acc.delete(s);
    this.emit('result', r);
  }

  // ---------- main loop ----------
  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const ctx = this.ctx;
    if (!ctx || this.source === 'none') return;
    const now = ctx.currentTime;
    this.detectOnset(now);

    this.aBig.getFloatFrequencyData(this.bigDb);
    const binHz = ctx.sampleRate / this.aBig.fftSize;
    const maxDb = computeChroma(this.bigDb, binHz, this.frameCh);
    for (let i = 0; i < 12; i++) this.live[i] += 0.35 * (this.frameCh[i] - this.live[i]);
    this.emitFrame(maxDb);

    const run = this.run;
    if (!run) return;
    const { bpc, prog } = this.settings;
    const tA = now - this.calibSec();
    const k = Math.floor((now - run.t0) / run.beatDur);
    if (k < 0) {
      this.pushTick(prog[0], prog[1 % prog.length], `カウント ${-k}`, -1);
    } else {
      const s = Math.floor(k / bpc);
      const left = run.endSeg ? Math.max(0, run.endSeg * run.segDur - (now - run.t0)) : null;
      const phase =
        left == null
          ? `${s + 1} コード目`
          : `残り ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      this.pushTick(prog[s % prog.length], prog[(s + 1) % prog.length], phase, k % bpc);
    }

    // 解析は補正後の時刻で区切る
    const sA = Math.floor((tA - run.t0) / run.segDur);
    if (sA >= 0 && (run.endSeg == null || sA < run.endSeg) && maxDb > -76) {
      const local = tA - run.t0 - sA * run.segDur;
      // 前のコードの残響と FFT 窓 (約340ms) を避けてから集計を始める
      const guard = run.segDur >= 1.0 ? 0.32 : 0.18;
      if (local >= guard && local <= run.segDur - 0.03) {
        let a = run.acc.get(sA);
        if (!a) {
          a = { sum: new Float32Array(12), n: 0 };
          run.acc.set(sA, a);
        }
        for (let i = 0; i < 12; i++) a.sum[i] += this.frameCh[i];
        a.n++;
      }
    }
    if (sA > run.finalized) this.finalizeUpTo(sA);
    if (run.endSeg != null && tA >= run.t0 + run.endSeg * run.segDur + 0.05) this.stop(false);
  };

  private pushTick(chord: string, next: string, phase: string, beat: number): void {
    this.displayChord = chord;
    const key = `${chord}|${next}|${phase}|${beat}`;
    if (key === this.lastTickKey) return;
    this.lastTickKey = key;
    this.emit('tick', { chord, next, phase, beat });
  }

  private emitFrame(maxDb: number): void {
    if (!this.frameListeners.size) return;
    let mx = 1e-9;
    for (let i = 0; i < 12; i++) if (this.live[i] > mx) mx = this.live[i];
    const quiet = maxDb < -76 && mx < 1e-4;
    let heard: string | null = null;
    if (!quiet && maxDb > -72) {
      const sc = scoreChords(this.live);
      if (sc && sc.bestScore > 0.62) heard = sc.best;
    }
    const f: FrameInfo = { level: this.inputLevel(), live: this.live, liveMax: mx, quiet, heard };
    for (const fn of this.frameListeners) fn(f);
  }

  dispose(): void {
    if (this.run) {
      clearInterval(this.run.timer);
      this.run = null;
    }
    cancelAnimationFrame(this.rafId);
    this.dropMic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
