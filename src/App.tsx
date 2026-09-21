import { useCallback, useEffect, useState } from 'react';
import type { SourceState, TickInfo } from './audio/engine';
import { Controls } from './components/Controls';
import { HistoryPanel } from './components/HistoryPanel';
import { LiveChroma } from './components/LiveChroma';
import { Progression } from './components/Progression';
import { SourcePicker } from './components/SourcePicker';
import { Stage, LANE_DOT_MAX, type LaneDot, type StageFeedback } from './components/Stage';
import { SummaryPanel } from './components/SummaryPanel';
import { Tuning } from './components/Tuning';
import { median } from './core/chroma';
import { describeResult, summarize, type SessionSummary } from './core/report';
import { clearHistory, loadHistory, loadSettings, pushHistory, saveSettings } from './core/storage';
import type { Settings } from './core/types';
import { useEngine } from './hooks/useEngine';

/** 自動補正に使うには、これだけのチェンジが拾えている必要がある */
const AUTO_CALIB_MIN_SAMPLES = 6;

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

  const patch = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...p };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => engine.on('source', setSource), [engine]);
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
              prog: settings.prog.join(' '),
              bpm: settings.bpm,
              bpc: settings.bpc,
              n: sum.total,
              okRate: sum.okRate,
              meanAbs: sum.meanAbs == null ? null : Math.round(sum.meanAbs),
              src: engine.source,
            }),
          );
        }
      }),
    [engine, settings],
  );

  const onToggle = () => {
    if (engine.isRunning) {
      engine.stop(true);
      return;
    }
    setDots([]);
    setSummary(null);
    setFinished(false);
    if (engine.start()) setFeedback({ timing: 'カウントのあと、1拍目でコードを鳴らしてください。', tone: null, chord: '' });
  };

  const onAutoCalib = () => {
    if (lastOffsets.length < AUTO_CALIB_MIN_SAMPLES) return;
    const next = Math.round(((settings.calibMs ?? 0) + median(lastOffsets)) / 5) * 5;
    patch({ calibMs: Math.min(300, Math.max(0, next)) });
    setAutoCalibDone(true);
  };

  // 練習中は tick が現在地を持つ。停止中は進行の先頭を見せる
  const chord = running && tick ? tick.chord : settings.prog[0];
  const next = running && tick ? tick.next : settings.prog[1 % settings.prog.length];
  const phase = running && tick ? tick.phase : '最初のコード';

  return (
    <main>
      <header>
        <h1>コードチェンジ練習</h1>
        <p className="lede">クリックに合わせてコードを切り替えると、タイミングと鳴っている音を採点します。</p>
      </header>

      <SourcePicker
        engine={engine}
        source={source.source}
        message={source.message}
        warn={source.warn}
        disabled={running}
        onPick={(kind) => (kind === 'mic' ? void engine.useMic() : engine.useSynth())}
      />

      <Stage
        engine={engine}
        chord={chord}
        next={next}
        phase={phase}
        beat={running && tick ? tick.beat : -1}
        bpc={settings.bpc}
        dots={dots}
        feedback={feedback}
        showPlayOne={source.source === 'synth'}
        playDisabled={running}
        onPlayOne={() => engine.playCurrentChord()}
      />

      <Controls settings={settings} patch={patch} running={running} onToggle={onToggle} />

      <Progression prog={settings.prog} onChange={(prog) => patch({ prog })} disabled={running} />

      <LiveChroma engine={engine} chord={chord} />

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
