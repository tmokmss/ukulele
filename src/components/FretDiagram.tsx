import { useRef } from 'react';
import type { TrainerEngine } from '../audio/engine';
import { CHORDS, TEMPL } from '../core/chords';
import { useFrame } from '../hooks/useEngine';

const X = (i: number) => 18 + i * 34;
const NUT = 40;
const FRET_H = 28;
const N_FRET = 5;
const STRING_LABEL = 'GCEA';

/**
 * 押さえ方の図。骨組みは React が描き、
 * 「聞こえている音ほど濃く光る」部分だけ毎フレーム属性を書き換える。
 */
export function FretDiagram({ engine, chord }: { engine: TrainerEngine; chord: string }) {
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const strings = useRef<(SVGLineElement | null)[]>([]);
  const frets = CHORDS[chord] ?? [0, 0, 0, 0];

  useFrame(engine, (f) => {
    const tmpl = TEMPL[chord];
    if (!tmpl) return;
    for (let i = 0; i < 4; i++) {
      const g = f.quiet ? 0 : Math.min(1, f.live[tmpl.stringPcs[i]] / f.liveMax);
      const open = frets[i] === 0;
      dots.current[i]?.setAttribute('fill-opacity', ((open ? 0.12 : 0.25) + (open ? 0.88 : 0.75) * g).toFixed(2));
      strings.current[i]?.setAttribute('stroke-width', (1.5 + 2.2 * g).toFixed(2));
    }
  });

  return (
    <svg className="fret" viewBox="0 0 138 186" role="img" aria-label={`${chord} の押さえ方: 4弦から ${frets.join(' ')}`}>
      {Array.from({ length: N_FRET }, (_, j) => (
        <line key={`fr${j}`} className="fr" x1="18" x2="120" y1={NUT + (j + 1) * FRET_H} y2={NUT + (j + 1) * FRET_H} />
      ))}
      <line className="nut" x1="16" x2="122" y1={NUT} y2={NUT} />
      {[0, 1, 2, 3].map((i) => (
        <text key={`t${i}`} x={X(i)} y={10}>
          {STRING_LABEL[i]}
        </text>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={`s${i}`}
          ref={(el) => {
            strings.current[i] = el;
          }}
          className="str"
          x1={X(i)}
          x2={X(i)}
          y1={NUT}
          y2={NUT + N_FRET * FRET_H}
          strokeWidth={1.5}
        />
      ))}
      {[0, 1, 2, 3].map((i) =>
        frets[i] === 0 ? (
          <circle
            key={`d${i}`}
            ref={(el) => {
              dots.current[i] = el;
            }}
            className="open"
            cx={X(i)}
            cy={25}
            r={6}
            fillOpacity={0.15}
          />
        ) : (
          <circle
            key={`d${i}`}
            ref={(el) => {
              dots.current[i] = el;
            }}
            className="dot"
            cx={X(i)}
            cy={NUT + (frets[i] - 0.5) * FRET_H}
            r={10.5}
            fillOpacity={0.25}
          />
        ),
      )}
    </svg>
  );
}
