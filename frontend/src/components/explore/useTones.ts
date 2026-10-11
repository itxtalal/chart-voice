import { useCallback, useEffect, useRef, useState } from 'react'

export const LOW_HZ = 220
export const HIGH_HZ = 880

export function pitchFor(v: number, min: number, max: number) {
  if (max === min) return (LOW_HZ + HIGH_HZ) / 2
  return LOW_HZ + ((v - min) / (max - min)) * (HIGH_HZ - LOW_HZ)
}

// Web Audio tones: higher value = higher pitch.
export function useTones() {
  const ctxRef = useRef<AudioContext | null>(null)
  const nodes = useRef<OscillatorNode[]>([])
  const timers = useRef<number[]>([])
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  const ctx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const stopAll = useCallback(() => {
    nodes.current.forEach((n) => {
      try {
        n.stop()
      } catch {
        // already stopped
      }
    })
    nodes.current = []
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setPlayingIndex(null)
  }, [])

  const tone = useCallback(
    (freq: number, start = 0, dur = 0.22) => {
      const c = ctx()
      const t0 = c.currentTime + start
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.connect(gain).connect(c.destination)
      osc.start(t0)
      osc.stop(t0 + dur + 0.05)
      nodes.current.push(osc)
    },
    [ctx],
  )

  // A soft low click for missing values, so gaps are audible
  const gap = useCallback(
    (start = 0) => tone(110, start, 0.06),
    [tone],
  )

  const playOne = useCallback(
    (v: number | null, min: number, max: number) => {
      if (v === null) gap()
      else tone(pitchFor(v, min, max))
    },
    [tone, gap],
  )

  const playAll = useCallback(
    (values: (number | null)[], min: number, max: number, step = 0.35) => {
      stopAll()
      values.forEach((v, i) => {
        if (v === null) gap(i * step)
        else tone(pitchFor(v, min, max), i * step, 0.28)
        timers.current.push(window.setTimeout(() => setPlayingIndex(i), i * step * 1000))
      })
      timers.current.push(window.setTimeout(() => setPlayingIndex(null), values.length * step * 1000 + 200))
    },
    [tone, gap, stopAll],
  )

  useEffect(() => () => {
    stopAll()
    void ctxRef.current?.close()
  }, [stopAll])

  return { playOne, playAll, stopAll, playingIndex }
}
