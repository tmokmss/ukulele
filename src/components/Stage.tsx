import type { TrainerEngine } from '../audio/engine';
import { timingClass } from '../core/chroma';
import type { ResultText } from '../core/report';
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
  /** 小節内の拍 (0始まり)。カウントイン中や停止中は -1 */
  beat: number;
  bpc: number;
  dots: LaneDot[];
  feedback: StageFeedback | null;
  showPlayOne: boolean;
  playDisabled: boolean;
  onPlayOne: () => void;
};

export function Stage({ engine, chord, next, phase, beat, bpc, dots, feedback, showPlayOne, playDisabled, onPlayOne }: Props) {
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
        <div>
          <FretDiagram engine={engine} chord={chord} />
          {showPlayOne && (
            <button type="button" className="play-one" disabled={playDisabled} onClick={onPlayOne}>
              この音を鳴らす
            </button>
          )}
        </div>
      </div>

      <div className="beats" aria-hidden="true">
        {Array.from({ length: bpc }, (_, i) => (
          <i key={i} className={i === beat ? (i === 0 ? 'on first' : 'on') : ''} />
        ))}
      </div>

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
            <p className="t">入力を選んで、練習を始めてください。</p>
            <p className="note" style={{ marginTop: 2 }}>
              押さえ方の図は、聞こえている音ほど濃く光ります。光らない弦はミュートしているかもしれません。
            </p>
          </>
        )}
      </div>
    </section>
  );
}
