import { useRef } from 'react';
import type { TrainerEngine } from '../audio/engine';
import { NOTE, TEMPL } from '../core/chords';
import { useFrame } from '../hooks/useEngine';

const BAR_MAX_PX = 52;

/** 12音階のエネルギーと、いちばん近いコード。どちらも毎フレーム更新する */
export function LiveChroma({ engine, chord }: { engine: TrainerEngine; chord: string | null }) {
  const bars = useRef<(HTMLElement | null)[]>([]);
  const heard = useRef<HTMLElement>(null);
  const targets = (chord && TEMPL[chord]?.pcs) || [];

  useFrame(engine, (f) => {
    for (let i = 0; i < 12; i++) {
      const el = bars.current[i];
      if (el) el.style.height = `${Math.max(2, (f.quiet ? 0 : f.live[i] / f.liveMax) * BAR_MAX_PX)}px`;
    }
    const text = f.heard ?? '…';
    if (heard.current && heard.current.textContent !== text) heard.current.textContent = text;
  });

  return (
    <section className="block" aria-label="いま聞こえている音">
      <h2>いま聞こえている音</h2>
      <div className="chroma">
        {NOTE.map((n, pc) => (
          <div key={n} className={targets.includes(pc) ? 'tg' : undefined}>
            <i
              ref={(el) => {
                bars.current[pc] = el;
              }}
            />
            <span>{n}</span>
          </div>
        ))}
      </div>
      <p className="heard">
        いちばん近いコード<b ref={heard}>…</b>
      </p>
    </section>
  );
}
