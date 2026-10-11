import { useCallback, useEffect, useRef, useState } from 'react'
import { speakable, splitSentences } from './narration'
import { getVoicePrefs, resolveVoice, useVoicePrefs } from './voicePrefs'

export type SpeechState = 'idle' | 'playing' | 'paused'

// A voice that can't be set must never stop the reading; fall back to the browser default
function applyVoice(u: SpeechSynthesisUtterance, v: SpeechSynthesisVoice | null) {
  if (!v) return
  try {
    u.voice = v
    u.lang = v.lang
  } catch {
    // keep the default voice
  }
}

// Speak one line with the saved voice and speed, outside any player (used by "Test voice")
export function speakOnce(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  const { voiceURI, rate } = getVoicePrefs()
  synth.cancel()
  const u = new SpeechSynthesisUtterance(speakable(text))
  const v = resolveVoice(synth.getVoices(), voiceURI)
  applyVoice(u, v)
  u.rate = rate
  synth.speak(u)
}

// Speaks text one sentence at a time. Long utterances get cut off in some
// browsers, and pause is unreliable, so we track the sentence index ourselves.
// `current` is the sentence being spoken, so the page can highlight it.
export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [state, setState] = useState<SpeechState>('idle')
  const [current, setCurrent] = useState<number | null>(null)
  const { voiceURI, rate } = useVoicePrefs()
  const sentences = useRef<string[]>([])
  const index = useRef(0)
  const runId = useRef(0)

  const speakFrom = useCallback((from: number) => {
    const synth = window.speechSynthesis
    const id = ++runId.current
    synth.cancel()
    index.current = from
    const next = () => {
      if (id !== runId.current) return
      if (index.current >= sentences.current.length) {
        setState('idle')
        setCurrent(null)
        return
      }
      const { voiceURI, rate } = getVoicePrefs()
      const u = new SpeechSynthesisUtterance(speakable(sentences.current[index.current]))
      const v = resolveVoice(synth.getVoices(), voiceURI)
      applyVoice(u, v)
      u.rate = rate
      u.onstart = () => {
        if (id === runId.current) setCurrent(index.current)
      }
      u.onend = () => {
        if (id !== runId.current) return
        index.current += 1
        next()
      }
      u.onerror = () => {
        if (id !== runId.current) return
        setState('idle')
        setCurrent(null)
      }
      synth.speak(u)
    }
    setState('playing')
    next()
  }, [])

  // Accepts plain text, or a list of sentences when the caller needs to match `current` to its own text
  const play = useCallback(
    (text: string | string[]) => {
      if (!supported) return
      const parts = (Array.isArray(text) ? text : splitSentences(text)).filter((s) => s.trim())
      if (!parts.length) return
      sentences.current = parts
      speakFrom(0)
    },
    [supported, speakFrom],
  )

  const pause = useCallback(() => {
    if (!supported) return
    runId.current += 1 // stop the chain, keep the index
    window.speechSynthesis.cancel()
    setState('paused')
  }, [supported])

  const resume = useCallback(() => {
    if (!supported) return
    speakFrom(index.current)
  }, [supported, speakFrom])

  const stop = useCallback(() => {
    if (!supported) return
    runId.current += 1
    window.speechSynthesis.cancel()
    index.current = 0
    setState('idle')
    setCurrent(null)
  }, [supported])

  // Voice or speed changed in settings while reading: restart the current sentence with it
  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    if (stateRef.current === 'playing') speakFrom(index.current)
  }, [voiceURI, rate, speakFrom])

  // Never keep talking after the component goes away
  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        runId.current += 1
        window.speechSynthesis.cancel()
      }
    },
    [],
  )

  return { supported, state, current, play, pause, resume, stop }
}
