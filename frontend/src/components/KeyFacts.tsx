import type { AnalyzeResponse } from '../api/types'
import { fmt, signed } from '../format'

export default function KeyFacts({ result }: { result: AnalyzeResponse }) {
  return (
    <>
      {result.facts.series.map((f) => (
        <div key={f.name} className="facts">
          {result.facts.series.length > 1 && <h4>{f.name}</h4>}
          <dl>
            <div>
              <dt>Highest</dt>
              <dd>
                {f.max.label}: <strong>{fmt(f.max.value)}</strong>
              </dd>
            </div>
            <div>
              <dt>Lowest</dt>
              <dd>
                {f.min.label}: <strong>{fmt(f.min.value)}</strong>
              </dd>
            </div>
            {result.chart_type !== 'pie' && (
              <>
                <div>
                  <dt>Start to end</dt>
                  <dd>
                    {fmt(f.first.value)} to {fmt(f.last.value)} ({signed(f.change_abs)}, {signed(f.change_pct)}%)
                  </dd>
                </div>
                <div>
                  <dt>Trend</dt>
                  <dd className="cap">{f.trend}</dd>
                </div>
                {f.biggest_rise && (
                  <div>
                    <dt>Biggest rise</dt>
                    <dd>
                      {f.biggest_rise.from} to {f.biggest_rise.to} ({signed(f.biggest_rise.change)})
                    </dd>
                  </div>
                )}
                {f.biggest_drop && (
                  <div>
                    <dt>Biggest drop</dt>
                    <dd>
                      {f.biggest_drop.from} to {f.biggest_drop.to} ({signed(f.biggest_drop.change)})
                    </dd>
                  </div>
                )}
              </>
            )}
            <div>
              <dt>Total</dt>
              <dd>{fmt(f.total)}</dd>
            </div>
          </dl>
          {f.shares && (
            <>
              <h4>Shares of the total</h4>
              <ul className="shares">
                {f.shares.map((s) => (
                  <li key={s.label}>
                    <span>{s.label}</span>
                    <span className="bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, s.percent)}%` }} />
                    </span>
                    <strong>{fmt(s.percent)}%</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
    </>
  )
}
