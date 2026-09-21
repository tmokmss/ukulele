import type { SourceKind } from '../core/types';

type Props = {
  source: SourceKind;
  message: string | null;
  warn: boolean;
  disabled: boolean;
  onRetry: () => void;
};

/**
 * マイクの調子が悪いときだけ出る。
 * つながって動いているあいだは何も言わない (鳴っているかはレーンの点とチューナーが見せている)。
 */
export function MicStatus({ source, message, warn, disabled, onRetry }: Props) {
  const connected = source === 'mic';
  if (connected && !message) return null;

  return (
    <section className="source" aria-label="マイク">
      {!connected && (
        <div className="source-row">
          <button type="button" className="btn-sub" disabled={disabled} onClick={onRetry}>
            マイクを使う
          </button>
        </div>
      )}
      {message && <p className={warn ? 'note warn' : 'note'}>{message}</p>}
    </section>
  );
}
