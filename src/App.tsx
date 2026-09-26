import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SourceState } from './audio/engine';
import { Controls } from './components/Controls';
import { HistoryPanel } from './components/HistoryPanel';
import { Progression } from './components/Progression';
import { MicStatus } from './components/MicStatus';
import { SettingsPage } from './components/SettingsPage';
import { SongPanel } from './components/SongPanel';
import { Stage, LANE_DOT_MAX, type LaneDot, type StageFeedback } from './components/Stage';
import { SummaryPanel } from './components/SummaryPanel';
import { Transport } from './components/Transport';
import { median } from './core/chroma';
import {
  cardVerdict,
  describeResult,
  phaseText,
  summarize,
  type CardVerdict,
  type SessionSummary,
} from './core/report';
import { scoreTimeline } from './core/score';
import { findSong } from './core/songs';
import { clearHistory, loadHistory, loadSettings, pushHistory, saveSettings } from './core/storage';
import { buildTimeline, canJudgeChords, placeSlot, planEnd, slotIndexAt } from './core/timeline';
import type { PracticeMode, Settings, TickInfo } from './core/types';
import { useEngine, useFrame } from './hooks/useEngine';
import { useHashView } from './hooks/useHashView';

/** 自動補正に使うには、これだけのチェンジが拾えている必要がある */
const AUTO_CALIB_MIN_SAMPLES = 6;

/** テンポのスライダーが出せる範囲。楽譜の bpm もここに収める */
const BPM_MIN = 40;
const BPM_MAX = 180;
const clampBpm = (v: number): number => Math.min(BPM_MAX, Math.max(BPM_MIN, v));

/** カードの採点を、何コードぶん遡って持っておくか */
const VERDICT_KEEP = 4;

let dotSeq = 0;

/** 設定ボタンの印。つまみの絵にしてある (中身はチューニングと調整) */
function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const engine = useEngine(settings);
  const [view, go] = useHashView();

  const [source, setSource] = useState<SourceState>({ source: 'none', message: null, warn: false });
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState<TickInfo | null>(null);
  const [dots, setDots] = useState<LaneDot[]>([]);
  const [feedback, setFeedback] = useState<StageFeedback | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [finished, setFinished] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [lastOffsets, setLastOffsets] = useState<number[]>([]);
  const [autoCalibDone, setAutoCalibDone] = useState(false);
  /** レーンのカードに出す採点。番号はタイムラインのスロット番号 */
  const [verdicts, setVerdicts] = useState<Map<number, CardVerdict>>(() => new Map());

  // 楽譜は songs/*.json で管理する。選ばれていなければ進行の練習に落としておく
  const score = useMemo(() => findSong(settings.songId)?.score ?? null, [settings.songId]);
  const mode: PracticeMode = settings.mode === 'score' && score ? 'score' : 'drill';

  // 画面はタイムライン上の「いまどのコードか」だけを見る。
  // 拍の細かい動きはレーンが onFrame から直接受け取る。
  const tl = useMemo(
    () => (mode === 'score' && score ? scoreTimeline(score) : buildTimeline(settings.prog, settings.bpc)),
    [mode, score, settings.prog, settings.bpc],
  );
  // 速い曲では、クロマ用の FFT の窓 (約340ms) が足りない。そのときはリズムだけ見る
  const chordJudge = canJudgeChords(tl, settings.bpm);
  // 練習の終わり。楽譜は回数で、進行は練習時間で決まる。位置バーの目盛りもここから
  const end = useMemo(() => planEnd(tl, settings.bpm, settings.sessionSec), [tl, settings.bpm, settings.sessionSec]);
  const [anchor, setAnchor] = useState(-1);
  const anchorRef = useRef(-1);
  // 位置バーが指すコード。カウントイン中は、これから入るコードを指しておく
  const [cursor, setCursor] = useState(-1);
  const cursorRef = useRef(-1);
  useFrame(engine, ({ pos, lead }) => {
    const i = pos == null ? -1 : slotIndexAt(tl, pos);
    if (i !== anchorRef.current) {
      anchorRef.current = i;
      setAnchor(i);
    }
    const c = pos == null ? -1 : slotIndexAt(tl, pos + (lead ?? 0));
    if (c !== cursorRef.current) {
      cursorRef.current = c;
      setCursor(c);
    }
  });

  const patch = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...p };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => engine.on('source', setSource), [engine]);
  // 開いたらすぐつなぐ。拒否されたら MicStatus に再試行ボタンが出る
  useEffect(() => {
    void engine.useMic();
  }, [engine]);
  useEffect(() => engine.on('running', setRunning), [engine]);
  useEffect(() => engine.on('paused', setPaused), [engine]);
  // 位置が飛んだら、その先のカードに残っている採点を消す。弾き直すぶんは、これからの結果で付け直す
  useEffect(
    () =>
      engine.on('seek', (s) =>
        setVerdicts((m) => new Map([...m].filter(([k]) => k < s))),
      ),
    [engine],
  );
  useEffect(() => engine.on('tick', setTick), [engine]);
  useEffect(() => engine.on('calib', (ms) => patch({ calibMs: ms })), [engine, patch]);
  useEffect(
    () =>
      engine.on('result', (r) => {
        setFeedback(describeResult(r, chordJudge));
        setVerdicts((m) => {
          const next = new Map(m);
          next.set(r.s, cardVerdict(r, chordJudge));
          // 画面から流れ去ったぶんは捨てる
          for (const k of next.keys()) if (k < r.s - VERDICT_KEEP) next.delete(k);
          return next;
        });
      }),
    [engine, chordJudge],
  );

  useEffect(
    () =>
      engine.on('onset', ({ ms, isChange, extra }) =>
        setDots((d) => [...d, { id: ++dotSeq, ms, big: isChange, extra }].slice(-LANE_DOT_MAX)),
      ),
    [engine],
  );

  // 記録に残すのは終了時点の設定。settings が変わるたび貼り直す
  useEffect(
    () =>
      engine.on('end', (session) => {
        const sum = summarize(session);
        setSummary(sum);
        setFinished(true);
        setTick(null);
        setLastOffsets(sum?.offsets ?? []);
        setAutoCalibDone(false);
        if (sum) {
          setHistory(
            pushHistory({
              ts: Date.now(),
              prog: mode === 'score' && score ? score.chords.join(' ') : settings.prog.join(' '),
              title: mode === 'score' && score ? score.title : undefined,
              bpm: settings.bpm,
              bpc: mode === 'score' && score ? score.beatsPerBar : settings.bpc,
              n: sum.total,
              okRate: sum.chordJudged ? sum.okRate : (sum.rhythm?.playRate ?? 0),
              rhythmOnly: sum.chordJudged ? undefined : true,
              meanAbs: sum.meanAbs == null ? null : Math.round(sum.meanAbs),
            }),
          );
        }
      }),
    [engine, settings, mode, score],
  );

  const onToggle = useCallback(() => {
    if (engine.isRunning) {
      engine.stop(true);
      return;
    }
    setDots([]);
    setVerdicts(new Map());
    setSummary(null);
    setFinished(false);
    if (engine.start({ tl, bpm: settings.bpm, end, chordJudge }))
      setFeedback({ timing: 'カウントインのあと、はじまります。', tone: null, chord: '' });
  }, [engine, tl, settings.bpm, end, chordJudge]);

  const onPause = useCallback(() => {
    if (engine.isPaused) engine.resume();
    else engine.pause();
  }, [engine]);

  // バーをつまんでいるあいだは止めておく。1目盛りごとにカウントインからやり直すと落ち着かない
  const scrubbing = useRef(false);
  const onScrubStart = useCallback(() => {
    if (!engine.isRunning || engine.isPaused) return;
    scrubbing.current = true;
    engine.pause();
  }, [engine]);
  const onScrubEnd = useCallback(() => {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    engine.resume();
  }, [engine]);

  // 練習画面だけ。設定画面では、見えないところで動いているものを触らせない
  useEffect(() => {
    if (view !== 'practice') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      // 入力やボタンに触っているあいだは、その部品の操作を優先する
      if ((e.target as HTMLElement | null)?.closest('input,textarea,select,button,[contenteditable],[role="dialog"]'))
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (engine.isRunning) onPause();
        else onToggle();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!engine.isRunning) return;
        e.preventDefault();
        engine.seek(e.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, view, onToggle, onPause]);

  const onAutoCalib = () => {
    if (lastOffsets.length < AUTO_CALIB_MIN_SAMPLES) return;
    const next = Math.round(((settings.calibMs ?? 0) + median(lastOffsets)) / 5) * 5;
    patch({ calibMs: Math.min(300, Math.max(0, next)) });
    setAutoCalibDone(true);
  };

  // 鳴っているコードと、つぎにゲートへ来るコード。停止中は進行の先頭が「つぎ」になる
  const chord = anchor >= 0 ? (placeSlot(tl, anchor)?.chord ?? null) : null;
  const next = placeSlot(tl, anchor + 1)?.chord ?? null;

  if (view === 'settings') {
    return (
      <main>
        <SettingsPage
          engine={engine}
          source={source}
          onRetryMic={() => void engine.useMic()}
          settings={settings}
          patch={patch}
          canAutoCalib={source.source === 'mic' && lastOffsets.length >= AUTO_CALIB_MIN_SAMPLES && !autoCalibDone}
          onAutoCalib={onAutoCalib}
          onBack={() => go('practice')}
        />
      </main>
    );
  }

  return (
    <main>
      <header>
        <div className="head">
          <h1>ウクレレ練習</h1>
          {/* 練習中に移ると、見えないところでメトロノームだけが鳴り続ける */}
          <button type="button" className="btn-quiet" disabled={running} onClick={() => go('settings')}>
            <SlidersIcon />
            設定
          </button>
        </div>
        <p className="lede">曲を選んで、流れてくるコードに合わせて弾くと、タイミングと鳴っている音をマイクで採点します。</p>
      </header>

      <SongPanel
        songId={settings.songId}
        running={running}
        bpm={settings.bpm}
        onPick={(song) =>
          patch({
            songId: song.id,
            mode: 'score',
            bpm: song.score.bpm == null ? settings.bpm : clampBpm(song.score.bpm),
          })
        }
      />

      <MicStatus
        source={source.source}
        message={source.message}
        warn={source.warn}
        disabled={running}
        onRetry={() => void engine.useMic()}
      />

      <Stage
        engine={engine}
        tl={tl}
        anchor={anchor}
        verdicts={verdicts}
        chord={chord}
        next={next}
        phase={paused ? '一時停止中' : phaseText(tl, running ? tick : null)}
        dots={dots}
        feedback={feedback}
        chordJudge={chordJudge}
      />

      <Transport
        running={running}
        paused={paused}
        onToggle={onToggle}
        onPause={onPause}
        onSeek={(d) => engine.seek(d)}
        onScrub={(s) => engine.seekTo(s)}
        onScrubStart={onScrubStart}
        onScrubEnd={onScrubEnd}
        slot={cursor}
        total={end?.slots ?? null}
      />

      <Controls settings={settings} patch={patch} running={running} mode={mode} scoreReady={score != null} />

      {mode === 'drill' && (
        <Progression prog={settings.prog} onChange={(prog) => patch({ prog })} disabled={running} />
      )}

      <SummaryPanel summary={summary} stopped={finished} />

      <HistoryPanel history={history} onClear={() => setHistory(clearHistory())} />
    </main>
  );
}
