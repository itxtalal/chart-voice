import { useState } from 'react'
import { compare } from '../api/client'
import type { AnalyzeResponse, CompareResponse } from '../api/types'
import { useAnnounce } from './Announcer'

export default function ComparePanel({ image, result }: { image: File; result: AnalyzeResponse }) {
  const [data, setData] = useState<CompareResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const announce = useAnnounce()

  async function run() {
    if (busy) return
    setBusy(true)
    setError(null)
    announce('Getting a generic AI description.')
    try {
      const res = await compare(image)
      setData(res)
      announce('Comparison ready. Generic description and ChartVoice summary are shown side by side.')
    } catch (err) {
      setError(`Could not run the comparison. ${err instanceof Error ? err.message : ''}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={run} aria-disabled={busy}>
        {busy ? 'Comparing...' : data ? 'Run comparison again' : 'Run comparison'}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data && (
        <div className="compare">
          <div className="compare-col">
            <h4>Generic AI description</h4>
            <p>{data.description}</p>
            <p className="muted small">No table, no exact numbers, nothing to check against.</p>
          </div>
          <div className="compare-col ours">
            <h4>ChartVoice</h4>
            <p>{result.summary}</p>
            <p className="muted small">Numbers come from the extracted table, which you can check above.</p>
          </div>
        </div>
      )}
    </>
  )
}
