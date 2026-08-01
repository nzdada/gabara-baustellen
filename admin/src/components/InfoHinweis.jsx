import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@shared/ui.jsx'

// Kleines Info-Zeichen neben einer Feldbeschriftung. Erklärt in ein bis zwei
// Sätzen, WOHIN die eingetragenen Daten fließen und was davon für die
// Abrechnung zählt.
//
// Bewusst NUR für die Büro-Verwaltung gedacht – in der Monteur-Handy-Ansicht
// (pages/monteur/) soll nichts überlagern. Komponenten, die in BEIDEN Welten
// laufen (BerichtForm, SpesenForm), bekommen deshalb `nurDesktop`: dort wird
// das Zeichen erst ab der lg-Breite eingeblendet.
//
// Bedienung: Maus darüber ODER antippen ODER per Tastatur fokussieren.
export default function InfoHinweis({ text, nurDesktop = false, ausrichtung = 'links' }) {
  const [offen, setOffen] = useState(false)
  const huelle = useRef(null)
  const id = useId()

  // Klick außerhalb schließt die Blase wieder (Touch-Bedienung)
  useEffect(() => {
    if (!offen) return
    function ausserhalb(e) {
      if (huelle.current && !huelle.current.contains(e.target)) setOffen(false)
    }
    document.addEventListener('mousedown', ausserhalb)
    document.addEventListener('touchstart', ausserhalb)
    return () => {
      document.removeEventListener('mousedown', ausserhalb)
      document.removeEventListener('touchstart', ausserhalb)
    }
  }, [offen])

  if (!text) return null

  return (
    <span
      ref={huelle}
      className={`relative inline-flex align-middle ${nurDesktop ? 'hidden lg:inline-flex' : ''}`}
      onMouseEnter={() => setOffen(true)}
      onMouseLeave={() => setOffen(false)}
    >
      <button
        type="button"
        aria-label="Erklärung anzeigen"
        aria-describedby={offen ? id : undefined}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOffen((o) => !o) }}
        onFocus={() => setOffen(true)}
        onBlur={() => setOffen(false)}
        className="text-slate-300 hover:text-praxis-600 focus:text-praxis-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-praxis-400 rounded-full transition"
      >
        <Icon name="info" className="w-4 h-4" strokeWidth={1.9} />
      </button>
      {offen && (
        <span
          id={id}
          role="tooltip"
          className={`absolute bottom-full z-50 mb-2 w-64 rounded-xl bg-slate-900 px-3 py-2.5 text-[11px] font-normal leading-relaxed text-white shadow-xl ${
            ausrichtung === 'rechts' ? 'right-0' : 'left-0'
          }`}
        >
          {text}
          <span
            className={`absolute top-full h-2 w-2 -translate-y-1 rotate-45 bg-slate-900 ${
              ausrichtung === 'rechts' ? 'right-2' : 'left-2'
            }`}
          />
        </span>
      )}
    </span>
  )
}

// Beschriftung mit Info-Zeichen – spart die Wiederholung an jedem Feld.
export function FeldLabel({ children, info, nurDesktop = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {children}
      <InfoHinweis text={info} nurDesktop={nurDesktop} />
    </span>
  )
}
