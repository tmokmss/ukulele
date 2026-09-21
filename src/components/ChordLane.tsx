import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNT_IN, type TrainerEngine } from '../audio/engine';
import { placeRange, type Timeline } from '../core/timeline';
import { useFrame } from '../hooks/useEngine';
import { FretMini } from './FretMini';

/** ゲート (鳴らす位置) をレーンのどこに置くか */
const GATE_RATIO = 0.28;
/** ゲートより左に残して見せる数 / 先に見せる数 */
const PAST = 1;
const AHEAD = 4;
const CARD_W = 64;

type Props = {
  engine: TrainerEngine;
  tl: Timeline;
  /** いま鳴っているコードの絶対番号。カウントイン中と停止中は -1 */
  anchor: number;
  /** 1コードの拍数。先をどれだけ見せるかの目安に使う */
  bpc: number;
};

/**
 * コードが右から左へ流れてきて、ゲートに乗ったら鳴らすレーン。
 *
 * カードは拍を座標とする1枚の帯の上に置き、帯ごと毎フレーム動かす。
 * カードの入れ替えはコードが変わるときだけなので React に任せ、
 * 位置は transform を1回書き換えるだけにしている。
 */
export function ChordLane({ engine, tl, anchor, bpc }: Props) {
  const laneRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = laneRef.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gateX = w * GATE_RATIO;
  // 1コードぶんの先が見えるくらいに合わせる。コードが長いほどゆっくり流れる
  const pxPerBeat = w > 0 ? (w - gateX) / Math.max(4, bpc * 1.6) : 0;

  // まだ1つも鳴らしていないうちは「過去のコード」は無い
  const cards = useMemo(
    () => placeRange(tl, Math.max(0, anchor - PAST), Math.max(AHEAD - 1, anchor + AHEAD)),
    [tl, anchor],
  );
  const from = cards[0].startBeat;
  const to = cards[cards.length - 1].startBeat + cards[cards.length - 1].beats;

  useFrame(engine, ({ pos }) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.style.transform = `translateX(${(gateX - (pos ?? 0) * pxPerBeat).toFixed(1)}px)`;
    // カウントイン中だけ、ゲートの上に残り拍を出す
    const count = countRef.current;
    if (count) {
      // t0 は 0.2秒ぶん先にあるので、頭が COUNT_IN+1 にならないよう抑える
      const text = pos != null && pos < 0 ? String(Math.min(COUNT_IN, Math.ceil(-pos))) : '';
      if (count.textContent !== text) count.textContent = text;
    }
  });

  return (
    <div className="chordlane" ref={laneRef} aria-hidden="true">
      <i className="gatezone" style={{ left: gateX - CARD_W * 0.6, width: CARD_W * 1.2 }} />
      <i className="gate" style={{ left: gateX }} />
      <div className="gate-count" ref={countRef} style={{ left: gateX }} />

      <div className="strip" ref={stripRef}>
        {Array.from({ length: Math.max(0, Math.round(to - from)) }, (_, i) => {
          const beat = from + i;
          const head = cards.some((c) => c.startBeat === beat);
          return (
            <i
              key={`t${beat}`}
              className={head ? 'tick head' : 'tick'}
              style={{ left: beat * pxPerBeat }}
            />
          );
        })}

        {cards.map((c) => (
          <div
            key={c.index}
            className={`ct${c.index <= anchor ? ' past' : c.index === anchor + 1 ? ' due' : ''}`}
            style={{ left: c.startBeat * pxPerBeat - CARD_W / 2, width: CARD_W }}
          >
            <FretMini chord={c.chord} w={42} />
            <span className="nm">{c.chord}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
