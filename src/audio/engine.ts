/**
 * 音の入力・メトロノーム・解析・採点を持つエンジン。
 *
 * React に依存しない。理由は2つ:
 *  - 解析は requestAnimationFrame 1フレームごとに走るので、React の再レンダリングに乗せられない
 *  - 時刻はすべて AudioContext.currentTime 基準で、React のレンダリング周期とは無関係
 * UI へは「拍やコードが変わった」「1コードぶんの採点が出た」といった粒度のイベントで伝え、
 * 毎フレームの値 (レベルメーター、クロマ、押さえ方の光り方) だけ onFrame で直接渡す。
 */
import { TEMPL } from '../core/chords';
import { computeChroma, scoreChords } from '../core/chroma';
import {
  firstHitBeat,
  hitsBefore,
  isSlotStart,
  matchStroke,
  placeSlot,
  slotIndexAt,
  type PlanEnd,
  type Timeline,
} from '../core/timeline';
import type { RhythmTally, SegmentResult, SessionResult, Settings, SourceKind, TickInfo } from '../core/types';

export const COUNT_IN = 4;
/** オンセット検出に使う帯域。クリック音 (2000/2600Hz) を避けてある */
const ONSET_LO_HZ = 240;
const ONSET_HI_HZ = 1300;

const MIC_OK = 'マイクにつながりました。ウクレレを鳴らすと下のグラフが動きます。';

/**
 * 1コードぶんの音を聞く長さ (秒)。
 * 区間の終わりまで足し込むと、採点が出るのが「次のコードを鳴らす瞬間」になって
 * いちばん邪魔なところに割り込む。鳴らした直後がいちばん音が大きいので、
 * ここで窓を閉じてコードの途中で返す。
 */
const LISTEN_SEC = 1.0;

export type SourceState = { source: SourceKind; message: string | null; warn: boolean };

/**
 * 1回ぶんの練習の段取り。何をどの速さで、どこまでやるか。
 * 進行の繰り返しか楽譜かは Timeline が持っているので、エンジンは区別しない
 */
export type Plan = {
  tl: Timeline;
  bpm: number;
  /** 終わり。null は「止めるまで」 */
  end: PlanEnd | null;
  /**
   * コードまで採点するか。false だとクロマ用の大きい FFT を回さず、
   * ストロークのタイミングだけを見る (速い曲では窓が足りないので、そもそも判定できない)
   */
  chordJudge: boolean;
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
  /**
   * 練習の現在位置 (拍単位・小数)。カウントイン中は負、止まっているときは null。
   * 拍のバーを毎フレーム滑らかに動かすために渡す。
   */
  pos: number | null;
};

export type OnsetInfo = {
  ms: number;
  isChange: boolean;
  /** どの打点にも寄らなかったストローク。楽譜がストロークを指定しているときだけ立つ */
  extra?: boolean;
};

type EventMap = {
  source: SourceState;
  /** マイク接続時に推定した遅延補正 (ms) */
  calib: number;
  running: boolean;
  tick: TickInfo;
  onset: OnsetInfo;
  result: SegmentResult;
  end: SessionResult;
};

type Run = {
  plan: Plan;
  t0: number;
  beatDur: number;
  nextK: number;
  /** 拾えたストロークのズレ。キーは合わせにいった拍 (打点があればその位置) */
  offs: Map<number, number>;
  /** 同じ位置の音の強さ */
  levels: Map<number, number>;
  /** どの打点にも寄らなかったストロークの数 */
  extra: number;
  acc: Map<number, { sum: Float32Array; n: number }>;
  finalized: number;
  results: SegmentResult[];
  timer: ReturnType<typeof setInterval>;
};

export class TrainerEngine {
  private settings: Settings;
  private listeners = new Map<keyof EventMap, Set<(p: never) => void>>();
  private frameListeners = new Set<(f: FrameInfo) => void>();

  private ctx: AudioContext | null = null;
  private inputBus!: GainNode;
  private aBig!: AnalyserNode;
  private aSmall!: AnalyserNode;
  private bigDb!: Float32Array<ArrayBuffer>;
  private smallDb!: Float32Array<ArrayBuffer>;
  private sPrev!: Float32Array<ArrayBuffer>;
  private tdBuf!: Float32Array<ArrayBuffer>;
  private sLo = 0;
  private sHi = 0;
  private rafId = 0;
  private detachResume: (() => void) | null = null;

  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;

  source: SourceKind = 'none';
  private run: Run | null = null;

  private frameCh = new Float32Array(12);
  private live = new Float32Array(12);
  private fluxAvg = 0;
  private lastOnset = -1;
  private lastTickKey = '';

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

    this.bigDb = new Float32Array(this.aBig.frequencyBinCount);
    this.smallDb = new Float32Array(this.aSmall.frequencyBinCount);
    this.sPrev = new Float32Array(this.aSmall.frequencyBinCount);
    this.tdBuf = new Float32Array(this.aSmall.fftSize);
    const hz = ctx.sampleRate / this.aSmall.fftSize;
    this.sLo = Math.max(1, Math.floor(ONSET_LO_HZ / hz));
    this.sHi = Math.ceil(ONSET_HI_HZ / hz);
    this.rafId = requestAnimationFrame(this.loop);
    this.armResume();
  }

  /**
   * ブラウザの自動再生制限で、AudioContext は suspended のまま作られることがある。
   * その場合は解析が進まないので、最初の操作で resume する。
   */
  private armResume(): void {
    const onGesture = (): void => {
      const ctx = this.ctx;
      if (!ctx) return;
      void ctx.resume().then(() => {
        if (ctx.state !== 'running') return;
        this.detachResume?.();
        if (this.source === 'mic') this.emitSource(MIC_OK, false);
      });
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    this.detachResume = () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      this.detachResume = null;
    };
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

  private micPending: Promise<void> | null = null;
  /** dispose をまたいだ非同期処理を捨てるための世代番号 */
  private generation = 0;

  /** 開いた直後に自動で呼ばれる。拒否されたあとは再試行ボタンから呼ばれる */
  async useMic(): Promise<void> {
    if (this.run || this.source === 'mic') return;
    if (this.micPending) return this.micPending;
    this.micPending = this.connectMic().finally(() => {
      this.micPending = null;
    });
    return this.micPending;
  }

  private async connectMic(): Promise<void> {
    const gen = this.generation;
    this.ensureCtx();
    const ctx = this.ctx!;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.source = 'none';
      this.emitSource('この画面ではマイクが使えません。HTTPS か localhost で開いてください。', true);
      return;
    }
    try {
      // 3つとも false にしないと、楽器の音が加工されて検出が壊れる
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      // 許可を待つ間に dispose されていたら、掴んだストリームは捨てる
      if (gen !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.micStream = stream;
      this.micNode = ctx.createMediaStreamSource(this.micStream);
      this.micNode.connect(this.inputBus);
      this.source = 'mic';
      if (this.settings.calibMs == null) {
        const tr = this.micStream.getAudioTracks()[0];
        const inLat = (tr?.getSettings() as { latency?: number } | undefined)?.latency ?? 0.01;
        const est = ((ctx.outputLatency || 0) + (ctx.baseLatency || 0) + inLat + 0.03) * 1000;
        this.emit('calib', Math.min(300, Math.max(0, Math.round(est / 5) * 5)));
      }
      this.emitSource(ctx.state === 'running' ? MIC_OK : `${MIC_OK} 画面を一度タップすると動き始めます。`, false);
    } catch (err) {
      if (gen !== this.generation) return;
      this.dropMic();
      this.source = 'none';
      const name = err instanceof Error ? err.name : 'error';
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      this.emitSource(
        denied
          ? 'マイクが許可されませんでした。ブラウザのアドレスバーの鍵アイコンから、このサイトのマイクを許可してください。'
          : `マイクを開けませんでした (${name})。`,
        true,
      );
    }
  }

  private emitSource(message: string | null, warn: boolean): void {
    this.emit('source', { source: this.source, message, warn });
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

  private scheduler = (): void => {
    const run = this.run;
    const ctx = this.ctx;
    if (!run || !ctx) return;
    const { barBeats } = run.plan.tl;
    const endBeat = run.plan.end?.beat ?? null;
    const horizon = ctx.currentTime + 0.15;
    while (run.nextK * run.beatDur + run.t0 < horizon) {
      const k = run.nextK;
      const t = run.t0 + k * run.beatDur;
      if (endBeat == null || k < endBeat) {
        if (this.settings.clickOn) this.click(t, k >= 0 ? k % barBeats === 0 : k === -COUNT_IN);
      }
      run.nextK++;
    }
  };

  // ---------- analysis ----------
  private calibSec(): number {
    return (this.settings.calibMs || 0) / 1000;
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
    // 不応期 110ms。1回のストロークを何度も数えないため。
    // ここが16分音符の上限でもある (110ms = 135BPM の16分)
    if (flux > thr && now - this.lastOnset > 0.11) {
      this.lastOnset = now;
      if (this.run) this.matchOnset(this.run, now - 0.012 - this.calibSec());
    }
  }

  /**
   * 拾ったストロークを、合わせにいくべき位置に結びつける。
   * 楽譜がストロークを指定していれば打点に、していなければ拍にスナップする
   */
  private matchOnset(run: Run, tA: number): void {
    const { tl, end } = run.plan;
    const beat = (tA - run.t0) / run.beatDur;
    const m = matchStroke(tl, beat, run.beatDur, end?.beat ?? null);
    if (m.kind === 'none') return;
    if (m.kind === 'extra') {
      run.extra++;
      this.emit('onset', { ms: m.off * 1000, isChange: false, extra: true });
      return;
    }
    const prev = run.offs.get(m.at);
    if (prev == null || Math.abs(m.off) < Math.abs(prev)) {
      run.offs.set(m.at, m.off);
      run.levels.set(m.at, this.inputLevel());
    }
    this.emit('onset', { ms: m.off * 1000, isChange: isSlotStart(tl, m.at) });
  }

  private inputLevel(): number {
    this.aSmall.getFloatTimeDomainData(this.tdBuf);
    let s = 0;
    for (let i = 0; i < this.tdBuf.length; i++) s += this.tdBuf[i] * this.tdBuf[i];
    const db = 10 * Math.log10(s / this.tdBuf.length + 1e-12);
    return Math.min(1, Math.max(0, (db + 70) / 60));
  }

  // ---------- drill ----------
  start(plan: Plan): boolean {
    if (this.source === 'none') {
      this.emitSource('先にマイクを許可してください。', true);
      return false;
    }
    this.ensureCtx();
    const ctx = this.ctx!;
    const beatDur = 60 / plan.bpm;
    this.run = {
      plan,
      t0: ctx.currentTime + 0.2 + COUNT_IN * beatDur,
      beatDur,
      nextK: -COUNT_IN,
      offs: new Map(),
      levels: new Map(),
      extra: 0,
      acc: new Map(),
      finalized: 0,
      results: [],
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
    const beatA = (ctx.currentTime - this.calibSec() - run.t0) / run.beatDur;
    const s = slotIndexAt(run.plan.tl, beatA);
    const p = s >= 0 ? placeSlot(run.plan.tl, s) : null;
    // 手で止めたときは、そのコードを6割以上弾いていれば採点に入れる
    if (byUser && p && beatA - p.startBeat > 0.6 * p.beats) this.finalizeUpTo(s + 1);
    else this.finalizeUpTo(s);
    const payload: SessionResult = {
      results: run.results,
      rhythm: this.tally(run, beatA),
      chordJudged: run.plan.chordJudge,
    };
    this.run = null;
    this.emit('running', false);
    this.emit('end', payload);
  }

  /** ストロークの集計。打点が決まっている曲でだけ出す */
  private tally(run: Run, stopBeat: number): RhythmTally | null {
    const { tl, end } = run.plan;
    if (!tl.hits.length) return null;
    const until = Math.max(0, end ? Math.min(end.beat, stopBeat) : stopBeat);
    const offsets: number[] = [];
    const levels: number[] = [];
    for (const [at, off] of run.offs) {
      if (at >= until) continue;
      offsets.push(off * 1000);
      const lv = run.levels.get(at);
      if (lv != null) levels.push(lv);
    }
    return { expected: hitsBefore(tl, until), played: offsets.length, extra: run.extra, offsets, levels };
  }

  private finalizeUpTo(sEnd: number): void {
    const run = this.run!;
    const cap = run.plan.end?.slots ?? Infinity;
    while (run.finalized < sEnd && run.finalized < cap) {
      this.finalizeSegment(run.finalized++);
    }
  }

  private finalizeSegment(s: number): void {
    const run = this.run!;
    const slot = placeSlot(run.plan.tl, s);
    if (!slot) return;
    const chord = slot.chord;
    const t = TEMPL[chord];
    // ストロークが決まっている曲では、コードが変わる拍が休符のことがある。
    // そのときはコードの中で最初に鳴らす位置で、チェンジのタイミングを測る
    const at = firstHitBeat(run.plan.tl, slot);
    const off = at == null ? undefined : run.offs.get(at);
    const a = run.acc.get(s);
    const r: SegmentResult = { s, chord, off: off == null ? null : off, heard: false, ok: false, best: null, weak: [] };
    if (run.plan.chordJudge && a && a.n >= 3) {
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

    // コードを見ない曲では、重い FFT (窓340ms) ごと回さない
    const run = this.run;
    const judging = !run || run.plan.chordJudge;
    let maxDb = -200;
    if (judging) {
      this.aBig.getFloatFrequencyData(this.bigDb);
      const binHz = ctx.sampleRate / this.aBig.fftSize;
      maxDb = computeChroma(this.bigDb, binHz, this.frameCh);
      for (let i = 0; i < 12; i++) this.live[i] += 0.35 * (this.frameCh[i] - this.live[i]);
    }
    this.emitFrame(judging, maxDb, run ? (now - run.t0) / run.beatDur : null);
    if (!run) return;
    const { tl, end } = run.plan;
    const tA = now - this.calibSec();
    const beat = (now - run.t0) / run.beatDur;
    this.pushTick({
      beat,
      slot: slotIndexAt(tl, beat),
      leftSec: end ? Math.max(0, (end.beat - beat) * run.beatDur) : null,
    });

    // 解析は補正後の時刻で区切る
    const beatA = (tA - run.t0) / run.beatDur;
    const sA = slotIndexAt(tl, beatA);
    const slot = sA >= 0 && (end == null || sA < end.slots) ? placeSlot(tl, sA) : null;
    if (slot) {
      const segDur = slot.beats * run.beatDur;
      const local = (beatA - slot.startBeat) * run.beatDur;
      // 前のコードの残響と FFT 窓 (約340ms) を避けてから集計を始める
      const guard = segDur >= 1.0 ? 0.32 : 0.18;
      const listenEnd = Math.min(segDur - 0.03, guard + LISTEN_SEC);
      if (maxDb > -76 && local >= guard && local <= listenEnd) {
        let a = run.acc.get(sA);
        if (!a) {
          a = { sum: new Float32Array(12), n: 0 };
          run.acc.set(sA, a);
        }
        for (let i = 0; i < 12; i++) a.sum[i] += this.frameCh[i];
        a.n++;
      }
      // 聞く窓が閉じたコードから順に確定させる。区間の終わりは待たない
      if (local >= listenEnd) this.finalizeUpTo(sA + 1);
      else if (sA > run.finalized) this.finalizeUpTo(sA);
    }
    if (end != null && tA >= run.t0 + end.beat * run.beatDur + 0.05) this.stop(false);
  };

  /** 拍の刻みは onFrame 側が持つ。ここは表示が変わる粒度 (拍と秒) でだけ流す */
  private pushTick(t: TickInfo): void {
    const key = `${Math.floor(t.beat)}|${t.leftSec == null ? '' : Math.ceil(t.leftSec)}`;
    if (key === this.lastTickKey) return;
    this.lastTickKey = key;
    this.emit('tick', t);
  }

  private emitFrame(judging: boolean, maxDb: number, pos: number | null): void {
    if (!this.frameListeners.size) return;
    let mx = 1e-9;
    for (let i = 0; i < 12; i++) if (this.live[i] > mx) mx = this.live[i];
    // クロマを取っていないあいだは、音名まわりの表示は伏せる
    const quiet = !judging || (maxDb < -76 && mx < 1e-4);
    let heard: string | null = null;
    if (judging && !quiet && maxDb > -72) {
      const sc = scoreChords(this.live);
      if (sc && sc.bestScore > 0.62) heard = sc.best;
    }
    const f: FrameInfo = { level: this.inputLevel(), live: this.live, liveMax: mx, quiet, heard, pos };
    for (const fn of this.frameListeners) fn(f);
  }

  dispose(): void {
    // React の StrictMode は開発時にマウントを2回走らせる。捨てたあと同じ
    // インスタンスが再利用されるので、次の useMic() がやり直せる状態まで戻す
    this.generation++;
    this.source = 'none';
    this.micPending = null;
    if (this.run) {
      clearInterval(this.run.timer);
      this.run = null;
    }
    cancelAnimationFrame(this.rafId);
    this.detachResume?.();
    this.dropMic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
