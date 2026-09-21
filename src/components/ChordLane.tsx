import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNT_IN, type TrainerEngine } from '../audio/engine';
import type { CardVerdict } from '../core/report';
import { hitsInRange, placeRange, type Timeline } from '../core/timeline';
import { useFrame } from '../hooks/useEngine';
import { FretMini } from './FretMini';

/** ゲート (鳴らす位置) をレーンのどこに置くか */
const GATE_RATIO = 0.28;
/** ゲートより左に残して見せる数 / 先に見せる数 */
const PAST = 1;
const AHEAD = 4;
const CARD_W = 64;
/** 通過したカードを止めておく位置。採点が出るまで見えている必要がある */
const PARK_X = 4;

type Props = {
  engine: TrainerEngine;
  tl: Timeline;
  /** いま鳴っているコードの絶対番号。カウントイン中と停止中は -1 */
  anchor: number;
  /** 採点の済んだコード。スロット番号で引く */
  verdicts: Map<number, CardVerdict>;
};

/**
 * コードが右から左へ流れてきて、ゲートに乗ったら鳴らすレーン。
 *
 * カードは拍を座標とする1枚の帯の上に置き、帯ごと毎フレーム動かす。
 * カードの入れ替えはコードが変わるときだけなので React に任せ、
 * 位置は transform を1回書き換えるだけにしている。
 */
export function ChordLane({ engine, tl, anchor, verdicts }: Props) {
  const laneRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<number, HTMLDivElement | null>());
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
  // 1コードぶんの先が見えるくらいに合わせる。コードが長いほどゆっくり流れる。
  // 楽譜は小節ごとに長さが変わるので、平均で見る
  const avgBeats = tl.cycleBeats / tl.slots.length;
  const pxPerBeat = w > 0 ? (w - gateX) / Math.max(4, avgBeats * 1.6) : 0;

  // まだ1つも鳴らしていないうちは「過去のコード」は無い。楽譜の終わりでは先が無くなる
  const cards = useMemo(
    () => placeRange(tl, Math.max(0, anchor - PAST), Math.max(AHEAD - 1, anchor + AHEAD)),
    [tl, anchor],
  );
  const last = cards[cards.length - 1];
  const from = cards.length ? cards[0].startBeat : 0;
  const to = cards.length ? last.startBeat + last.beats : 0;
  // 楽譜がストロークを決めていれば、鳴らす位置を矢印で出す
  const hits = useMemo(() => hitsInRange(tl, from, to), [tl, from, to]);

  useFrame(engine, ({ pos }) => {
    const strip = stripRef.current;
    if (!strip) return;
    const p = pos ?? 0;
    strip.style.transform = `translateX(${(gateX - p * pxPerBeat).toFixed(1)}px)`;

    // 鳴らし終えたカードは左端で止める。採点が出るのは通過の約1.5秒後なので、
    // そのまま流すと結果が付く前に画面から出てしまう。
    for (const c of cards) {
      const el = cardEls.current.get(c.index);
      if (!el) continue;
      const x = gateX + (c.startBeat - p) * pxPerBeat - CARD_W / 2;
      const d = c.index === anchor ? Math.max(0, PARK_X - x) : 0;
      const tf = d > 0.5 ? `translateX(${d.toFixed(1)}px)` : '';
      if (el.style.transform !== tf) el.style.transform = tf;
    }
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

        {hits.map((h) => (
          <i key={`h${h.beat}`} className={`hit h-${h.dir}`} style={{ left: h.beat * pxPerBeat }}>
            {h.dir === 'D' ? '↓' : h.dir === 'U' ? '↑' : '×'}
          </i>
        ))}

        {cards.map((c) => {
          // 採点はゲートを通過したカードに直接出す。結果が付いたカードは薄くしない
          const v = verdicts.get(c.index);
          const state =
            c.index === anchor ? ' played' : c.index < anchor ? ' past' : c.index === anchor + 1 ? ' due' : '';
          return (
            <div
              key={c.index}
              ref={(el) => {
                cardEls.current.set(c.index, el);
                if (!el) cardEls.current.delete(c.index);
              }}
              className={`ct${state}${v ? ` judged j-${v.tone}` : ''}`}
              style={{ left: c.startBeat * pxPerBeat - CARD_W / 2, width: CARD_W }}
            >
              <FretMini chord={c.chord} w={42} />
              <span className="nm">{c.chord}</span>
              {v && (
                <span className="vd">
                  {v.mark && `${v.mark} `}
                  {v.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
