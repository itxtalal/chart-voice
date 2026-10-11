import { useId, useMemo, useState } from 'react'
import type { AnalyzeResponse } from '../../api/types'
import { fmt } from '../../format'
import { useAnnounce } from '../Announcer'
import { useTones } from './useTones'

// Arrow keys move point by point; each point is spoken by the screen reader
// and, optionally, played as a tone. The whole series can be played as sound.
export default function ChartExplorer({ result }: { result: AnalyzeResponse }) {
  const { table, chart_type } = result
  const seriesNames = table.columns.slice(1)
  const [series, setSeries] = useState(0)
  const [index, setIndex] = useState(0)
  const [soundOnMove, setSoundOnMove] = useState(true)
  const announce = useAnnounce()
  const { playOne, playAll, stopAll, playingIndex } = useTones()
  const helpId = useId()

  const labels = table.rows.map((r) => String(r[0]))
  const values = useMemo(
    () => table.rows.map((r) => (typeof r[series + 1] === 'number' ? (r[series + 1] as number) : null)),
    [table, series],
  )
  const nums = values.filter((v): v is number => v !== null)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const total = nums.reduce((a, b) => a + b, 0)

  function describe(i: number) {
    const v = values[i]
    const parts = [`${labels[i]}, ${fmt(v)}.`]
    if (v !== null) {
      if (chart_type === 'pie' && total) parts.push(`${fmt(Math.round((v / total) * 1000) / 10)} percent of the total.`)
      if (v === max) parts.push('Highest.')
      if (v === min) parts.push('Lowest.')
      const prev = values[i - 1]
      if (chart_type !== 'pie' && i > 0 && prev !== null && prev !== undefined) {
        const d = v - prev
        parts.push(d === 0 ? `Same as ${labels[i - 1]}.` : `${d > 0 ? 'Up' : 'Down'} ${fmt(Math.abs(d))} from ${labels[i - 1]}.`)
      }
    }
    parts.push(`Point ${i + 1} of ${values.length}.`)
    return parts.join(' ')
  }

  function go(i: number) {
    const next = Math.max(0, Math.min(values.length - 1, i))
    setIndex(next)
    announce(describe(next), 'assertive')
    if (soundOnMove) playOne(values[next], min, max)
  }

  function onKey(e: React.KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowRight: () => go(index + 1),
      ArrowLeft: () => go(index - 1),
      Home: () => go(0),
      End: () => go(values.length - 1),
      Enter: () => playOne(values[index], min, max),
      ' ': () => playOne(values[index], min, max),
      p: () => playAll(values, min, max),
      P: () => playAll(values, min, max),
      Escape: () => stopAll(),
      ArrowUp: () => switchSeries(series - 1),
      ArrowDown: () => switchSeries(series + 1),
    }
    const fn = keys[e.key]
    if (fn) {
      e.preventDefault()
      fn()
    }
  }

  function switchSeries(s: number) {
    if (seriesNames.length < 2) return
    const next = (s + seriesNames.length) % seriesNames.length
    setSeries(next)
    announce(`Series ${seriesNames[next]}.`, 'assertive')
  }

  const current = playingIndex ?? index

  return (
    <div className="explorer">
      <div
        className="explorer-pad"
        role="application"
        tabIndex={0}
        aria-roledescription="chart explorer"
        aria-label={`${result.title}. ${seriesNames[series]}, ${values.length} points. Use left and right arrows to move.`}
        aria-describedby={helpId}
        onKeyDown={onKey}
        onFocus={() => announce(describe(index), 'polite')}
      >
        <div className="readout" aria-hidden="true">
          <span className="readout-label">{labels[current]}</span>
          <span className="readout-value">{fmt(values[current])}</span>
        </div>
        <ol className="strip" aria-hidden="true">
          {values.map((v, i) => (
            <li
              key={i}
              className={i === current ? 'on' : ''}
              onClick={() => go(i)}
            >
              <span className="strip-bar" style={{ height: v === null || max === 0 ? '4%' : `${Math.max(6, (v / max) * 100)}%` }} />
              <span className="strip-label">{labels[i]}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="touch-hint small" aria-hidden="true">
        Tap a bar to hear its value.
      </p>
      <div id={helpId} className="keys">
        <p className="small"><strong>Click the box above or Tab to it, then use:</strong></p>
        <ul className="small">
          <li><kbd>Left</kbd> <kbd>Right</kbd> move between points</li>
          <li><kbd>Home</kbd> <kbd>End</kbd> first or last point</li>
          <li><kbd>Enter</kbd> hear the current point as a tone</li>
          <li><kbd>P</kbd> play the whole chart as sound, <kbd>Esc</kbd> stop</li>
          {seriesNames.length > 1 && <li><kbd>Up</kbd> <kbd>Down</kbd> switch series</li>}
        </ul>
      </div>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => playAll(values, min, max)}>
          Play chart as sound
        </button>
        <button type="button" className="btn btn-ghost" onClick={stopAll}>
          Stop sound
        </button>
        <label className="check">
          <input type="checkbox" checked={soundOnMove} onChange={(e) => setSoundOnMove(e.target.checked)} />
          Play a tone when moving
        </label>
        {seriesNames.length > 1 && (
          <label className="field">
            <span>Series</span>
            <select value={series} onChange={(e) => switchSeries(Number(e.target.value))}>
              {seriesNames.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="muted small">
        Higher values play higher notes. Missing values play a short low click.
      </p>
    </div>
  )
}
