import type { PracticeMode, Settings } from '../core/types';
import { Segmented } from './Segmented';

type Props = {
  settings: Settings;
  patch: (p: Partial<Settings>) => void;
  running: boolean;
  onToggle: () => void;
  /** 実際に使われているモード。楽譜が読めていないときは drill に落ちている */
  mode: PracticeMode;
  /** 楽譜が読めているか。読めていなければ楽譜モードに切り替えられない */
  scoreReady: boolean;
};

export function Controls({ settings, patch, running, onToggle, mode, scoreReady }: Props) {
  const score = mode === 'score';

  return (
    <section className="controls" aria-label="練習の設定">
      <button type="button" className={running ? 'btn-main stop' : 'btn-main'} onClick={onToggle}>
        {running ? '止める' : '練習を始める'}
      </button>

      <div className="row">
        <span className="lbl">練習するもの</span>
        <Segmented
          label="練習するもの"
          options={[
            { value: 'drill', label: 'コード進行' },
            { value: 'score', label: '楽譜', disabled: !scoreReady },
          ]}
          value={mode}
          disabled={running}
          onChange={(v) => patch({ mode: v })}
        />
      </div>

      <div className="row">
        <label htmlFor="bpm">テンポ</label>
        <input
          type="range"
          id="bpm"
          min={40}
          max={180}
          step={2}
          value={settings.bpm}
          disabled={running}
          onChange={(e) => patch({ bpm: +e.target.value })}
        />
        <output htmlFor="bpm">{settings.bpm} BPM</output>
      </div>

      {!score && (
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
      )}

      {!score && (
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
      )}

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

      <div className="row">
        <span className="lbl">お手本</span>
        <Segmented
          label="お手本"
          options={[
            { value: true, label: 'あり' },
            { value: false, label: 'なし' },
          ]}
          value={settings.demoOn}
          onChange={(v) => patch({ demoOn: v })}
        />
      </div>

      {score && <p className="note">コードの長さと練習の長さは、楽譜が決めます。テンポだけ変えられます。</p>}
      {settings.demoOn && (
        <p className="note warn">
          お手本は必ずイヤホンで聞いてください。スピーカーのままだと、お手本をマイクが拾って、弾かなくても高い点が出ます。
        </p>
      )}
      <p className="note">クリック音はイヤホンで聞くと、マイクへの回り込みが減って採点が安定します。</p>
    </section>
  );
}
