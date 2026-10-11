// Mirrors docs/api-contract.md. Change only by agreement with the team.

export type ChartType = 'auto' | 'bar' | 'line' | 'pie'
export type Trend = 'increasing' | 'decreasing' | 'flat' | 'mixed'

export interface Table {
  columns: string[]
  // First cell is a label, the rest are numbers or null
  rows: (string | number | null)[][]
}

export interface LabeledValue {
  label: string
  value: number
}

export interface Change {
  from: string
  to: string
  change: number
}

export interface SeriesFacts {
  name: string
  max: LabeledValue
  min: LabeledValue
  first: LabeledValue
  last: LabeledValue
  change_abs: number
  change_pct: number
  trend: Trend
  biggest_rise: Change | null
  biggest_drop: Change | null
  total: number
  shares: { label: string; percent: number }[] | null
}

export interface Facts {
  series: SeriesFacts[]
}

export type WarningCode =
  | 'parse_failed'
  | 'missing_values'
  | 'non_numeric'
  | 'shares_not_100'
  | 'single_point'
  | 'complex_chart'
  | 'low_confidence'
  | 'extraction_truncated'
  | 'dual_axis'
  | 'values_estimated'
  | 'readings_disagree'
  | 'llm_unavailable'
  | 'llm_numbers_unverified'
  | (string & {}) // new codes may be added; show their message as-is

export interface Warning {
  code: WarningCode
  message: string
}

export interface AnalyzeResponse {
  chart_type: Exclude<ChartType, 'auto'>
  title: string
  table: Table
  facts: Facts
  summary: string
  explanation: string
  text_source: 'llm' | 'template'
  extractor: 'vision' | 'deplot'
  warnings: Warning[]
  timing_ms: { extract: number; llm: number; total: number }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AskRequest {
  question: string
  title: string
  chart_type: AnalyzeResponse['chart_type']
  table: Table
  facts: Facts
  history: ChatMessage[]
}

export interface AskResponse {
  answer: string
  on_topic: boolean
}

export interface CompareResponse {
  description: string
  model: string
  timing_ms: number
}
