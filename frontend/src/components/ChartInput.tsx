import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ChartType } from '../api/types'
import { SAMPLES, drawSample } from '../sampleChart'

const MAX_BYTES = 10 * 1024 * 1024
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp']

interface Props {
  busy: boolean
  onAnalyze: (file: File, chartType: ChartType) => void
}

// Choosing a chart (upload, drop, paste or sample) starts reading it right away
export default function ChartInput({ busy, onAnalyze }: Props) {
  const [chartType, setChartType] = useState<ChartType>('auto')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const errId = useId()

  const choose = useCallback(
    (f: File | null | undefined) => {
      if (!f || busy) return
      if (!OK_TYPES.includes(f.type)) {
        setError('That file is not a PNG, JPG or WEBP image. Please choose a chart image.')
        return
      }
      if (f.size > MAX_BYTES) {
        setError('That image is larger than 10 MB. Please choose a smaller one.')
        return
      }
      setError(null)
      onAnalyze(f, chartType)
    },
    [busy, chartType, onAnalyze],
  )

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      if (item) choose(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [choose])

  return (
    <section aria-labelledby="step1" className="card step">
      <h2 id="step1">Add a chart</h2>
      <p className="intro" id={hintId}>
        Upload a picture of a bar, line or pie chart. We will read it and tell you what it says.
      </p>

      <button
        type="button"
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onClick={() => {
          if (!busy) inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          choose(e.dataTransfer.files[0])
        }}
        aria-disabled={busy}
        aria-describedby={`${hintId}${error ? ` ${errId}` : ''}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48" className="dz-icon">
          <path d="M12 16V4m0 0l-5 5m5-5l5 5M4 20h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="dz-label">Choose a chart image</span>
        <span className="dz-sub">or drag it here, or paste it</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={OK_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          choose(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {error && (
        <p role="alert" id={errId} className="error">
          {error}
        </p>
      )}

      <div className="samples" role="group" aria-labelledby="samples-h">
        <p id="samples-h" className="samples-label">
          No chart handy? Try one of ours:
        </p>
        <div className="sample-row">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              aria-disabled={busy}
              onClick={async () => choose(await drawSample(s))}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <details className="options">
        <summary>Options</summary>
        <label className="field">
          <span>Chart type</span>
          <select value={chartType} onChange={(e) => setChartType(e.target.value as ChartType)}>
            <option value="auto">Detect automatically</option>
            <option value="bar">Bar chart</option>
            <option value="line">Line chart</option>
            <option value="pie">Pie chart</option>
          </select>
        </label>
      </details>
    </section>
  )
}
