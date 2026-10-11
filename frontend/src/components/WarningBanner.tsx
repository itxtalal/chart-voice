import type { Warning } from '../api/types'

export default function WarningBanner({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null
  return (
    <div className="warning" role="note" aria-labelledby="warn-h">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32">
        <path d="M12 3l10 18H2L12 3z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M12 10v5m0 3v.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <div>
        <h3 id="warn-h">Please double check these results</h3>
        <ul>
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`}>{w.message}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
