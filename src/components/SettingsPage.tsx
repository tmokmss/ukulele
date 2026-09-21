import type { SourceState, TrainerEngine } from '../audio/engine';
import type { Settings } from '../core/types';
import { Adjust } from './Adjust';
import { MicStatus } from './MicStatus';
import { Tuner } from './Tuner';

type Props = {
  engine: TrainerEngine;
  source: SourceState;
  onRetryMic: () => void;
  settings: Settings;
  patch: (p: Partial<Settings>) => void;
  canAutoCalib: boolean;
  onAutoCalib: () => void;
  onBack: () => void;
};

/** 練習の前後に触るもの。楽器を合わせる (チューニング) と、採点の効き方 (調整) */
export function SettingsPage({ engine, source, onRetryMic, settings, patch, canAutoCalib, onAutoCalib, onBack }: Props) {
  return (
    <>
      <header>
        <div className="head">
          <h1>設定</h1>
          <button type="button" className="btn-quiet" onClick={onBack}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            練習にもどる
          </button>
        </div>
        <p className="lede">楽器を合わせて、採点の効き方を整えます。</p>
      </header>

      <MicStatus
        source={source.source}
        message={source.message}
        warn={source.warn}
        disabled={false}
        onRetry={onRetryMic}
      />

      <Tuner engine={engine} connected={source.source === 'mic'} />

      <Adjust settings={settings} patch={patch} canAutoCalib={canAutoCalib} onAutoCalib={onAutoCalib} />
    </>
  );
}
