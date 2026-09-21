import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SourceState } from './audio/engine';
import { Controls } from './components/Controls';
import { HistoryPanel } from './components/HistoryPanel';
import { LiveChroma } from './components/LiveChroma';
import { Progression } from './components/Progression';
import { MicStatus } from './components/MicStatus';
import { ScorePanel } from './components/ScorePanel';
import { Stage, LANE_DOT_MAX, type LaneDot, type StageFeedback } from './components/Stage';
import { SummaryPanel } from './components/SummaryPanel';
import { Tuning } from './components/Tuning';
import { median } from './core/chroma';
import { describeResult, phaseText, summarize, type SessionSummary } from './core/report';
import { parseScore, scoreTimeline } from './core/score';
import { clearHistory, loadHistory, loadSettings, pushHistory, saveSettings } from './core/storage';
import { buildTimeline, placeSlot, planEnd, slotIndexAt } from './core/timeline';
import type { PracticeMode, Settings, TickInfo } from './core/types';
import { useEngine, useFrame } from './hooks/useEngine';

/** 自動補正に使うには、これだけのチェンジが拾えている必要がある */
const AUTO_CALIB_MIN_SAMPLES = 6;

/** テンポのスライダーが出せる範囲。楽譜の bpm もここに収める */
const BPM_MIN = 40;
const BPM_MAX = 180;
const clampBpm = (v: number): number => Math.min(BPM_MAX, Math.max(BPM_MIN, v));

let dotSeq = 0;

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const engine = useEngine(settings);

  const [source, setSource] = useState<SourceState>({ source: 'none', message: null, warn: false });
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState<TickInfo | null>(null);
  const [dots, setDots] = useState<LaneDot[]>([]);
  const [feedback, setFeedback] = useState<StageFeedback | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [finished, setFinished] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [lastOffsets, setLastOffsets] = useState<number[]>([]);
  const [autoCalibDone, setAutoCalibDone] = useState(false);

  // 楽譜は打つそばから読む。読めないあいだは進行の練習に落としておく
  const score = useMemo(() => {
    const r = settings.scoreText.trim() ? parseScore(settings.scoreText) : null;
    return r?.ok ? r.score : null;
  }, [settings.scoreText]);
  const mode: PracticeMode = settings.mode === 'score' && score ? 'score' : 'drill';

  // 画面はタイムライン上の「いまどのコードか」だけを見る。
  // 拍の細かい動きはレーンが onFrame から直接受け取る。
  const tl = useMemo(
    () => (mode === 'score' && score ? scoreTimeline(score) : buildTimeline(settings.prog, settings.bpc)),
    [mode, score, settings.prog, settings.bpc],
  );
  const [anchor, setAnchor] = useState(-1);
  const anchorRef = useRef(-1);
  useFrame(engine, ({ pos }) => {
    const i = pos == null ? -1 : slotIndexAt(tl, pos);
    if (i !== anchorRef.current) {
      anchorRef.current = i;
      setAnchor(i);
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
  useEffect(() => engine.on('tick', setTick), [engine]);
  useEffect(() => engine.on('calib', (ms) => patch({ calibMs: ms })), [engine, patch]);
  useEffect(() => engine.on('result', (r) => setFeedback(describeResult(r))), [engine]);

  useEffect(
    () =>
      engine.on('onset', ({ ms, isChange }) =>
        setDots((d) => [...d, { id: ++dotSeq, ms, big: isChange }].slice(-LANE_DOT_MAX)),
      ),
    [engine],
  );

  // 記録に残すのは終了時点の設定。settings が変わるたび貼り直す
  useEffect(
    () =>
      engine.on('end', (results) => {
        const sum = summarize(results);
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
              okRate: sum.okRate,
              meanAbs: sum.meanAbs == null ? null : Math.round(sum.meanAbs),
            }),
          );
        }
      }),
    [engine, settings, mode, score],
  );

  const onToggle = () => {
    if (engine.isRunning) {
      engine.stop(true);
      return;
    }
    setDots([]);
    setSummary(null);
    setFinished(false);
    const plan = { tl, bpm: settings.bpm, end: planEnd(tl, settings.bpm, settings.sessionSec) };
    if (engine.start(plan)) setFeedback({ timing: 'カウントインのあと、はじまります。', tone: null, chord: '' });
  };

  const onAutoCalib = () => {
    if (lastOffsets.length < AUTO_CALIB_MIN_SAMPLES) return;
    const next = Math.round(((settings.calibMs ?? 0) + median(lastOffsets)) / 5) * 5;
    patch({ calibMs: Math.min(300, Math.max(0, next)) });
    setAutoCalibDone(true);
  };

  // 鳴っているコードと、つぎにゲートへ来るコード。停止中は進行の先頭が「つぎ」になる
  const chord = anchor >= 0 ? (placeSlot(tl, anchor)?.chord ?? null) : null;
  const next = placeSlot(tl, anchor + 1)?.chord ?? null;

  return (
    <main>
      <header>
        <h1>コードチェンジ練習</h1>
        <p className="lede">クリックに合わせてコードを切り替えると、タイミングと鳴っている音を採点します。</p>
      </header>

      <MicStatus
        engine={engine}
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
        chord={chord}
        next={next}
        phase={phaseText(tl, running ? tick : null)}
        dots={dots}
        feedback={feedback}
      />

      <LiveChroma engine={engine} chord={chord ?? next} />

      <Controls
        settings={settings}
        patch={patch}
        running={running}
        onToggle={onToggle}
        mode={mode}
        scoreReady={score != null}
      />

      {mode === 'drill' && (
        <Progression prog={settings.prog} onChange={(prog) => patch({ prog })} disabled={running} />
      )}

      <ScorePanel
        text={settings.scoreText}
        onChange={(scoreText) => patch({ scoreText })}
        onUse={(s) => patch({ mode: 'score', bpm: s.bpm == null ? settings.bpm : clampBpm(s.bpm) })}
        active={mode === 'score'}
        running={running}
      />

      <SummaryPanel summary={summary} stopped={finished} />

      <HistoryPanel history={history} onClear={() => setHistory(clearHistory())} />

      <Tuning
        settings={settings}
        patch={patch}
        canAutoCalib={source.source === 'mic' && lastOffsets.length >= AUTO_CALIB_MIN_SAMPLES && !autoCalibDone}
        onAutoCalib={onAutoCalib}
      />
    </main>
  );
}
