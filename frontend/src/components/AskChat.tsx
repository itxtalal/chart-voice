import { useId, useRef, useState } from 'react'
import { ask } from '../api/client'
import type { AnalyzeResponse, ChatMessage } from '../api/types'
import { useAnnounce } from './Announcer'
import ReadAloud from './voice/ReadAloud'

const SUGGESTIONS = ['What is the highest value?', 'What is the overall trend?', 'Where is the biggest change?']

export default function AskChat({ result }: { result: AnalyzeResponse }) {
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const announce = useAnnounce()
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  async function send(q: string) {
    q = q.trim()
    if (!q || busy) return
    setBusy(true)
    setError(null)
    announce('Thinking about your question.')
    try {
      const res = await ask({
        question: q,
        title: result.title,
        chart_type: result.chart_type,
        table: result.table,
        facts: result.facts,
        history: history.slice(-6),
      })
      setHistory((h) => [...h, { role: 'user', content: q }, { role: 'assistant', content: res.answer }])
      setQuestion('')
      announce(`Answer: ${res.answer}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setError(`Could not get an answer. ${msg}`)
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const lastAnswer = [...history].reverse().find((m) => m.role === 'assistant')

  return (
    <>
      {history.length > 0 && (
        <ol className="chat" aria-label="Conversation">
          {history.map((m, i) => (
            <li key={i} className={`bubble ${m.role}`}>
              <span className="who">{m.role === 'user' ? 'You asked' : 'ChartVoice'}</span>
              <span>{m.content}</span>
            </li>
          ))}
        </ol>
      )}
      {lastAnswer && <ReadAloud text={lastAnswer.content} label="Read answer aloud" />}

      <div className="suggestions" role="group" aria-label="Suggested questions">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => send(s)} aria-disabled={busy}>
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault()
          send(question)
        }}
      >
        <label htmlFor={inputId}>Your question</label>
        <div className="row">
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="For example: which month was lowest?"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" aria-disabled={busy || !question.trim()}>
            {busy ? 'Thinking...' : 'Ask'}
          </button>
        </div>
      </form>
    </>
  )
}
