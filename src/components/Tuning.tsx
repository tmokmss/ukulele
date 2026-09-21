import type { Settings } from '../core/types';

type Props = {
  settings: Settings;
  patch: (p: Partial<Settings>) => void;
  /** 「今回のズレの傾向で補正する」が押せるか */
  canAutoCalib: boolean;
  onAutoCalib: () => void;
};

/** 補正値が未設定のときにスライダーが指す位置 */
export const CALIB_FALLBACK = 60;

export function Tuning({ settings, patch, canAutoCalib, onAutoCalib }: Props) {
  const calib = settings.calibMs ?? CALIB_FALLBACK;
  return (
    <section className="block" aria-label="調整">
      <h2>調整</h2>
      <div className="row" style={{ marginTop: 0 }}>
        <label htmlFor="calib">タイミング補正</label>
        <input
          type="range"
          id="calib"
          min={0}
          max={300}
          step={5}
          value={calib}
          onChange={(e) => patch({ calibMs: +e.target.value })}
        />
        <output htmlFor="calib">{calib} ms</output>
      </div>
      <div className="row">
        <button type="button" className="btn-sub" disabled={!canAutoCalib} onClick={onAutoCalib}>
          今回のズレの傾向で補正する
        </button>
      </div>
      <p className="note">
        いつも同じ向きにズレるときは、機器の音の遅れが原因のことが多いです。Bluetoothイヤホンは遅れが大きくなります。
      </p>
      <div className="row">
        <label htmlFor="sens">音の検出感度</label>
        <input
          type="range"
          id="sens"
          min={1}
          max={10}
          step={1}
          value={settings.sens}
          onChange={(e) => patch({ sens: +e.target.value })}
        />
        <output htmlFor="sens">{settings.sens}</output>
      </div>
      <p className="note">
        ストロークが拾われないときは上げて、雑音で反応するときは下げてください。先にチューニングを合わせておくとコード判定が正確になります。
      </p>
    </section>
  );
}
