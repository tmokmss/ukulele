import type { MouseEvent } from 'react';

type Props = {
  running: boolean;
  paused: boolean;
  /** 練習を始める / 終える */
  onToggle: () => void;
  /** 一時停止 / 再開 */
  onPause: () => void;
  /** コード単位で動かす */
  onSeek: (delta: number) => void;
  /** バーをつまんでいるあいだ (動いていれば止めておく) */
  onScrub: (slot: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  /** いま何コード目か。練習していなければ -1 */
  slot: number;
  /** 全部で何コードか。終わりが決まっていなければ null */
  total: number | null;
};

/**
 * 練習の再生まわり。始める・止める・一時停止・位置を動かす。
 *
 * マウスやタップで押したときだけフォーカスを外す。押したボタンにフォーカスが残ると、
 * 続けて押したスペースがそのボタンに吸われて、一時停止のつもりが「止める」になるため。
 * キーボードで押したとき (detail が 0) は、そのまま残す。
 */
function press(fn: () => void) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail > 0) e.currentTarget.blur();
    fn();
  };
}

export function Transport({
  running,
  paused,
  onToggle,
  onPause,
  onSeek,
  onScrub,
  onScrubStart,
  onScrubEnd,
  slot,
  total,
}: Props) {
  const at = Math.max(0, slot);

  return (
    <section className="transport" aria-label="練習の操作">
      <button type="button" className={running ? 'btn-main stop' : 'btn-main'} onClick={press(onToggle)}>
        {running ? '止める' : '練習を始める'}
      </button>

      <div className="tp-row">
        <button type="button" className="btn-sub" disabled={!running} onClick={press(() => onSeek(-1))}>
          ◀ 1つ前
        </button>
        <button
          type="button"
          className={paused ? 'btn-sub wide on' : 'btn-sub wide'}
          disabled={!running}
          onClick={press(onPause)}
        >
          {paused ? '再開' : '一時停止'}
        </button>
        <button type="button" className="btn-sub" disabled={!running} onClick={press(() => onSeek(1))}>
          1つ先 ▶
        </button>
      </div>

      {total != null && (
        <div className="tp-seek">
          <input
            type="range"
            aria-label="練習する位置"
            min={0}
            max={Math.max(0, total - 1)}
            step={1}
            value={Math.min(at, total - 1)}
            disabled={!running}
            onPointerDown={onScrubStart}
            onPointerUp={onScrubEnd}
            onPointerCancel={onScrubEnd}
            onChange={(e) => onScrub(+e.target.value)}
          />
          <output>{running ? `${at + 1} / ${total}` : `全 ${total}`}</output>
        </div>
      )}

      <p className="note">スペースで一時停止と再開、← → でコードを1つ動かせます。</p>
    </section>
  );
}
