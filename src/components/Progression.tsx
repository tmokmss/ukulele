import { LIB, PRESETS } from '../core/chords';

type Props = {
  prog: string[];
  onChange: (prog: string[]) => void;
  disabled: boolean;
};

const MAX_LEN = 8;

export function Progression({ prog, onChange, disabled }: Props) {
  const key = prog.join(',');
  const presetIdx = PRESETS.findIndex((p) => p.join(',') === key);

  return (
    <section className="block" aria-label="コード進行">
      <h2>コード進行</h2>
      <select
        aria-label="よく使う進行から選ぶ"
        value={presetIdx >= 0 ? String(presetIdx) : 'custom'}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value !== 'custom') onChange([...PRESETS[+e.target.value]]);
        }}
      >
        {PRESETS.map((p, i) => (
          <option key={i} value={String(i)}>
            {p.join(' → ')}
          </option>
        ))}
        <option value="custom">自分で組んだ進行</option>
      </select>

      <div className="chips">
        {prog.map((c, i) => (
          <span key={`${c}-${i}`} style={{ display: 'contents' }}>
            {i > 0 && <span className="sep">→</span>}
            <button
              type="button"
              className="chip in"
              aria-label={`${c} を進行から外す`}
              disabled={disabled}
              onClick={() => {
                if (prog.length > 1) onChange(prog.filter((_, j) => j !== i));
              }}
            >
              {c}
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
      </div>
      <p className="sub">タップして進行に足す</p>

      <div className="chips">
        {LIB.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            disabled={disabled}
            onClick={() => {
              if (prog.length < MAX_LEN) onChange([...prog, c]);
            }}
          >
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
