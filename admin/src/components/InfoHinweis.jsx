import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@shared/ui.jsx'
import { t } from '@shared/i18n.js'

// Kleines Info-Zeichen neben einer Feldbeschriftung. Erklärt in ein bis zwei
// Sätzen, WOHIN die eingetragenen Daten fließen und was davon für die
// Abrechnung zählt.
//
// Bewusst NUR für die Büro-Verwaltung gedacht – in der Monteur-Handy-Ansicht
// (pages/monteur/) soll nichts überlagern. Komponenten, die in BEIDEN Welten
// laufen (BerichtForm, SpesenForm), bekommen deshalb `nurDesktop`: dort wird
// das Zeichen erst ab der lg-Breite eingeblendet.
//
// Die Blase hängt per Portal am <body> und liegt fix im Fenster. Absolut
// positioniert wurde sie früher vom nächsten Container mit `overflow` (Tabellen,
// Modal-Körper) abgeschnitten – genau das soll nicht passieren.
//
// Bedienung: Maus darüber ODER antippen ODER per Tastatur fokussieren.

const BREITE = 256   // w-64
const ABSTAND = 10   // Luft zwischen Zeichen und Blase
const RAND = 8       // Mindestabstand zum Fensterrand

export default function InfoHinweis({ text, nurDesktop = false }) {
  const [offen, setOffen] = useState(false)
  const [pos, setPos] = useState(null)
  const huelle = useRef(null)
  const knopf = useRef(null)
  const blase = useRef(null)
  const id = useId()

  // Blase am Info-Zeichen ausrichten: bevorzugt darüber, sonst darunter.
  // Waagrecht am Fensterrand abgefangen, der Pfeil zeigt weiter aufs Zeichen.
  const messen = useCallback(() => {
    const k = knopf.current
    if (!k) return
    const r = k.getBoundingClientRect()
    const hoehe = blase.current?.offsetHeight || 76
    const platzOben = r.top
    const unten = platzOben < hoehe + ABSTAND + RAND && window.innerHeight - r.bottom > platzOben
    const mitte = r.left + r.width / 2
    let links = Math.min(
      Math.max(mitte - BREITE / 2, RAND),
      Math.max(window.innerWidth - BREITE - RAND, RAND),
    )
    setPos({
      links,
      oben: unten ? r.bottom + ABSTAND : r.top - ABSTAND - hoehe,
      unten,
      pfeil: Math.min(Math.max(mitte - links, 12), BREITE - 12),
    })
  }, [])

  useLayoutEffect(() => {
    if (!offen) { setPos(null); return }
    messen()
    // Nach dem ersten Zeichnen steht die echte Höhe fest → einmal nachjustieren
    const rahmen = requestAnimationFrame(messen)
    return () => cancelAnimationFrame(rahmen)
  }, [offen, messen, text])

  // Scrollen/Größenänderung: mitziehen statt an falscher Stelle stehen bleiben
  useEffect(() => {
    if (!offen) return
    window.addEventListener('scroll', messen, true)
    window.addEventListener('resize', messen)
    return () => {
      window.removeEventListener('scroll', messen, true)
      window.removeEventListener('resize', messen)
    }
  }, [offen, messen])

  // Klick außerhalb schließt die Blase wieder (Touch-Bedienung)
  useEffect(() => {
    if (!offen) return
    function ausserhalb(e) {
      if (huelle.current && !huelle.current.contains(e.target)) setOffen(false)
    }
    function taste(e) {
      if (e.key === 'Escape') setOffen(false)
    }
    document.addEventListener('mousedown', ausserhalb)
    document.addEventListener('touchstart', ausserhalb)
    document.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('mousedown', ausserhalb)
      document.removeEventListener('touchstart', ausserhalb)
      document.removeEventListener('keydown', taste)
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
        ref={knopf}
        type="button"
        aria-label={t('allg.erklaerung')}
        aria-describedby={offen ? id : undefined}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOffen((o) => !o) }}
        onFocus={() => setOffen(true)}
        onBlur={() => setOffen(false)}
        className="text-schrift-zart hover:text-praxis-600 focus:text-praxis-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-praxis-400 rounded-full transition"
      >
        <Icon name="info" className="w-4 h-4" strokeWidth={1.9} />
      </button>
      {offen && createPortal(
        <span
          ref={blase}
          id={id}
          role="tooltip"
          dir="auto"
          style={{
            position: 'fixed',
            top: pos ? pos.oben : -9999,
            left: pos ? pos.links : -9999,
            width: BREITE,
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="z-[100] block rounded-feld bg-praxis-900 px-3 py-2.5 text-[12px] font-normal leading-relaxed text-white shadow-xl pointer-events-none"
        >
          {text}
          <span
            style={{ left: pos?.pfeil ?? 12, [pos?.unten ? 'bottom' : 'top']: '100%' }}
            className={`absolute h-2 w-2 -ml-1 rotate-45 bg-praxis-900 ${pos?.unten ? 'translate-y-1' : '-translate-y-1'}`}
          />
        </span>,
        document.body,
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
