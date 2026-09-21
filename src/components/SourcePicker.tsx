import { useRef } from 'react';
import type { TrainerEngine } from '../audio/engine';
import { useFrame } from '../hooks/useEngine';
import type { SourceKind } from '../core/types';

type Props = {
  engine: TrainerEngine;
  source: SourceKind;
  message: string | null;
  warn: boolean;
  disabled: boolean;
  onPick: (kind: 'mic' | 'synth') => void;
};

const STATE_LABEL: Record<SourceKind, string> = { mic: 'マイク', synth: 'テスト音', none: '入力なし' };

export function SourcePicker({ engine, source, message, warn, disabled, onPick }: Props) {
  const barRef = useRef<HTMLElement>(null);
  // レベルメーターは毎フレーム動くので state に載せず直接書き換える
  useFrame(engine, (f) => {
    if (barRef.current) barRef.current.style.width = `${(f.level * 100).toFixed(0)}%`;
  });

  return (
    <section className="source" aria-label="音の入力">
      <div className="source-row">
        <div className="seg">
          <button type="button" aria-pressed={source === 'mic'} disabled={disabled} onClick={() => onPick('mic')}>
            マイクを使う
          </button>
          <button type="button" aria-pressed={source === 'synth'} disabled={disabled} onClick={() => onPick('synth')}>
            テスト音で試す
          </button>
        </div>
        <div className="meter">
          <span>{STATE_LABEL[source]}</span>
          <div className="bar">
            <i ref={barRef} />
          </div>
        </div>
      </div>
      {message && <p className={warn ? 'note warn' : 'note'}>{message}</p>}
    </section>
  );
}
