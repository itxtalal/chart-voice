import { useState, type ReactNode } from 'react'

interface Props {
  id: string
  title: string
  intro?: ReactNode
  children: ReactNode
  className?: string
  // Collapsible sections start closed; the h3 holds the toggle so heading navigation still finds them
  collapsible?: boolean
}

// A results card with an h3, labelled by its heading so it shows up as a region
export default function Section({ id, title, intro, children, className = '', collapsible = false }: Props) {
  const [open, setOpen] = useState(!collapsible)

  if (!collapsible) {
    return (
      <section id={id} aria-labelledby={`${id}-h`} className={`card ${className}`}>
        <h3 id={`${id}-h`} tabIndex={-1}>
          {title}
        </h3>
        {intro && <p className="intro">{intro}</p>}
        {children}
      </section>
    )
  }

  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`card fold${open ? ' open' : ''} ${className}`}>
      <h3 id={`${id}-h`}>
        <button type="button" className="fold-btn" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(!open)}>
          <span>{title}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" className="fold-icon">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      <div id={`${id}-body`} className="fold-body" hidden={!open}>
        {intro && <p className="intro">{intro}</p>}
        {children}
      </div>
    </section>
  )
}
