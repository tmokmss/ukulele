import { useRef } from 'react';
import { COUNT_IN, type TrainerEngine } from '../audio/engine';
import { timingClass } from '../core/chroma';
import type { ResultText } from '../core/report';
import { useFrame } from '../hooks/useEngine';
import { FretDiagram } from './FretDiagram';

/** タイミングのレーンに出す点。新しいものほど濃く、12個で消える */
export type LaneDot = { id: number; ms: number; big: boolean };
export const LANE_DOT_MAX = 12;

/** 採点結果のほか、練習開始直後の案内も同じ場所に出す (tone なし) */
export type StageFeedback = { timing: string; tone: ResultText['tone'] | null; chord: string };

type Props = {
  engine: TrainerEngine;
  chord: string;
  next: string;
  phase: string;
  bpc: number;
  dots: LaneDot[];
  feedback: StageFeedback | null;
};

export function Stage({ engine, chord, next, phase, bpc, dots, feedback }: Props) {
  const cells = useRef<(HTMLElement | null)[]>([]);
  const cue = useRef<HTMLParagraphElement>(null);

  // 拍のバーは毎フレーム動かす。点滅だと「光ってから弾く」ことになって必ず遅れるので、
  // 満ちていく動きで次の一打を予測できるようにする。
  useFrame(engine, ({ pos }) => {
    // 満ちきった瞬間が鳴らす瞬間。カウントインも同じ見た目で、4拍かけて満ちる
    const filled = pos == null ? 0 : pos < 0 ? ((COUNT_IN + pos) / COUNT_IN) * bpc : pos % bpc;
    for (let i = 0; i < bpc; i++) {
      const el = cells.current[i];
      if (el) el.style.width = `${Math.max(0, Math.min(1, filled - i)) * 100}%`;
    }
    setText(
      cue.current,
      pos == null ? '' : pos < 0 ? `スタートまで ${Math.ceil(-pos)}` : `あと ${bpc - Math.floor(pos % bpc)} 拍`,
    );
  });

  return (
    <section className="stage" aria-label="いまのコード">
      <div className="stage-top">
        <div>
          <p className="phase">{phase}</p>
          <p className={chord.length > 3 ? 'chord long' : 'chord'}>{chord}</p>
          <p className="next">
            つぎは<b>{next}</b>
          </p>
        </div>
        <FretDiagram engine={engine} chord={chord} />
      </div>

      <p className="cue" ref={cue} aria-hidden="true" />
      <div className="beats" aria-hidden="true">
        {Array.from({ length: bpc }, (_, i) => (
          <i key={i}>
            <b
              ref={(el) => {
                cells.current[i] = el;
              }}
            />
          </i>
        ))}
      </div>
      <p className="rule">バーが右端まで満ちたら、そこで次のコードを1回鳴らします。</p>

      <div className="lane" aria-hidden="true">
        <span>早い</span>
        <div className="lane-track">
          <i className="lane-zone" />
          <i className="lane-mid" />
          {dots.map((d, i) => {
            const age = dots.length - 1 - i;
            return (
              <i
                key={d.id}
                className={`lane-dot ${timingClass(d.ms)}${d.big ? ' big' : ''}`}
                style={{
                  left: `${50 + Math.max(-1, Math.min(1, d.ms / 150)) * 48}%`,
                  opacity: 1 - age * 0.075,
                }}
              />
            );
          })}
        </div>
        <span>遅い</span>
      </div>

      <div className="feedback" aria-live="polite">
        {feedback ? (
          <>
            <p className={feedback.tone ? `t ${feedback.tone}-t` : 't'}>{feedback.timing}</p>
            {feedback.chord && <p>{feedback.chord}</p>}
          </>
        ) : (
          <>
            <p className="t">準備ができたら、練習を始めてください。</p>
            <p className="note" style={{ marginTop: 2 }}>
              押さえ方の図は、聞こえている音ほど濃く光ります。光らない弦はミュートしているかもしれません。
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function setText(el: HTMLElement | null, text: string): void {
  if (el && el.textContent !== text) el.textContent = text;
}
