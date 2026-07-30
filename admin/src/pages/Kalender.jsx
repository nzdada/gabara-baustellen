import { useMemo, useState } from 'react'
import { useCollection } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { heuteISO, addTage, wochentag, zuMinuten, fensterFuer, imUrlaub } from '@shared/slots.js'
import { kalenderKonfiguriert, kalenderVerbunden, kalenderVerbinden } from '@shared/googleCalendar.js'
import { useLang, tr, datumLok } from '@shared/i18n.js'
import TerminModal from '../components/TerminModal.jsx'
import NeuerTermin from '../components/NeuerTermin.jsx'
import { BestaetigenModal, AblehnenModal } from './Anfragen.jsx'

const T = {
  titel: { de: 'Terminkalender', en: 'Appointment calendar', ar: 'تقويم المواعيد' },
  heute: { de: 'Heute', en: 'Today', ar: 'اليوم' },
  google: { de: 'Google Kalender verbinden', en: 'Connect Google Calendar', ar: 'ربط تقويم جوجل' },
  googleOk: { de: '✓ Google Kalender verbunden', en: '✓ Google Calendar connected', ar: '✓ تم ربط تقويم جوجل' },
  googleDemo: { de: 'Google Kalender: Demo-Modus', en: 'Google Calendar: demo mode', ar: 'تقويم جوجل: وضع تجريبي' },
  termin: { de: 'Termin', en: 'Appointment', ar: 'موعد' },
  nurTelefon: { de: 'nur telefonisch', en: 'phone only', ar: 'هاتفيًا فقط' },
  geschlossen: { de: 'geschlossen', en: 'closed', ar: 'مغلق' },
  urlaub: { de: 'Urlaub', en: 'holiday', ar: 'إجازة' },
  termine: { de: 'Termine', en: 'appointments', ar: 'مواعيد' },
  hinweis: {
    de: 'Klick auf einen Einsatz öffnet die Details – Klick auf eine freie Fläche legt einen neuen Termin an.',
    en: 'Klick auf einen Einsatz öffnet die Details – Klick auf eine freie Fläche legt einen neuen Termin an.',
    ar: 'Klick auf einen Einsatz öffnet die Details – Klick auf eine freie Fläche legt einen neuen Termin an.',
  },
  googleFehler: { de: 'Google-Kalender-Verbindung fehlgeschlagen:', en: 'Google Calendar connection failed:', ar: 'فشل الاتصال بتقويم جوجل:' },
  anfragenTitel: { de: 'Neue Terminanfragen', en: 'New appointment requests', ar: 'طلبات مواعيد جديدة' },
  wunsch: { de: 'Wunsch:', en: 'Requested:', ar: 'المطلوب:' },
  bestaetigen: { de: 'Bestätigen', en: 'Confirm', ar: 'تأكيد' },
  ablehnen: { de: 'Ablehnen', en: 'Decline', ar: 'رفض' },
  alleAnfragen: { de: 'Alle Anfragen ansehen', en: 'View all requests', ar: 'عرض كل الطلبات' },
  uhr: { de: 'Uhr', en: '', ar: '' },
}

const PX_PRO_30MIN = 26

function montagVon(iso) {
  const wt = wochentag(iso)
  return addTage(iso, wt === 0 ? -6 : 1 - wt)
}

const STATUS_FARBE = {
  bestaetigt: 'bg-praxis-600 border-praxis-700 text-white',
  abgeschlossen: 'bg-slate-300 border-slate-400 text-slate-700',
  abgesagt: 'bg-red-100 border-red-200 text-red-500 line-through',
}

export default function Kalender({ user }) {
  useLang()
  const appointments = useCollection('appointments')
  const patients = useCollection('patients')
  const requests = useCollection('requests')
  const settingsRows = useCollection('settings')
  const pausen = settingsRows.find((r) => r.id === 'pausen')?.eintraege || []
  const ozDoc = settingsRows.find((r) => r.id === 'oeffnungszeiten')
  const zeiten = ozDoc?.fenster || null
  const telefonTage = ozDoc?.telefon || [5] // geschlossene Tage, die telefonisch erreichbar sind
  const urlaubListe = ozDoc?.urlaub || []
  const [montag, setMontag] = useState(() => montagVon(heuteISO()))
  const [gewaehlt, setGewaehlt] = useState(null)
  const [neu, setNeu] = useState(false) // false | true | {datum, start} (Klick auf Zeitfenster)
  const [bestaetige, setBestaetige] = useState(null)
  const [ablehne, setAblehne] = useState(null)
  const [gVerbunden, setGVerbunden] = useState(kalenderVerbunden())

  const neueAnfragen = requests
    .filter((r) => r.status === 'neu')
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))

  // Samstag nur zeigen, wenn er Öffnungszeiten hat oder dort Termine existieren
  const tage = useMemo(() => {
    const samstag = addTage(montag, 5)
    const mitSamstag = fensterFuer(samstag, zeiten).length > 0 || appointments.some((a) => a.datum === samstag)
    return [0, 1, 2, 3, 4, ...(mitSamstag ? [5] : [])].map((i) => addTage(montag, i))
  }, [montag, zeiten, appointments])
  const heute = heuteISO()

  const proTag = useMemo(() => {
    const map = {}
    for (const t of tage) map[t] = appointments.filter((a) => a.datum === t).sort((a, b) => a.start.localeCompare(b.start))
    return map
  }, [appointments, tage])

  // Zeitraster folgt den konfigurierten Öffnungszeiten (und vorhandenen Terminen),
  // Grundbereich 8–19 Uhr – so bleiben 07:00-Fenster und 20:00-Termine sichtbar
  const { START_STD, ENDE_STD } = useMemo(() => {
    let von = 8 * 60
    let bis = 19 * 60
    for (const t of tage) {
      for (const [fVon, fBis] of fensterFuer(t, zeiten)) {
        von = Math.min(von, zuMinuten(fVon))
        bis = Math.max(bis, zuMinuten(fBis))
      }
      for (const a of proTag[t] || []) {
        von = Math.min(von, zuMinuten(a.start))
        bis = Math.max(bis, zuMinuten(a.ende))
      }
    }
    return { START_STD: Math.floor(von / 60), ENDE_STD: Math.ceil(bis / 60) }
  }, [tage, zeiten, proTag])

  const stunden = []
  for (let h = START_STD; h < ENDE_STD; h++) stunden.push(h)

  async function googleVerbinden() {
    try {
      await kalenderVerbinden()
      setGVerbunden(true)
    } catch (e) {
      alert(tr(T.googleFehler) + ' ' + e.message)
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-slate-900">{tr(T.titel)}</h1>
        <div className="flex items-center gap-1 bg-white rounded-full border border-slate-200 p-1">
          <button onClick={() => setMontag(addTage(montag, -7))} className="p-1.5 hover:bg-slate-100 rounded-full">
            <Icon name="arrowLeft" className="w-4 h-4 rtl:rotate-180" />
          </button>
          <button onClick={() => setMontag(montagVon(heute))} className="text-xs font-semibold px-3 py-1 hover:bg-slate-100 rounded-full">
            {tr(T.heute)}
          </button>
          <button onClick={() => setMontag(addTage(montag, 7))} className="p-1.5 hover:bg-slate-100 rounded-full">
            <Icon name="arrowRight" className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {kalenderKonfiguriert() ? (
            <button
              onClick={googleVerbinden}
              className={`text-xs font-semibold rounded-full px-3.5 py-2 border ${
                gVerbunden
                  ? 'bg-praxis-50 border-praxis-300 text-praxis-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-praxis-400'
              }`}
            >
              {gVerbunden ? tr(T.googleOk) : tr(T.google)}
            </button>
          ) : (
            <span className="text-xs text-slate-400 bg-white border border-slate-200 rounded-full px-3.5 py-2">
              {tr(T.googleDemo)}
            </span>
          )}
          <button
            onClick={() => setNeu(true)}
            className="inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2.5 rounded-full"
          >
            <Icon name="plus" className="w-4 h-4" /> {tr(T.termin)}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Kopfzeile */}
          <div className="grid" style={{ gridTemplateColumns: `52px repeat(${tage.length}, 1fr)` }}>
            <div />
            {tage.map((t) => (
              <div
                key={t}
                className={`px-2 py-3 text-center border-l border-slate-100 ${t === heute ? 'bg-praxis-50' : ''}`}
              >
                <p className={`text-sm font-bold ${t === heute ? 'text-praxis-700' : 'text-slate-700'}`}>
                  {datumLok(t, { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <p className="text-[10px] text-slate-400">
                  {(() => {
                    // Terminanzahl hat Vorrang – auch an einem inzwischen geschlossenen Tag
                    const anzahl = proTag[t]?.filter((a) => a.status !== 'abgesagt').length || 0
                    if (anzahl > 0) return `${anzahl} ${tr(T.termine)}`
                    if (imUrlaub(t, urlaubListe)) return `🏖 ${tr(T.urlaub)}`
                    if (fensterFuer(t, zeiten).length > 0) return `0 ${tr(T.termine)}`
                    return telefonTage.includes(wochentag(t)) ? tr(T.nurTelefon) : tr(T.geschlossen)
                  })()}
                </p>
              </div>
            ))}
          </div>
          {/* Raster */}
          <div className="grid border-t border-slate-100" style={{ gridTemplateColumns: `52px repeat(${tage.length}, 1fr)` }}>
            {/* Zeitspalte */}
            <div className="relative" style={{ height: (ENDE_STD - START_STD) * 2 * PX_PRO_30MIN }}>
              {stunden.map((h) => (
                <p
                  key={h}
                  className="absolute right-2 text-[10px] text-slate-400 -translate-y-1/2"
                  style={{ top: (h - START_STD) * 2 * PX_PRO_30MIN }}
                >
                  {String(h).padStart(2, '0')}:00
                </p>
              ))}
            </div>
            {tage.map((t) => (
              <div
                key={t}
                className={`relative border-l border-slate-100 cursor-pointer ${t === heute ? 'bg-praxis-50/40' : ''} ${fensterFuer(t, zeiten).length === 0 || imUrlaub(t, urlaubListe) ? 'bg-slate-50' : ''}`}
                style={{ height: (ENDE_STD - START_STD) * 2 * PX_PRO_30MIN }}
                onClick={(e) => {
                  // Klick auf ein freies Zeitfenster -> neuen Termin mit Datum + Uhrzeit vorbelegen
                  // (clientY relativ zur Spalte, damit auch Klicks auf Rasterlinien stimmen)
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                  const minuten = START_STD * 60 + Math.floor(y / PX_PRO_30MIN) * 30
                  const start = `${String(Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`
                  setNeu({ datum: t, start })
                }}
              >
                {stunden.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-slate-50"
                    style={{ top: (h - START_STD) * 2 * PX_PRO_30MIN }}
                  />
                ))}
                {/* Wiederkehrende Pausen aus dem Wochenplan (Einstellungen) – schraffiert */}
                {pausen.filter((p) => p.tag === wochentag(t)).map((p, i) => (
                  <div
                    key={`pause-${i}`}
                    className="absolute inset-x-0 pointer-events-none bg-amber-100/70 border-y border-amber-200 flex items-center justify-center"
                    style={{
                      top: ((zuMinuten(p.von) - START_STD * 60) / 30) * PX_PRO_30MIN,
                      height: ((zuMinuten(p.bis) - zuMinuten(p.von)) / 30) * PX_PRO_30MIN,
                      backgroundImage: 'repeating-linear-gradient(45deg, rgba(217,119,6,0.08) 0 6px, transparent 6px 12px)',
                    }}
                  >
                    <span className="text-[9px] font-bold text-amber-700/80 truncate px-1">☕ {p.grund}</span>
                  </div>
                ))}
                {(proTag[t] || []).map((a) => {
                  const top = ((zuMinuten(a.start) - START_STD * 60) / 30) * PX_PRO_30MIN
                  const hoehe = ((zuMinuten(a.ende) - zuMinuten(a.start)) / 30) * PX_PRO_30MIN
                  return (
                    <button
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        // Interne Termine öffnen den Editor (Zeiten ändern / löschen)
                        if (a.intern) setNeu({ bearbeiten: a })
                        else setGewaehlt(a)
                      }}
                      className={`absolute inset-x-1 rounded-lg border px-2 py-1 text-left overflow-hidden shadow-sm hover:brightness-110 transition ${
                        a.intern ? 'bg-slate-600 border-slate-700 text-white' : STATUS_FARBE[a.status] || STATUS_FARBE.bestaetigt
                      }`}
                      style={a.intern
                        ? { top: top + 1, height: Math.max(hoehe - 2, 20), backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 6px, transparent 6px 12px)' }
                        : { top: top + 1, height: Math.max(hoehe - 2, 20) }}
                    >
                      <p className="text-[11px] font-bold leading-tight truncate">{a.start} · {a.patientName}</p>
                      {hoehe > 34 && <p className="text-[10px] opacity-80 truncate">{a.behandlung} · {a.arzt}</p>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">{tr(T.hinweis)}</p>

      {/* Neue Online-Anfragen direkt unter dem Kalender – kein Seitenwechsel nötig */}
      {neueAnfragen.length > 0 && (
        <div className="mt-5 bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-amber-100 bg-amber-50/60">
            <Icon name="inbox" className="w-4 h-4 text-amber-600" />
            <p className="font-bold text-sm text-slate-800">{tr(T.anfragenTitel)}</p>
            <span className="bg-amber-400 text-praxis-900 text-xs font-bold rounded-full px-2 py-0.5">{neueAnfragen.length}</span>
            <a href="#/anfragen" className="ml-auto rtl:ml-0 rtl:mr-auto text-xs font-semibold text-praxis-700 hover:underline">
              {tr(T.alleAnfragen)} →
            </a>
          </div>
          <div className="divide-y divide-slate-50">
            {neueAnfragen.map((r) => (
              <div key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate">{r.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {r.anliegen} · {tr(T.wunsch)} <span className="font-semibold text-slate-600">{datumLok(r.datum)}, {r.start} {tr(T.uhr)}</span>
                    <span className="mx-2" dir="ltr">{r.telefon}</span>
                  </p>
                </div>
                <button
                  onClick={() => setBestaetige(r)}
                  className="bg-praxis-600 hover:bg-praxis-700 text-white text-xs font-semibold px-3.5 py-2 rounded-full"
                >
                  {tr(T.bestaetigen)}
                </button>
                <button
                  onClick={() => setAblehne(r)}
                  className="bg-white border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600 text-xs font-semibold px-3.5 py-2 rounded-full"
                >
                  {tr(T.ablehnen)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {bestaetige && (
        <BestaetigenModal anfrage={bestaetige} patients={patients} onClose={() => setBestaetige(null)} />
      )}
      {ablehne && <AblehnenModal anfrage={ablehne} onClose={() => setAblehne(null)} />}

      {gewaehlt && (
        <TerminModal
          termin={gewaehlt}
          patient={patients.find((p) => p.id === gewaehlt.patientId)}
          user={user}
          onClose={() => setGewaehlt(null)}
        />
      )}
      {neu && (
        <NeuerTermin
          patients={patients}
          appointments={appointments}
          vorbelegt={typeof neu === 'object' && !neu.bearbeiten ? neu : {}}
          bearbeiten={typeof neu === 'object' ? neu.bearbeiten || null : null}
          onClose={() => setNeu(false)}
        />
      )}
    </div>
  )
}
