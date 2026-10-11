// Sample charts drawn to PNG in the browser, so the demo needs no image files.

export interface Sample {
  id: string
  name: string
  type: 'bar' | 'line' | 'pie'
  title: string
  labelColumn: string
  valueColumn: string
  data: [string, number][]
}

export const SAMPLES: Sample[] = [
  {
    id: 'bar',
    name: 'Bar chart: monthly sales',
    type: 'bar',
    title: 'Monthly sales 2025',
    labelColumn: 'Month',
    valueColumn: 'Sales',
    data: [['Jan', 20], ['Feb', 25], ['Mar', 40], ['Apr', 38], ['May', 55]],
  },
  {
    id: 'line',
    name: 'Line chart: website visitors',
    type: 'line',
    title: 'Weekly website visitors (thousands)',
    labelColumn: 'Week',
    valueColumn: 'Visitors',
    data: [['W1', 12], ['W2', 18], ['W3', 15], ['W4', 22], ['W5', 30], ['W6', 27], ['W7', 34]],
  },
  {
    id: 'pie',
    name: 'Pie chart: phone market share',
    type: 'pie',
    title: 'Phone market share',
    labelColumn: 'Brand',
    valueColumn: 'Share',
    data: [['Alpha', 42], ['Beta', 28], ['Gamma', 18], ['Other', 12]],
  },
]

const PALETTE = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5']

export async function drawSample(sample: Sample): Promise<File> {
  const W = 640
  const H = 400
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#222'
  ctx.font = 'bold 20px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(sample.title, W / 2, 34)
  ctx.font = '14px sans-serif'

  const values = sample.data.map((d) => d[1])
  const max = Math.max(...values)

  if (sample.type === 'pie') {
    const total = values.reduce((a, b) => a + b, 0)
    let angle = -Math.PI / 2
    sample.data.forEach(([label, v], i) => {
      const slice = (v / total) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(260, 215)
      ctx.arc(260, 215, 150, angle, angle + slice)
      ctx.fillStyle = PALETTE[i % PALETTE.length]
      ctx.fill()
      angle += slice
      ctx.fillStyle = PALETTE[i % PALETTE.length]
      ctx.fillRect(460, 120 + i * 32, 18, 18)
      ctx.fillStyle = '#222'
      ctx.textAlign = 'left'
      ctx.fillText(`${label} ${v}%`, 486, 134 + i * 32)
    })
  } else {
    const left = 60
    const bottom = 350
    const plotH = 270
    const step = (W - left - 40) / sample.data.length
    ctx.strokeStyle = '#999'
    ctx.beginPath()
    ctx.moveTo(left, 70)
    ctx.lineTo(left, bottom)
    ctx.lineTo(W - 20, bottom)
    ctx.stroke()
    const points: [number, number][] = []
    sample.data.forEach(([label, v], i) => {
      const cx = left + step * i + step / 2
      const h = (v / max) * plotH
      ctx.textAlign = 'center'
      ctx.fillStyle = '#222'
      ctx.fillText(label, cx, bottom + 20)
      if (sample.type === 'bar') {
        ctx.fillStyle = PALETTE[0]
        ctx.fillRect(cx - step * 0.3, bottom - h, step * 0.6, h)
        ctx.fillStyle = '#222'
        ctx.fillText(String(v), cx, bottom - h - 6)
      } else {
        points.push([cx, bottom - h])
      }
    })
    if (sample.type === 'line') {
      ctx.strokeStyle = PALETTE[0]
      ctx.lineWidth = 3
      ctx.beginPath()
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.stroke()
      points.forEach(([x, y], i) => {
        ctx.fillStyle = PALETTE[0]
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#222'
        ctx.fillText(String(sample.data[i][1]), x, y - 12)
      })
    }
  }

  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
  return new File([blob], `sample-${sample.id}.png`, { type: 'image/png' })
}
