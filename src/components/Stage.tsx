import type { TrainerEngine } from '../audio/engine';
import { timingClass } from '../core/chroma';
import type { ResultText } from '../core/report';
import type { Timeline } from '../core/timeline';
import { ChordLane } from './ChordLane';
import { FretMini } from './FretMini';
import { StringMeter } from './StringMeter';

/** タイミングのレーンに出す点。新しいものほど濃く、12個で消える */
export type LaneDot = { id: number; ms: number; big: boolean };
export const LANE_DOT_MAX = 12;

/** 採点結果のほか、練習開始直後の案内も同じ場所に出す (tone なし) */
export type StageFeedback = { timing: string; tone: ResultText['tone'] | null; chord: string };

type Props = {
  engine: TrainerEngine;
  tl: Timeline;
  /** いま鳴っているコードの絶対番号。カウントイン中と停止中は -1 */
  anchor: number;
  /** いま鳴っているコード。カウントイン中と停止中は null */
  chord: string | null;
  /** つぎにゲートへ来るコード。楽譜を弾き終えたあとは null */
  next: string | null;
  phase: string;
  dots: LaneDot[];
  feedback: StageFeedback | null;
};

export function Stage({ engine, tl, anchor, chord, next, phase, dots, feedback }: Props) {
  return (
    <section className="stage" aria-label="いまのコード">
      <p className="phase">{phase}</p>

      <ChordLane engine={engine} tl={tl} anchor={anchor} />

      <div className="under">
        <div>
          <p className="nowline">
            いま鳴っている<b>{chord ?? '—'}</b>
          </p>
          <StringMeter engine={engine} chord={chord} />
        </div>
        <div className="nextshape">
          <p className="lbl">{next ? 'つぎに押さえる形' : 'おしまい'}</p>
          {next && <FretMini chord={next} w={84} labels />}
        </div>
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
          <p className="t">準備ができたら、練習を始めてください。</p>
        )}
      </div>
    </section>
  );
}
