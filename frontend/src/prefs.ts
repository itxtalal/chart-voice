import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'contrast'
export type TextSize = 'normal' | 'large' | 'xlarge'

const SCALE: Record<TextSize, string> = { normal: '1', large: '1.2', xlarge: '1.45' }

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage blocked: settings just won't persist
  }
}

function defaultTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  if (window.matchMedia?.('(prefers-contrast: more)').matches) return 'contrast'
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

// Display settings, saved per browser and applied to <html>
export function usePrefs() {
  const [theme, setTheme] = useState<Theme>(() =>
    read('cv-theme', ['light', 'dark', 'contrast'] as const, defaultTheme()),
  )
  const [textSize, setTextSize] = useState<TextSize>(() =>
    read('cv-text', ['normal', 'large', 'xlarge'] as const, 'normal'),
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    save('cv-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--scale', SCALE[textSize])
    save('cv-text', textSize)
  }, [textSize])

  return { theme, setTheme, textSize, setTextSize }
}
