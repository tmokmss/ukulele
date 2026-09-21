import type { HistoryEntry } from '../core/types';

const SPARK_POINTS = 14;
const LIST_ROWS = 8;

export function HistoryPanel({ history, onClear }: { history: HistoryEntry[]; onClear: () => void }) {
  if (!history.length) {
    return (
      <section className="block" aria-label="これまでの記録">
        <h2>これまでの記録</h2>
        <p className="empty">まだ記録がありません。1回練習するとここに残ります。</p>
      </section>
    );
  }

  const pts = history.filter((x) => x.meanAbs != null).slice(-SPARK_POINTS);
  const xy =
    pts.length >= 2
      ? (() => {
          const mx = Math.max(60, ...pts.map((p) => p.meanAbs!));
          return pts.map((p, i) => [6 + i * (288 / (pts.length - 1)), 48 - (p.meanAbs! / mx) * 40] as const);
        })()
      : null;

  return (
    <section className="block" aria-label="これまでの記録">
      <h2>これまでの記録</h2>
      {xy && (
        <>
          <svg className="spark" viewBox="0 0 300 54" preserveAspectRatio="none" role="img" aria-label="平均ズレの推移">
            <polyline points={xy.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} />
            <circle cx={xy[xy.length - 1][0].toFixed(1)} cy={xy[xy.length - 1][1].toFixed(1)} r={3.5} />
          </svg>
          <p className="note" style={{ marginTop: 2 }}>
            平均ズレの推移。下がるほど良い。
          </p>
        </>
      )}
      <ul className="list">
        {history
          .slice(-LIST_ROWS)
          .reverse()
          .map((x) => {
            const d = new Date(x.ts);
            return (
              <li key={x.ts}>
                <span>
                  <b>{x.title ?? x.prog.split(' ').join(' → ')}</b> {x.bpm}BPM
                </span>
                <span>
                  {x.okRate}% / {x.meanAbs == null ? '…' : `${x.meanAbs}ms`}　{d.getMonth() + 1}/{d.getDate()}
                </span>
              </li>
            );
          })}
      </ul>
      <div className="row">
        <button type="button" className="btn-sub" onClick={onClear}>
          記録を消す
        </button>
      </div>
    </section>
  );
}
