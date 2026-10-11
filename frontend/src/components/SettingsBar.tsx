import { useState } from 'react'
import type { TextSize, Theme } from '../prefs'
import { rankVoices, setVoicePrefs, useVoicePrefs, useVoices, voiceLabel } from './voice/voicePrefs'
import { speakOnce } from './voice/useSpeech'

interface Props {
  theme: Theme
  setTheme: (t: Theme) => void
  textSize: TextSize
  setTextSize: (s: TextSize) => void
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'contrast', label: 'High contrast' },
]

const SIZES: { value: TextSize; label: string; aria: string }[] = [
  { value: 'normal', label: 'A', aria: 'Normal' },
  { value: 'large', label: 'A+', aria: 'Large' },
  { value: 'xlarge', label: 'A++', aria: 'Extra large' },
]

const SPEEDS = [
  { value: 0.75, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Fast' },
  { value: 1.5, label: 'Faster' },
  { value: 2, label: 'Fastest' },
]

// Text size, colors and reading voice live behind one button so the header stays calm
export default function SettingsBar({ theme, setTheme, textSize, setTextSize }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="settings-wrap">
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-controls="app-settings"
        onClick={() => setOpen(!open)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" className="icon">
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="15" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="9" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
        </svg>
        Settings
      </button>
      <div id="app-settings" className="settings" role="region" aria-label="Settings" hidden={!open}>
        <fieldset className="segmented">
          <legend>Text size</legend>
          {SIZES.map((s) => (
            <label key={s.value} className={textSize === s.value ? 'on' : ''}>
              <input
                type="radio"
                name="text-size"
                value={s.value}
                checked={textSize === s.value}
                onChange={() => setTextSize(s.value)}
              />
              <span aria-hidden="true">{s.label}</span>
              <span className="sr-only">{s.aria}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="segmented">
          <legend>Colors</legend>
          {THEMES.map((t) => (
            <label key={t.value} className={theme === t.value ? 'on' : ''}>
              <input
                type="radio"
                name="theme"
                value={t.value}
                checked={theme === t.value}
                onChange={() => setTheme(t.value)}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </fieldset>
        <VoiceSettings />
      </div>
    </div>
  )
}

function VoiceSettings() {
  const { voiceURI, rate } = useVoicePrefs()
  const voices = rankVoices(useVoices()).slice(0, 15)
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null

  return (
    <fieldset className="settings-group">
      <legend>Reading voice</legend>
      <label className="field">
        <span>Voice</span>
        <select value={voiceURI ?? ''} onChange={(e) => setVoicePrefs({ voiceURI: e.target.value || null })}>
          <option value="">Best available{voices[0] ? ` (${voiceLabel(voices[0])})` : ''}</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {voiceLabel(v)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Speed</span>
        <select value={rate} onChange={(e) => setVoicePrefs({ rate: Number(e.target.value) })}>
          {SPEEDS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn-ghost" onClick={() => speakOnce('Hi. This is how I will read your charts. Sales rose from 20 in Jan to 55 in May (+35).')}>
        Test voice
      </button>
    </fieldset>
  )
}
