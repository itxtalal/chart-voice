// Fake backend for demo mode. Builds responses from the sample charts using
// the same shape as the real API, so the UI code is identical in both modes.
import type {
  AnalyzeResponse,
  AskRequest,
  AskResponse,
  CompareResponse,
  SeriesFacts,
  Trend,
} from './types'
import { SAMPLES, type Sample } from '../sampleChart'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function factsFor(name: string, data: [string, number][], pie: boolean): SeriesFacts {
  const vals = data.map((d) => d[1])
  const at = (i: number) => ({ label: data[i][0], value: vals[i] })
  const maxI = vals.indexOf(Math.max(...vals))
  const minI = vals.indexOf(Math.min(...vals))
  let rise: SeriesFacts['biggest_rise'] = null
  let drop: SeriesFacts['biggest_drop'] = null
  let ups = 0
  let downs = 0
  for (let i = 1; i < vals.length; i++) {
    const c = vals[i] - vals[i - 1]
    if (c > 0) ups++
    if (c < 0) downs++
    if (c > 0 && (!rise || c > rise.change)) rise = { from: data[i - 1][0], to: data[i][0], change: c }
    if (c < 0 && (!drop || c < drop.change)) drop = { from: data[i - 1][0], to: data[i][0], change: c }
  }
  const first = vals[0]
  const last = vals[vals.length - 1]
  const trend: Trend =
    downs === 0 && ups > 0 ? 'increasing' : ups === 0 && downs > 0 ? 'decreasing' : ups === 0 && downs === 0 ? 'flat' : last > first ? 'increasing' : last < first ? 'decreasing' : 'mixed'
  const total = vals.reduce((a, b) => a + b, 0)
  return {
    name,
    max: at(maxI),
    min: at(minI),
    first: at(0),
    last: at(vals.length - 1),
    change_abs: last - first,
    change_pct: first ? Math.round(((last - first) / first) * 1000) / 10 : 0,
    trend,
    biggest_rise: pie ? null : rise,
    biggest_drop: pie ? null : drop,
    total,
    shares: pie ? data.map(([label, v]) => ({ label, percent: Math.round((v / total) * 1000) / 10 })) : null,
  }
}

function summaryFor(s: Sample, f: SeriesFacts): { summary: string; explanation: string } {
  if (s.type === 'pie') {
    const top = f.shares![0]
    return {
      summary: `${f.max.label} has the largest share at ${f.max.value}%. ${f.min.label} has the smallest at ${f.min.value}%. ${top.label} alone is ${top.percent}% of the total.`,
      explanation: `This pie chart splits the whole into ${s.data.length} parts. ${f.max.label} is clearly the biggest part, larger than the next one by ${f.max.value - [...s.data].sort((a, b) => b[1] - a[1])[1][1]} points.`,
    }
  }
  const dir = f.change_abs >= 0 ? 'rose' : 'fell'
  const parts = [
    `${f.name} ${dir} from ${f.first.value} in ${f.first.label} to ${f.last.value} in ${f.last.label}.`,
    `The highest was ${f.max.label} (${f.max.value}) and the lowest was ${f.min.label} (${f.min.value}).`,
  ]
  if (f.biggest_rise) parts.push(`The biggest jump was from ${f.biggest_rise.from} to ${f.biggest_rise.to} (+${f.biggest_rise.change}).`)
  return {
    summary: parts.join(' '),
    explanation: `This ${s.type} chart shows ${f.name.toLowerCase()} over time. Overall the trend is ${f.trend}${
      f.biggest_drop ? `, with a dip from ${f.biggest_drop.from} to ${f.biggest_drop.to} (${f.biggest_drop.change})` : ''
    }.`,
  }
}

function sampleFromFile(file: File): Sample {
  const id = file.name.match(/^sample-(\w+)\.png$/)?.[1]
  return SAMPLES.find((s) => s.id === id) ?? SAMPLES[0]
}

export async function mockAnalyze(file: File): Promise<AnalyzeResponse> {
  await wait(1400)
  const s = sampleFromFile(file)
  const f = factsFor(s.valueColumn, s.data, s.type === 'pie')
  return {
    chart_type: s.type,
    title: s.title,
    table: { columns: [s.labelColumn, s.valueColumn], rows: s.data.map(([l, v]) => [l, v]) },
    facts: { series: [f] },
    ...summaryFor(s, f),
    text_source: 'llm',
    extractor: 'vision',
    warnings: [],
    timing_ms: { extract: 1200, llm: 200, total: 1400 },
  }
}

export async function mockAsk(req: AskRequest): Promise<AskResponse> {
  await wait(700)
  const q = req.question.toLowerCase()
  const f = req.facts.series[0]
  if (!f || /weather|president|recipe|joke|capital of/.test(q)) {
    return { answer: 'Sorry, I can only answer questions about this chart.', on_topic: false }
  }
  if (/high|most|max|largest|biggest share/.test(q)) return { answer: `The highest is ${f.max.label}, with ${f.max.value}.`, on_topic: true }
  if (/low|least|min|smallest/.test(q)) return { answer: `The lowest is ${f.min.label}, with ${f.min.value}.`, on_topic: true }
  if (/trend|overall|going/.test(q)) return { answer: `Overall the trend is ${f.trend}, from ${f.first.value} to ${f.last.value}.`, on_topic: true }
  if (/increase|jump|rise|grow/.test(q) && f.biggest_rise)
    return { answer: `The biggest increase was from ${f.biggest_rise.from} to ${f.biggest_rise.to}, +${f.biggest_rise.change}.`, on_topic: true }
  if (/drop|fall|decrease|dip/.test(q) && f.biggest_drop)
    return { answer: `The biggest drop was from ${f.biggest_drop.from} to ${f.biggest_drop.to}, ${f.biggest_drop.change}.`, on_topic: true }
  if (/total|sum|altogether/.test(q)) return { answer: `The total is ${f.total}.`, on_topic: true }
  return { answer: `In demo mode I can answer about the highest, lowest, trend, biggest change and total. The highest is ${f.max.label} (${f.max.value}).`, on_topic: true }
}

export async function mockCompare(file: File): Promise<CompareResponse> {
  await wait(900)
  const s = sampleFromFile(file)
  return {
    description: `The image shows a ${s.type} chart titled "${s.title}". The values seem to change across the categories, and one of them looks noticeably larger than the others.`,
    model: 'demo-vision-model',
    timing_ms: 900,
  }
}
