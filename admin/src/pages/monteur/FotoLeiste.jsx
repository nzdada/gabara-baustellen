import { useEffect, useState } from 'react'
import { useLang, t } from '@shared/i18n.js'
import { Icon } from '@shared/ui.jsx'
import { istMonteurRolle } from '@shared/auth.js'
import { getStore } from '@shared/store.js'
import {
  beobachteWarteschlange, warteschlangeStarten, anstossen,
  istInstalliert, persistenzSichern,
} from '@shared/fotoablage.js'

// Die feste Kopfleiste der Monteur-Ansicht (AP 6):
//   - Offline-Banner (navigator.onLine): "Kein Netz – alles wird gespeichert"
//   - Warteschlangen-Balken "⬆ n warten" mit dem Knopf "jetzt versuchen"
//   - Gate-Streifen, wenn die Kamera gesperrt ist (nicht installiert /
//     kein dauerhafter Speicher) – tippen öffnet den bebilderten Hinweis.
//
// Dazu die beiden Bausteine, die alle Kamera-Auslöser teilen:
//   useKameraFrei(user)  -> { geprueft, frei, grund }
//   <KameraGesperrt />   -> der ganzseitige, bebilderte Hinweis (Plan 5.4)

// ------------------------------------------------------------- Netz + Warteschlange

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const rauf = () => setOnline(true)
    const runter = () => setOnline(false)
    window.addEventListener('online', rauf)
    window.addEventListener('offline', runter)
    return () => {
      window.removeEventListener('online', rauf)
      window.removeEventListener('offline', runter)
    }
  }, [])
  return online
}

export function useWarteschlange(user) {
  const [stand, setStand] = useState({ wartend: 0, fehler: 0, laedt: false })
  useEffect(() => {
    warteschlangeStarten({ getStore, user })
    return beobachteWarteschlange(setStand)
  }, [user?.userId]) // eslint-disable-line react-hooks/exhaustive-deps
  return stand
}

// ------------------------------------------------------------- Standalone-Gate
//
// Der Monteur bekommt den Link per WhatsApp: dort läuft die App in einer
// flüchtigen Ansicht, persist() liefert false, und 30 Fotos in drei Größen
// (~19 MB) verschwinden beim Schließen lautlos – der Kernfall des Nutzers.
// Deshalb: nicht installiert ODER kein dauerhafter Speicher -> Kamera zu.
//
// Das Gate gilt der MONTEUR-Rolle (istMonteurRolle) – die Büro-Vorschau am
// Schreibtisch bleibt frei, dort entstehen keine Beweisfotos. Im Dev-Lauf
// ist es abgeschaltet (sonst wäre die Demo im Browser unbedienbar);
// localStorage 'gabara-gate-erzwingen' = 'ja' schaltet es zum Testen an.

export function useKameraFrei(user) {
  const [stand, setStand] = useState({ geprueft: false, frei: false, grund: '' })
  useEffect(() => {
    let aktiv = true
    async function pruefe() {
      const erzwingen = (() => {
        try { return localStorage.getItem('gabara-gate-erzwingen') === 'ja' } catch (e) { return false }
      })()
      if (!istMonteurRolle(user?.rolle) && !erzwingen) {
        return { geprueft: true, frei: true, grund: '' }
      }
      if (import.meta.env.DEV && !erzwingen) {
        return { geprueft: true, frei: true, grund: '' }
      }
      if (!istInstalliert()) return { geprueft: true, frei: false, grund: 'standalone' }
      const p = await persistenzSichern()
      if (!p.persistiert) return { geprueft: true, frei: false, grund: 'persistenz' }
      return { geprueft: true, frei: true, grund: '' }
    }
    pruefe().then((s) => { if (aktiv) setStand(s) })
    return () => { aktiv = false }
  }, [user?.rolle])
  return stand
}

// Der ganzseitige, bebilderte Hinweis: "Bitte über das Gabara-Symbol auf
// dem Startbildschirm öffnen." Die Zeichnung ist sprachfrei (Symbolbild).
export function KameraGesperrt({ grund, onClose }) {
  useLang()
  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-black text-lg text-slate-900">📷 {t('ft.gateTitel')}</p>
          <button onClick={onClose} aria-label={t('allg.schliessen')} className="min-h-11 min-w-11 text-slate-400">
            <Icon name="x" className="w-5 h-5 mx-auto" />
          </button>
        </div>

        {/* Symbolbild: Handy mit Gabara-Symbol auf dem Startbildschirm */}
        <svg viewBox="0 0 220 120" className="w-full h-32" aria-hidden="true">
          <rect x="20" y="8" width="56" height="104" rx="10" fill="none" stroke="#94a3b8" strokeWidth="3" />
          <rect x="30" y="22" width="12" height="12" rx="3" fill="#cbd5e1" />
          <rect x="46" y="22" width="12" height="12" rx="3" fill="#cbd5e1" />
          <rect x="30" y="38" width="12" height="12" rx="3" fill="#cbd5e1" />
          <rect x="46" y="38" width="12" height="12" rx="3" fill="#8b1a1a" />
          <path d="M92 44 h36 m0 0 l-9 -9 m9 9 l-9 9" fill="none" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="142" y="8" width="56" height="104" rx="10" fill="none" stroke="#0f766e" strokeWidth="3" />
          <rect x="154" y="34" width="32" height="32" rx="8" fill="#8b1a1a" />
          <path d="M161 50 h10 m-5 -5 v10 m8 -14 h6 v6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="170" cy="86" r="7" fill="none" stroke="#0f766e" strokeWidth="2.5" />
          <path d="M167 86 l2.5 2.5 l4.5 -5" fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <p className="text-sm text-slate-700">
          {t(grund === 'persistenz' ? 'ft.gatePersistenz' : 'ft.gateText')}
        </p>
        <ol className="space-y-2">
          {['ft.gateSchritt1', 'ft.gateSchritt2', 'ft.gateSchritt3'].map((schluessel, i) => (
            <li key={schluessel} className="flex items-start gap-2.5 text-sm text-slate-600">
              <span className="w-6 h-6 shrink-0 rounded-full bg-praxis-600 text-white text-xs font-black inline-flex items-center justify-center">{i + 1}</span>
              {t(schluessel)}
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-400">{t('ft.gateWarum')}</p>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Die Leiste

export default function FotoLeiste({ user }) {
  useLang()
  const online = useOnline()
  const stand = useWarteschlange(user)
  const kamera = useKameraFrei(user)
  const [gateOffen, setGateOffen] = useState(false)

  const zeigeNichts = online && stand.wartend === 0 && (kamera.frei || !kamera.geprueft)
  if (zeigeNichts) return null

  return (
    <div>
      {!online && (
        <p className="bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 flex items-center gap-2">
          <span aria-hidden="true">⚡</span> {t('ft.offline')}
        </p>
      )}
      {stand.wartend > 0 && (
        <div className="bg-sky-50 border-b border-sky-200 text-sky-900 text-sm font-semibold px-4 py-2 flex items-center gap-2">
          <span className="flex-1">
            ⬆ {t('ft.warten', { n: stand.wartend })}
            {stand.fehler > 0 && <span className="text-red-700"> · {t('ft.fehlerUpload', { n: stand.fehler })}</span>}
          </span>
          <button
            onClick={() => anstossen()}
            className="min-h-11 px-3 rounded-xl border border-sky-300 font-bold text-sky-800 active:bg-sky-100"
          >
            {stand.laedt ? '…' : t('ft.jetztVersuchen')}
          </button>
        </div>
      )}
      {kamera.geprueft && !kamera.frei && (
        <button
          onClick={() => setGateOffen(true)}
          className="w-full text-start bg-amber-50 border-b border-amber-200 text-amber-900 text-sm font-semibold px-4 py-2.5"
        >
          📷 {t('ft.gateStreifen')}
        </button>
      )}
      {gateOffen && <KameraGesperrt grund={kamera.grund} onClose={() => setGateOffen(false)} />}
    </div>
  )
}
