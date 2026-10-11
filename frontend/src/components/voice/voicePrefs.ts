import { useEffect, useState, useSyncExternalStore } from 'react'

// Reading voice and speed, shared by every Read aloud button and saved per browser

interface VoicePrefs {
  voiceURI: string | null // null = pick the best available voice
  rate: number
}

function load(): VoicePrefs {
  try {
    const rate = Number(localStorage.getItem('cv-rate'))
    return { voiceURI: localStorage.getItem('cv-voice'), rate: rate >= 0.5 && rate <= 2 ? rate : 1 }
  } catch {
    return { voiceURI: null, rate: 1 }
  }
}

let prefs = load()
const listeners = new Set<() => void>()

export function setVoicePrefs(next: Partial<VoicePrefs>) {
  prefs = { ...prefs, ...next }
  try {
    if (prefs.voiceURI) localStorage.setItem('cv-voice', prefs.voiceURI)
    else localStorage.removeItem('cv-voice')
    localStorage.setItem('cv-rate', String(prefs.rate))
  } catch {
    // storage blocked: settings just won't persist
  }
  listeners.forEach((l) => l())
}

export function getVoicePrefs() {
  return prefs
}

export function useVoicePrefs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs,
  )
}

// Novelty and joke voices that ship with macOS; never pick these
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i
const GOOD_NAMES = /samantha|ava|allison|susan|zoe|evan|tom|daniel|karen|moira|serena|nathan|joelle|noelle|aria|jenny|guy|sonia|libby|ryan/i

function score(v: SpeechSynthesisVoice) {
  let s = 0
  if (/natural|neural/i.test(v.name)) s += 100 // Edge's online neural voices
  if (/premium/i.test(v.name)) s += 80 // macOS downloadable voices
  if (/enhanced/i.test(v.name)) s += 70
  if (/^google/i.test(v.name)) s += 50 // Chrome's network voices
  if (GOOD_NAMES.test(v.name)) s += 30
  if (/espeak/i.test(v.name)) s -= 60
  if (/^en[-_]US/i.test(v.lang)) s += 10
  else if (/^en[-_]GB/i.test(v.lang)) s += 6
  return s
}

// English voices worth offering, best first
export function rankVoices(all: SpeechSynthesisVoice[]) {
  return all
    .filter((v) => /^en\b|^en[-_]/i.test(v.lang) && !NOVELTY.test(v.name))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
}

export function resolveVoice(all: SpeechSynthesisVoice[], uri: string | null) {
  return (uri && all.find((v) => v.voiceURI === uri)) || rankVoices(all)[0] || null
}

// Voices load late in Chrome, so listen for the list to change
export function useVoices() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (supported ? window.speechSynthesis.getVoices() : []))
  useEffect(() => {
    if (!supported) return
    const update = () => setVoices(window.speechSynthesis.getVoices())
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [supported])
  return voices
}

// Short friendly name: "Microsoft Aria Online (Natural) - English (United States)" -> "Aria (Natural), US"
export function voiceLabel(v: SpeechSynthesisVoice) {
  const region = /[-_](US|GB|AU|IE|IN|ZA|NZ|CA)\b/i.exec(v.lang)?.[1]?.toUpperCase()
  const name = v.name
    .replace(/^Microsoft\s+/i, '')
    .replace(/\s+Online/i, '')
    .replace(/\s+-\s+English.*$/i, '')
    .replace(/\s*\(English.*\)$/i, '')
  return region && !name.includes(region) ? `${name}, ${region === 'GB' ? 'UK' : region}` : name
}
