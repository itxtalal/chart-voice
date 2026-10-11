// Turns screen text into text that sounds natural when spoken.

// Split on sentence ends followed by a space, so decimals like 1.5 stay whole.
// Abbreviations like "e.g." and "vs." don't end a sentence.
export function splitSentences(text: string): string[] {
  const out: string[] = []
  for (const part of text.split(/(?<=[.!?])\s+/)) {
    const s = part.trim()
    if (!s) continue
    if (out.length && /\b(e\.g|i\.e|etc|vs|approx|incl|no)\.$/i.test(out[out.length - 1])) out[out.length - 1] += ` ${s}`
    else out.push(s)
  }
  return out
}

const MONTHS: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', Jun: 'June', Jul: 'July',
  Aug: 'August', Sep: 'September', Sept: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
}

export function speakable(s: string): string {
  return (
    s
      // "(+17)" and "(-2%)" become "up 17" and "down 2 percent"
      .replace(/\(\s*([+\-−])\s?([\d.,]+)\s*(%?)\s*\)/g, (_, sign: string, n: string, pct: string) =>
        `, ${sign === '+' ? 'up' : 'down'} ${n}${pct ? ' percent' : ''},`,
      )
      .replace(/(^|[\s(,])\+(\d)/g, '$1plus $2')
      .replace(/(^|[\s(,])[-−](\d)/g, '$1minus $2')
      .replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/g, (m) => MONTHS[m] ?? m)
      .replace(/\bW(\d+)\b/g, 'week $1')
      .replace(/\bQ([1-4])\b/g, 'quarter $1')
      .replace(/\bvs\.?(?=\s)/gi, 'versus')
      .replace(/\be\.g\.,?/gi, 'for example')
      .replace(/\bi\.e\.,?/gi, 'that is')
      .replace(/(\d)\s?k\b/g, '$1 thousand')
      .replace(/(\d)\s?M\b/g, '$1 million')
      .replace(/(\d)\s?B\b/g, '$1 billion')
      .replace(/(\d)\s?%/g, '$1 percent')
      // Other brackets become short pauses
      .replace(/\s*\(\s*/g, ', ')
      .replace(/\s*\)\s*/g, ', ')
      .replace(/\s+,/g, ',')
      .replace(/,\s*,/g, ',')
      .replace(/,\s*([.!?:;]|$)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  )
}
