import { useEffect, useRef } from 'react';
import type { TrainerEngine } from '../audio/engine';
import { NOTE, OPEN, STRING_NAME } from '../core/chords';
import { nearestString, noteName, TUNE_OK_CENTS } from '../core/pitch';
import { describeTuning } from '../core/report';
import { useFrame } from '../hooks/useEngine';

/** 針が振り切れるズレ (セント) */
const SPAN = 50;
/** 音が消えてから表示を残す時間 (ms)。弦が減衰するたび消えると読めない */
const HOLD_MS = 900;
/** これ以上跳んだら弦を持ち替えたとみなし、平滑化せず追いつく (半音) */
const JUMP = 0.7;

const WAITING = '弦を1本ずつ鳴らしてください。';
const NO_MIC = 'マイクにつながっていません。';

/**
 * 開放弦のチューナー。いちばん近い弦を指して、ズレをセントで出す。
 * 毎フレーム動くので、値はすべて ref 経由で DOM に直接書く。
 */
export function Tuner({ engine, connected }: { engine: TrainerEngine; connected: boolean }) {
  const chips = useRef<(HTMLElement | null)[]>([]);
  const note = useRef<HTMLElement>(null);
  const cents = useRef<HTMLElement>(null);
  const pin = useRef<HTMLElement>(null);
  const msg = useRef<HTMLParagraphElement>(null);
  /** 平滑化した音の高さ (MIDI)。鳴っていなければ null */
  const held = useRef<number | null>(null);
  const heldAt = useRef(0);

  // 音程の検出はここを開いているあいだだけ回す
  useEffect(() => engine.enableTuner(), [engine]);
  // 文字はすべて paint が書く。マイクが無いあいだはフレームが来ないので、ここから一度書く
  useEffect(() => {
    paint(held.current);
  }, [connected]);

  useFrame(engine, (f) => {
    const now = performance.now();
    if (f.pitch) {
      const m = f.pitch.midi;
      const prev = held.current;
      held.current = prev == null || Math.abs(m - prev) > JUMP ? m : prev + 0.3 * (m - prev);
      heldAt.current = now;
    } else if (held.current != null && now - heldAt.current > HOLD_MS) {
      held.current = null;
    }
    paint(held.current);
  });

  const paint = (midi: number | null): void => {
    const t = midi == null ? null : nearestString(midi);
    for (let i = 0; i < OPEN.length; i++) {
      const on = t?.index === i;
      setClass(chips.current[i], on ? (Math.abs(t!.cents) <= TUNE_OK_CENTS ? 'on ok' : 'on') : '');
    }

    setText(note.current, midi == null ? '—' : noteName(midi));
    setText(cents.current, t == null ? '' : `${t.cents > 0 ? '+' : ''}${Math.round(t.cents)} セント`);

    const d = describeTuning(t?.cents ?? 0);
    setText(msg.current, !connected ? NO_MIC : midi == null ? WAITING : t == null ? 'どの弦からも離れています。' : d.text);
    setClass(msg.current, `tmsg ${t == null || midi == null ? '' : d.tone}`);

    if (pin.current) {
      const x = t == null ? 0 : Math.max(-SPAN, Math.min(SPAN, t.cents));
      pin.current.style.left = `${50 + (x / SPAN) * 50}%`;
      pin.current.style.opacity = t == null ? '0' : '1';
      setClass(pin.current, `pin ${d.tone}`);
    }
  };

  return (
    <section className="block" aria-label="ウクレレのチューニング">
      <h2>ウクレレのチューニング</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        4弦から順に1本ずつ鳴らして、針をまん中に合わせます。
      </p>

      <div className="tstr">
        {STRING_NAME.map((name, i) => (
          <div
            key={name}
            ref={(el) => {
              chips.current[i] = el;
            }}
          >
            {name}
            <b>{NOTE[OPEN[i] % 12]}</b>
          </div>
        ))}
      </div>

      <p className="treading">
        <b ref={note} />
        <span ref={cents} />
      </p>

      <div className="tneedle">
        <span className="zone" />
        <span className="mid" />
        <i className="pin" ref={pin} style={{ opacity: 0, left: '50%' }} />
        <span className="end lo">低い</span>
        <span className="end hi">高い</span>
      </div>

      <p className="tmsg" ref={msg} />
    </section>
  );
}

function setText(el: HTMLElement | null, s: string): void {
  if (el && el.textContent !== s) el.textContent = s;
}

function setClass(el: HTMLElement | null, s: string): void {
  const v = s.trim();
  if (el && el.className !== v) el.className = v;
}
