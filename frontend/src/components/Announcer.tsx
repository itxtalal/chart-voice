import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Level = 'polite' | 'assertive'
type Announce = (message: string, level?: Level) => void

const AnnounceContext = createContext<Announce>(() => {})

// Two visually hidden live regions that exist from page load, so screen
// readers reliably pick up anything we put in them later.
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  const timer = useRef<number | undefined>(undefined)

  const announce = useCallback<Announce>((message, level = 'polite') => {
    const set = level === 'assertive' ? setAssertive : setPolite
    set('')
    window.clearTimeout(timer.current)
    // Clearing first makes repeated identical messages get read again
    timer.current = window.setTimeout(() => set(message), 60)
  }, [])

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </AnnounceContext.Provider>
  )
}

export const useAnnounce = () => useContext(AnnounceContext)
