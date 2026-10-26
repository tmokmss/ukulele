import type { PracticeMode, Settings } from '../core/types';
import { Segmented } from './Segmented';

type Props = {
  settings: Settings;
  patch: (p: Partial<Settings>) => void;
  running: boolean;
  /** 実際に使われているモード。楽譜が読めていないときは drill に落ちている */
  mode: PracticeMode;
  /** 楽譜が読めているか。読めていなければ楽譜モードに切り替えられない */
  scoreReady: boolean;
  /** 楽譜に主旋律が書いてあるか */
  hasMelody: boolean;
};

export function Controls({ settings, patch, running, mode, scoreReady, hasMelody }: Props) {
  const score = mode === 'score';

  return (
    <section className="controls" aria-label="練習の設定">
      <div className="row first">
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

      <Volume id="click-vol" label="クリック音" value={settings.clickVol} onChange={(v) => patch({ clickVol: v })} />
      <Volume id="demo-vol" label="お手本" value={settings.demoVol} onChange={(v) => patch({ demoVol: v })} />
      {score && hasMelody && (
        <Volume id="melody-vol" label="主旋律" value={settings.melodyVol} onChange={(v) => patch({ melodyVol: v })} />
      )}

      {score && <p className="note">コードの長さと練習の長さは、楽譜が決めます。テンポだけ変えられます。</p>}
      {(settings.demoVol > 0 || (score && hasMelody && settings.melodyVol > 0)) && (
        <p className="note warn">お手本と主旋律はイヤホンで聞いてください。スピーカーだとマイクが拾います。</p>
      )}
    </section>
  );
}

type VolumeProps = { id: string; label: string; value: number; onChange: (v: number) => void };

function Volume({ id, label, value, onChange }: VolumeProps) {
  return (
    <div className="row">
      <label htmlFor={id}>{label}</label>
      <input type="range" id={id} min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}
