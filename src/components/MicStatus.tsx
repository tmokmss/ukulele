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
  onRetry: () => void;
};

/** つながっていればレベルメーター、駄目なら理由と再試行ボタンを出す */
export function MicStatus({ engine, source, message, warn, disabled, onRetry }: Props) {
  const barRef = useRef<HTMLElement>(null);
  // レベルメーターは毎フレーム動くので state に載せず直接書き換える
  useFrame(engine, (f) => {
    if (barRef.current) barRef.current.style.width = `${(f.level * 100).toFixed(0)}%`;
  });

  return (
    <section className="source" aria-label="マイク">
      <div className="source-row">
        {source === 'mic' ? (
          <div className="meter">
            <span>マイク</span>
            <div className="bar">
              <i ref={barRef} />
            </div>
          </div>
        ) : (
          <button type="button" className="btn-sub" disabled={disabled} onClick={onRetry}>
            マイクを使う
          </button>
        )}
      </div>
      {message && <p className={warn ? 'note warn' : 'note'}>{message}</p>}
    </section>
  );
}
