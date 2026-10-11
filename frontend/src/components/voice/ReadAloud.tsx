import { useEffect } from 'react'
import { useSpeech } from './useSpeech'

interface Props {
  // Plain text, or sentences when the page highlights along with `onSentence`
  text: string | string[]
  label?: string
  onSentence?: (i: number | null) => void
}

export default function ReadAloud({ text, label = 'Read aloud', onSentence }: Props) {
  const { supported, state, current, play, pause, resume, stop } = useSpeech()
  const key = Array.isArray(text) ? text.join('\n') : text

  useEffect(() => {
    stop()
  }, [key, stop])

  useEffect(() => {
    onSentence?.(current)
  }, [current, onSentence])

  if (!supported) {
    return <p className="muted small">Read aloud is not available in this browser.</p>
  }

  return (
    <div className="readaloud" role="group" aria-label={`${label} controls`}>
      {state === 'idle' && (
        <button type="button" className="btn btn-primary" onClick={() => play(text)}>
          <SpeakerIcon /> {label}
        </button>
      )}
      {state === 'playing' && (
        <button type="button" className="btn btn-primary" onClick={pause}>
          Pause reading
        </button>
      )}
      {state === 'paused' && (
        <button type="button" className="btn btn-primary" onClick={resume}>
          Resume reading
        </button>
      )}
      {state !== 'idle' && (
        <button type="button" className="btn btn-ghost" onClick={stop}>
          Stop
        </button>
      )}
      {state === 'idle' && <span className="muted small">Change the voice and speed in Settings.</span>}
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" className="icon">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
