import { Fragment, useMemo, useState } from 'react'
import type { AnalyzeResponse } from '../api/types'
import { fmt } from '../format'
import ReadAloud from './voice/ReadAloud'
import { splitSentences } from './voice/narration'

export default function SummaryPanel({ result }: { result: AnalyzeResponse }) {
  const [speaking, setSpeaking] = useState<number | null>(null)

  // Spoken script: a short intro, then the summary and explanation without repeated sentences
  const { script, summary, explanation } = useMemo(() => {
    const summary = splitSentences(result.summary)
    const seen = new Set(summary.map(norm))
    const explanation = splitSentences(result.explanation).filter((s) => !seen.has(norm(s)))
    const n = result.table.rows.length
    const intro = `${result.title}. A ${result.chart_type} chart with ${n} ${result.chart_type === 'pie' ? 'slices' : 'points'}.`
    return { script: [intro, ...summary, ...explanation], summary, explanation }
  }, [result])

  // Sentence i of the script is on screen at i - 1 (the intro is spoken only)
  const said = (i: number) => (speaking === i + 1 ? 'speaking' : undefined)

  return (
    <>
      <p className="lead">
        {summary.map((s, i) => (
          <Fragment key={i}>
            <span className={said(i)}>{s}</span>{' '}
          </Fragment>
        ))}
      </p>
      <QuickStats result={result} />
      {explanation.length > 0 && (
        <p>
          {explanation.map((s, i) => (
            <Fragment key={i}>
              <span className={said(summary.length + i)}>{s}</span>{' '}
            </Fragment>
          ))}
        </p>
      )}
      <ReadAloud text={script} label="Read summary aloud" onSentence={setSpeaking} />
      <p className="muted small source-note">
        {result.text_source === 'llm'
          ? 'Written by an AI model from the numbers it read. Numbers can be wrong.'
          : 'Built directly from the numbers read from your chart. Numbers can be wrong.'}{' '}
        {result.extractor === 'vision'
          ? 'Chart read by an online AI model.'
          : 'Chart read by the offline DePlot model on this computer.'}
      </p>
    </>
  )
}

// The three numbers most people want, big and at a glance. Single-series charts only.
function QuickStats({ result }: { result: AnalyzeResponse }) {
  if (result.facts.series.length !== 1) return null
  const f = result.facts.series[0]
  const pie = result.chart_type === 'pie' && f.shares?.length
  const top = pie ? [...f.shares!].sort((a, b) => b.percent - a.percent) : []

  const stats = pie
    ? [
        { label: 'Biggest share', value: `${fmt(top[0].percent)}%`, note: top[0].label },
        { label: 'Smallest share', value: `${fmt(top[top.length - 1].percent)}%`, note: top[top.length - 1].label },
        { label: 'Parts', value: String(top.length), note: 'slices in the pie' },
      ]
    : [
        { label: 'Highest', value: fmt(f.max.value), note: f.max.label },
        { label: 'Lowest', value: fmt(f.min.value), note: f.min.label },
        { label: 'Trend', value: cap(f.trend), note: `${fmt(f.first.value)} to ${fmt(f.last.value)}` },
      ]

  return (
    <dl className="stats">
      {stats.map((s) => (
        <div key={s.label} className="stat">
          <dt>{s.label}</dt>
          <dd>
            <span className="stat-value">{s.value}</span>
            <span className="stat-note">{s.note}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
