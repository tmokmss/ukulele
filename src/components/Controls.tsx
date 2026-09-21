import type { Settings } from '../core/types';
import { Segmented } from './Segmented';

type Props = {
  settings: Settings;
  patch: (p: Partial<Settings>) => void;
  running: boolean;
  onToggle: () => void;
};

export function Controls({ settings, patch, running, onToggle }: Props) {
  return (
    <section className="controls" aria-label="練習の設定">
      <button type="button" className={running ? 'btn-main stop' : 'btn-main'} onClick={onToggle}>
        {running ? '止める' : '練習を始める'}
      </button>

      <div className="row">
        <label htmlFor="bpm">テンポ</label>
        <input
          type="range"
          id="bpm"
          min={40}
          max={140}
          step={2}
          value={settings.bpm}
          disabled={running}
          onChange={(e) => patch({ bpm: +e.target.value })}
        />
        <output htmlFor="bpm">{settings.bpm} BPM</output>
      </div>

      <div className="row">
        <span className="lbl">1コードの長さ</span>
        <Segmented
          label="1コードの長さ"
          options={[
            { value: 2, label: '2拍' },
            { value: 4, label: '4拍' },
            { value: 8, label: '8拍' },
          ]}
          value={settings.bpc}
          disabled={running}
          onChange={(v) => patch({ bpc: v })}
        />
      </div>

      <div className="row">
        <span className="lbl">練習時間</span>
        <Segmented
          label="練習時間"
          options={[
            { value: 60, label: '1分' },
            { value: 120, label: '2分' },
            { value: 0, label: '止めるまで' },
          ]}
          value={settings.sessionSec}
          disabled={running}
          onChange={(v) => patch({ sessionSec: v })}
        />
      </div>

      <div className="row">
        <span className="lbl">クリック音</span>
        <Segmented
          label="クリック音"
          options={[
            { value: true, label: 'あり' },
            { value: false, label: 'なし' },
          ]}
          value={settings.clickOn}
          onChange={(v) => patch({ clickOn: v })}
        />
      </div>

      <p className="note">クリック音はイヤホンで聞くと、マイクへの回り込みが減って採点が安定します。</p>
    </section>
  );
}
