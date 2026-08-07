import { useMemo, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { heuteISO, toISO } from '@shared/slots.js'
import { useLang, t, datumLok, lokale } from '@shared/i18n.js'

// Kompakter Monats-Datepicker (Touch-tauglich, keine Fremdbibliothek).
// - wert / onWert: ISO-Datum 'JJJJ-MM-TT'
// - marker: { 'JJJJ-MM-TT': anzahl } zeichnet Punkte an Tagen mit Terminen
// Wird im Termin-Dialog und in der Monteur-Kalenderansicht verwendet.

// Wochentags- und Monatsnamen kommen aus Intl – so stimmen sie in jeder Sprache
const WOCHENTAG_SCHLUESSEL = ['wt.mo', 'wt.di', 'wt.mi', 'wt.do', 'wt.fr', 'wt.sa', 'wt.so']

function monatsStart(iso) {
  const d = new Date((iso || heuteISO()) + 'T12:00:00')
  return new Date(d.getFullYear(), d.getMonth(), 1, 12)
}

export default function DatumWahl({ wert, onWert, marker = {}, kompakt = false }) {
  useLang()
  const [monat, setMonat] = useState(() => monatsStart(wert))
  const heute = heuteISO()

  const tage = useMemo(() => {
    const erster = new Date(monat.getFullYear(), monat.getMonth(), 1, 12)
    const versatz = (erster.getDay() + 6) % 7 // Montag = 0
    const anzahl = new Date(monat.getFullYear(), monat.getMonth() + 1, 0).getDate()
    const zellen = []
    for (let i = 0; i < versatz; i++) zellen.push(null)
    for (let t = 1; t <= anzahl; t++) zellen.push(toISO(new Date(monat.getFullYear(), monat.getMonth(), t, 12)))
    while (zellen.length % 7 !== 0) zellen.push(null)
    return zellen
  }, [monat])

  const zelle = kompakt ? 'h-9 text-xs' : 'h-10 text-sm'

  return (
    <div className="rounded-karte border border-rahmen bg-karte p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={() => setMonat(new Date(monat.getFullYear(), monat.getMonth() - 1, 1, 12))}
          className="p-1.5 rounded-feld text-schrift-zart hover:bg-gedeckt-tief hover:text-schrift-stark"
        >
          <Icon name="arrowLeft" className="w-4 h-4" />
        </button>
        <p className="text-sm font-bold text-schrift-stark">
          {monat.toLocaleDateString(lokale(), { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => setMonat(new Date(monat.getFullYear(), monat.getMonth() + 1, 1, 12))}
          className="p-1.5 rounded-feld text-schrift-zart hover:bg-gedeckt-tief hover:text-schrift-stark"
        >
          <Icon name="arrowRight" className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {WOCHENTAG_SCHLUESSEL.map((w) => (
          <span key={w} className="text-center text-[11px] font-bold uppercase text-schrift-zart">{t(w)}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {tage.map((iso, i) => {
          if (!iso) return <span key={`leer-${i}`} />
          const gewaehlt = iso === wert
          const istHeute = iso === heute
          const anzahl = marker[iso] || 0
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onWert(iso)}
              className={`${zelle} relative rounded-feld font-semibold transition flex items-center justify-center ${
                gewaehlt
                  ? 'bg-praxis-600 text-white'
                  : istHeute
                    ? 'bg-praxis-50 text-praxis-800 ring-1 ring-praxis-300'
                    : 'text-schrift hover:bg-gedeckt-tief'
              }`}
            >
              {Number(iso.slice(8, 10))}
              {anzahl > 0 && (
                <span
                  className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${gewaehlt ? 'bg-karte' : 'bg-praxis-500'}`}
                />
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => { const h = heuteISO(); setMonat(monatsStart(h)); onWert(h) }}
          className="text-[12px] font-semibold text-praxis-700 hover:underline"
        >
          {t('kalender.heute')}
        </button>
        <span className="text-[12px] text-schrift-zart">
          {wert ? datumLok(wert, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '–'}
        </span>
      </div>
    </div>
  )
}
