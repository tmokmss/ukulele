export type SegOption<T> = { value: T; label: string };

type Props<T> = {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  label?: string;
};

/** 択一のピル型スイッチ。押されている側を aria-pressed で示す */
export function Segmented<T extends string | number | boolean>({ options, value, onChange, disabled, label }: Props<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
