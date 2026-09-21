import type { SessionSummary } from '../core/report';

type Props = { summary: SessionSummary | null; stopped: boolean };

export function SummaryPanel({ summary, stopped }: Props) {
  return (
    <section className="block" aria-label="今回の結果">
      <h2>今回の結果</h2>
      {!summary ? (
        <p className="empty">{stopped ? '1コードぶん弾き終わる前に止まりました。' : '練習が終わるとここに結果が出ます。'}</p>
      ) : (
        <>
          <div className="stats">
            <div>
              <b>
                {summary.okN}/{summary.total}
              </b>
              <span>コードが合った回数</span>
            </div>
            <div>
              <b>{summary.meanAbs == null ? '…' : `${Math.round(summary.meanAbs)}ms`}</b>
              <span>チェンジの平均ズレ</span>
            </div>
            <div>
              <b>{trendLabel(summary.median)}</b>
              <span>
                ズレの傾向
                {summary.median == null ? '' : ` (${summary.median > 0 ? '+' : ''}${Math.round(summary.median)}ms)`}
              </span>
            </div>
          </div>
          <ul className="list">
            {summary.perChord.map((p) => (
              <li key={p.chord}>
                <span>
                  <b>{p.chord}</b> {p.notes}
                </span>
                <span>
                  {p.ok}/{p.n}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function trendLabel(med: number | null): string {
  if (med == null) return '…';
  if (Math.abs(med) < 15) return 'ほぼ中央';
  return med > 0 ? '遅め' : '早め';
}
