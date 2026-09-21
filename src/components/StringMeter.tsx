import { useRef } from 'react';
import type { TrainerEngine } from '../audio/engine';
import { TEMPL } from '../core/chords';
import { useFrame } from '../hooks/useEngine';

const LABEL = ['4', '3', '2', '1'];

/**
 * いま鳴っているコードの、弦ごとの鳴り具合。
 * 光らない弦はミュートしている。毎フレーム更新するので DOM を直接書き換える。
 */
export function StringMeter({ engine, chord }: { engine: TrainerEngine; chord: string | null }) {
  const bars = useRef<(HTMLElement | null)[]>([]);

  useFrame(engine, (f) => {
    const tmpl = chord ? TEMPL[chord] : null;
    for (let i = 0; i < 4; i++) {
      const el = bars.current[i];
      if (!el) continue;
      const g = !tmpl || f.quiet ? 0 : Math.min(1, f.live[tmpl.stringPcs[i]] / f.liveMax);
      el.style.opacity = (0.16 + 0.84 * g).toFixed(2);
    }
  });

  return (
    <div className="strmeter" aria-label="弦ごとの鳴り">
      {LABEL.map((n, i) => (
        <div key={n}>
          <i
            ref={(el) => {
              bars.current[i] = el;
            }}
          />
          <span>{n}</span>
        </div>
      ))}
    </div>
  );
}
