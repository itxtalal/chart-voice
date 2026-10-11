import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js/auto'
import type { Table } from '../../api/types'

interface Props {
  chartType: 'bar' | 'line' | 'pie'
  title: string
  table: Table
  theme: string // re-read colors when the theme changes
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export default function RedrawnChart({ chartType, title, table, theme }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const text = cssVar('--text')
    const grid = cssVar('--border-soft')
    const surface = cssVar('--surface')
    const colors = [1, 2, 3, 4, 5, 6].map((i) => cssVar(`--chart-${i}`))
    const scale = parseFloat(cssVar('--scale')) || 1
    const font = { size: Math.round(16 * scale), weight: 'bold' as const, family: 'Atkinson Hyperlegible, system-ui, sans-serif' }

    const labels = table.rows.map((r) => String(r[0]))
    const datasets = table.columns.slice(1).map((name, i) => {
      const data = table.rows.map((r) => (typeof r[i + 1] === 'number' ? (r[i + 1] as number) : null))
      const c = colors[i % colors.length]
      return chartType === 'pie'
        ? { label: name, data, backgroundColor: colors, borderColor: surface, borderWidth: 3 }
        : { label: name, data, backgroundColor: c, borderColor: c, borderWidth: 4, pointRadius: 6, pointBackgroundColor: c }
    })

    const chart = new Chart(ref.current, {
      type: chartType,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 28 } },
        plugins: {
          legend: { display: chartType === 'pie' || datasets.length > 1, labels: { font, color: text } },
          tooltip: { bodyFont: font, titleFont: font },
        },
        scales:
          chartType === 'pie'
            ? {}
            : {
                x: { ticks: { font, color: text }, grid: { color: grid } },
                y: { beginAtZero: true, ticks: { font, color: text }, grid: { color: grid } },
              },
      },
      plugins: [
        {
          id: 'valueLabels',
          afterDatasetsDraw(c) {
            const ctx = c.ctx
            ctx.save()
            ctx.font = `bold ${font.size}px ${font.family}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            c.data.datasets.forEach((ds, di) => {
              c.getDatasetMeta(di).data.forEach((el, i) => {
                const v = ds.data[i]
                if (v == null) return
                const { x, y } = el.tooltipPosition(false)
                if (x === null || y === null) return
                if (chartType === 'pie') {
                  ctx.textBaseline = 'middle'
                  ctx.lineWidth = 4
                  ctx.strokeStyle = surface
                  ctx.strokeText(String(v), x, y)
                  ctx.fillStyle = text
                  ctx.fillText(String(v), x, y)
                } else {
                  ctx.fillStyle = text
                  ctx.fillText(String(v), x, y - (chartType === 'line' ? 14 : 8))
                }
              })
            })
            ctx.restore()
          },
        },
      ],
    })
    return () => chart.destroy()
  }, [chartType, title, table, theme])

  return (
    <div className="chart-box">
      <canvas ref={ref} aria-hidden="true" />
    </div>
  )
}
