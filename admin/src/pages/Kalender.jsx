import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { heuteISO, addTage, wochentag, zuMinuten, fensterFuer, imUrlaub } from '@shared/slots.js'
import { kalenderKonfiguriert, kalenderVerbunden, kalenderVerbinden } from '@shared/googleCalendar.js'
import { useLang, tr, datumLok } from '@shared/i18n.js'
import { istOffen, statusInfo } from '@shared/projektstatus.js'
import { teamsAus, teamFuerTermin, monteurNamen, textAuf, STANDARD_FARBE } from '@shared/teams.js'
import TerminModal from '../components/TerminModal.jsx'
import NeuerTermin from '../components/NeuerTermin.jsx'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'

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
    en: 'Click an assignment to open its details – click an empty area to create an appointment.',
    ar: 'النقر على مهمة يفتح تفاصيلها – والنقر على مساحة فارغة ينشئ موعدًا جديدًا.',
  },
  teams: { de: 'Teams', en: 'Teams', ar: 'الفرق' },
  alle: { de: 'Alle', en: 'All', ar: 'الكل' },
  baustellen: { de: 'Baustellen', en: 'Sites', ar: 'ورش البناء' },
  keineMonteure: {
    de: 'Keine aktiven Monteure – anlegen unter Einstellungen → Mitarbeiter.',
    en: 'No active fitters – add them under Settings → Staff.',
    ar: 'لا يوجد فنيون نشطون – أنشئهم في الإعدادات ← الموظفون.',
  },
  googleFehler: { de: 'Google-Kalender-Verbindung fehlgeschlagen:', en: 'Google Calendar connection failed:', ar: 'فشل الاتصال بتقويم جوجل:' },
}

const PX_PRO_30MIN = 26

function montagVon(iso) {
  const wt = wochentag(iso)
  return addTage(iso, wt === 0 ? -6 : 1 - wt)
}

function min(hhmm, fallback = 0) {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return fallback
  return zuMinuten(hhmm)
}

// Überlappende Termine NEBENEINANDER darstellen: Termine eines Tages in
// Cluster (= zusammenhängende Überschneidungen) zerlegen und je Cluster
// Spalten vergeben. Ergebnis je Termin: { spalte, spalten } -> left/width.
function spaltenLayout(termine) {
  const eintraege = termine
    .map((a) => {
      const von = min(a.start)
      return { a, von, bis: Math.max(min(a.ende, von + 30), von + 15) }
    })
    .sort((x, y) => x.von - y.von || x.bis - y.bis)

  const ergebnis = []
  let cluster = []
  let clusterEnde = -1

  function clusterAbschliessen() {
    if (!cluster.length) return
    const spaltenEnde = []
    for (const e of cluster) {
      let i = spaltenEnde.findIndex((ende) => ende <= e.von)
      if (i === -1) { i = spaltenEnde.length; spaltenEnde.push(e.bis) }
      else spaltenEnde[i] = e.bis
      e.spalte = i
    }
    for (const e of cluster) ergebnis.push({ ...e, spalten: spaltenEnde.length })
    cluster = []
    clusterEnde = -1
  }

  for (const e of eintraege) {
    if (cluster.length && e.von >= clusterEnde) clusterAbschliessen()
    cluster.push(e)
    clusterEnde = Math.max(clusterEnde, e.bis)
  }
  clusterAbschliessen()
  return ergebnis
}

export default function Kalender({ user }) {
  useLang()
  const navigate = useNavigate()
  const appointments = useCollection('appointments')
  const patients = useCollection('patients')
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const lvpositionen = useCollection('lvpositionen')
  const berichte = useCollection('berichte')
  const settingsRows = useCollection('settings')
  const pausen = settingsRows.find((r) => r.id === 'pausen')?.eintraege || []
  const ozDoc = settingsRows.find((r) => r.id === 'oeffnungszeiten')
  const zeiten = ozDoc?.fenster || null
  const telefonTage = ozDoc?.telefon || [5]
  const urlaubListe = ozDoc?.urlaub || []
  const [montag, setMontag] = useState(() => montagVon(heuteISO()))
  const [gewaehlt, setGewaehlt] = useState(null)
  const [neu, setNeu] = useState(false) // false | true | {datum, start} | {bearbeiten} | {projektId}
  const [gVerbunden, setGVerbunden] = useState(kalenderVerbunden())
  const [nurTeam, setNurTeam] = useState('') // '' = alle Teams

  const teams = useMemo(() => teamsAus(users), [users])

  // Samstag nur zeigen, wenn er Arbeitszeiten hat oder dort Termine existieren
  const tage = useMemo(() => {
    const samstag = addTage(montag, 5)
    const mitSamstag = fensterFuer(samstag, zeiten).length > 0 || appointments.some((a) => a.datum === samstag)
    return [0, 1, 2, 3, 4, ...(mitSamstag ? [5] : [])].map((i) => addTage(montag, i))
  }, [montag, zeiten, appointments])
  const heute = heuteISO()

  const proTag = useMemo(() => {
    const map = {}
    for (const t of tage) {
      const desTages = appointments.filter((a) => {
        if (a.datum !== t) return false
        if (!nurTeam) return true
        return teamFuerTermin(a, users).name === nurTeam
      })
      map[t] = spaltenLayout(desTages)
    }
    return map
  }, [appointments, tage, nurTeam, users])

  // Zeitraster folgt den Arbeitszeiten UND den vorhandenen Terminen (8–19 Uhr Grundbereich)
  const { START_STD, ENDE_STD } = useMemo(() => {
    let von = 8 * 60
    let bis = 19 * 60
    for (const t of tage) {
      for (const [fVon, fBis] of fensterFuer(t, zeiten)) {
        von = Math.min(von, min(fVon, von))
        bis = Math.max(bis, min(fBis, bis))
      }
      for (const e of proTag[t] || []) {
        von = Math.min(von, e.von)
        bis = Math.max(bis, e.bis)
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
    <div className={S.SEITE}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-schrift-stark">{tr(T.titel)}</h1>
        <div className="flex items-center gap-1 bg-karte rounded-full border border-rahmen p-1">
          <button onClick={() => setMontag(addTage(montag, -7))} className="p-1.5 hover:bg-gedeckt-tief rounded-full">
            <Icon name="arrowLeft" className="w-4 h-4 rtl:rotate-180" />
          </button>
          <button onClick={() => setMontag(montagVon(heute))} className="text-xs font-semibold px-3 py-1 hover:bg-gedeckt-tief rounded-full">
            {tr(T.heute)}
          </button>
          <button onClick={() => setMontag(addTage(montag, 7))} className="p-1.5 hover:bg-gedeckt-tief rounded-full">
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
                  : 'bg-karte border-rahmen text-schrift hover:border-praxis-400'
              }`}
            >
              {gVerbunden ? tr(T.googleOk) : tr(T.google)}
            </button>
          ) : (
            <span className="text-xs text-schrift-zart bg-karte border border-rahmen rounded-full px-3.5 py-2">
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

      {/* Team-Legende: Farben der Kolonnen; Klick filtert den Kalender */}
      <div className="mb-3 bg-karte rounded-karte border border-rahmen px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mr-1">{tr(T.teams)}</span>
        <button
          onClick={() => setNurTeam('')}
          className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition ${
            nurTeam === '' ? 'bg-schrift-stark border-schrift-stark text-white' : 'bg-karte border-rahmen text-schrift-leise hover:border-praxis-400'
          }`}
        >
          {tr(T.alle)}
        </button>
        {teams.length === 0 && (
          <span className="text-xs text-schrift-zart">{tr(T.keineMonteure)}</span>
        )}
        {teams.map((t) => {
          const aktiv = nurTeam === t.name
          return (
            <button
              key={t.name}
              onClick={() => setNurTeam(aktiv ? '' : t.name)}
              title={t.mitglieder.map((m) => m.name).join(', ')}
              className={`inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1.5 border transition ${
                aktiv ? 'text-white border-transparent' : 'bg-karte border-rahmen text-schrift hover:border-praxis-400'
              }`}
              style={aktiv ? { backgroundColor: t.farbe } : undefined}
            >
              <span className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: t.farbe }} />
              {t.name}
              <span className={`text-[11px] font-bold ${aktiv ? 'text-white/70' : 'text-schrift-zart'}`}>
                {t.mitglieder.length}
              </span>
            </button>
          )
        })}
      </div>

      <div className="bg-karte rounded-karte border border-rahmen shadow-karte overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Kopfzeile */}
          <div className="grid" style={{ gridTemplateColumns: `52px repeat(${tage.length}, 1fr)` }}>
            <div />
            {tage.map((t) => (
              <div
                key={t}
                className={`px-2 py-3 text-center border-l border-rahmen ${t === heute ? 'bg-praxis-50' : ''}`}
              >
                <p className={`text-sm font-bold ${t === heute ? 'text-praxis-700' : 'text-schrift'}`}>
                  {datumLok(t, { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <p className="text-[11px] text-schrift-zart">
                  {(() => {
                    const anzahl = proTag[t]?.filter((e) => e.a.status !== 'abgesagt').length || 0
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
          <div className="grid border-t border-rahmen" style={{ gridTemplateColumns: `52px repeat(${tage.length}, 1fr)` }}>
            {/* Zeitspalte */}
            <div className="relative" style={{ height: (ENDE_STD - START_STD) * 2 * PX_PRO_30MIN }}>
              {stunden.map((h) => (
                <p
                  key={h}
                  className="absolute right-2 text-[11px] text-schrift-zart -translate-y-1/2"
                  style={{ top: (h - START_STD) * 2 * PX_PRO_30MIN }}
                >
                  {String(h).padStart(2, '0')}:00
                </p>
              ))}
            </div>
            {tage.map((t) => (
              <div
                key={t}
                className={`relative border-l border-rahmen cursor-pointer ${t === heute ? 'bg-praxis-50/40' : ''} ${fensterFuer(t, zeiten).length === 0 || imUrlaub(t, urlaubListe) ? 'bg-gedeckt' : ''}`}
                style={{ height: (ENDE_STD - START_STD) * 2 * PX_PRO_30MIN }}
                onClick={(e) => {
                  // Klick auf eine freie Fläche -> neuer Termin mit Datum + Uhrzeit vorbelegt
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                  const minuten = START_STD * 60 + Math.floor(y / PX_PRO_30MIN) * 30
                  const start = `${String(Math.floor(minuten / 60)).padStart(2, '0')}:${String(minuten % 60).padStart(2, '0')}`
                  setNeu({ datum: t, start })
                }}
              >
                {stunden.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-rahmen"
                    style={{ top: (h - START_STD) * 2 * PX_PRO_30MIN }}
                  />
                ))}
                {/* Wiederkehrende Pausen aus dem Wochenplan (Einstellungen) – schraffiert */}
                {pausen.filter((p) => p.tag === wochentag(t)).map((p, i) => (
                  <div
                    key={`pause-${i}`}
                    className="absolute inset-x-0 pointer-events-none bg-amber-100/70 border-y border-amber-200 flex items-center justify-center"
                    style={{
                      top: ((min(p.von) - START_STD * 60) / 30) * PX_PRO_30MIN,
                      height: ((min(p.bis) - min(p.von)) / 30) * PX_PRO_30MIN,
                      backgroundImage: 'repeating-linear-gradient(45deg, rgba(217,119,6,0.08) 0 6px, transparent 6px 12px)',
                    }}
                  >
                    <span className="text-[10px] font-bold text-amber-700/80 truncate px-1">☕ {p.grund}</span>
                  </div>
                ))}
                {(proTag[t] || []).map(({ a, von, bis, spalte, spalten }) => {
                  const top = ((von - START_STD * 60) / 30) * PX_PRO_30MIN
                  const hoehe = Math.max(((bis - von) / 30) * PX_PRO_30MIN - 2, 26)
                  const team = teamFuerTermin(a, users)
                  const abgesagt = a.status === 'abgesagt'
                  const farbe = a.intern ? '#475569' : abgesagt ? '#fecaca' : team.farbe || STANDARD_FARBE
                  const schrift = abgesagt ? '#b91c1c' : textAuf(farbe)
                  const namen = monteurNamen(a, users)
                  const breite = 100 / spalten
                  return (
                    <button
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (a.intern) setNeu({ bearbeiten: a })
                        else setGewaehlt(a)
                      }}
                      className={`absolute rounded-feld border px-1.5 py-1 text-left overflow-hidden shadow-karte hover:brightness-110 hover:z-20 transition ${abgesagt ? 'line-through' : ''}`}
                      style={{
                        top: top + 1,
                        height: hoehe,
                        left: `calc(${spalte * breite}% + 2px)`,
                        width: `calc(${breite}% - 4px)`,
                        backgroundColor: farbe,
                        borderColor: 'rgba(0,0,0,0.18)',
                        color: schrift,
                        ...(a.intern
                          ? { backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 6px, transparent 6px 12px)' }
                          : {}),
                      }}
                      title={`${a.start}–${a.ende} · ${team.name}${namen ? ` · ${namen}` : ''}\n${a.titel || a.behandlung || ''}`}
                    >
                      {/* Monteur GROSS + hervorgehoben, darüber klein das Team ausgeschrieben */}
                      {team.explizit && (
                        <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 truncate leading-tight">
                          {team.name}
                        </p>
                      )}
                      <p className="text-[14px] font-extrabold leading-tight truncate">
                        {namen || 'Nicht zugewiesen'}
                      </p>
                      {hoehe > 44 && (
                        <p className="text-[11px] opacity-90 leading-tight truncate">
                          {a.start}–{a.ende} · {a.titel || a.behandlung || ''}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-schrift-zart">{tr(T.hinweis)}</p>

      {/* Baustellen-Informationen mit Direkt-Aktionen (ersetzt die alten Terminanfragen) */}
      <BaustellenPanel
        projekte={projekte}
        kunden={patients}
        appointments={appointments}
        lvpositionen={lvpositionen}
        berichte={berichte}
        onAufgabe={(projektId) => setNeu({ projektId })}
        navigate={navigate}
      />

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

// ---------- Baustellen-Panel unter dem Kalender ----------

function BaustellenPanel({ projekte, kunden, appointments, lvpositionen, berichte, onAufgabe, navigate }) {
  const [alleZeigen, setAlleZeigen] = useState(false)
  const heute = heuteISO()

  const zeilen = useMemo(() => {
    const liste = projekte
      .filter((p) => alleZeigen || istOffen(p.status))
      .map((p) => {
        const pos = lvpositionen.filter((x) => x.projektId === p.id && x.typ === 'position' && !x.flags?.bedarf && !x.flags?.nep)
        const soll = pos.reduce((s, x) => s + (x.menge || 0) * (x.einheitspreis || 0), 0) || Number(p.projektvolumen) || 0
        const ist = pos.reduce((s, x) => s + (x.istMenge || 0) * (x.einheitspreis || 0), 0)
        const termine = appointments.filter((t) => t.projektId === p.id && t.status !== 'abgesagt')
        const naechster = termine
          .filter((t) => t.datum >= heute)
          .sort((a, b) => `${a.datum}${a.start}`.localeCompare(`${b.datum}${b.start}`))[0]
        const offeneBerichte = berichte.filter((b) => b.projektId === p.id && b.status === 'eingereicht').length
        return {
          p,
          kunde: kunden.find((k) => k.id === p.kundeId),
          soll,
          ist,
          prozent: soll > 0 ? Math.min(100, Math.round((ist / soll) * 100)) : 0,
          offeneTermine: termine.filter((t) => !t.erledigt).length,
          naechster,
          offeneBerichte,
        }
      })
    return liste.sort((a, b) => (a.p.nummer || '').localeCompare(b.p.nummer || ''))
  }, [projekte, kunden, appointments, lvpositionen, berichte, alleZeigen, heute])

  const knopf = 'inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border transition whitespace-nowrap'

  return (
    <div className="mt-5 bg-karte rounded-karte border border-rahmen shadow-karte overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-b border-rahmen bg-gedeckt/70">
        <Icon name="folder" className="w-4 h-4 text-praxis-700" />
        <p className="font-bold text-sm text-schrift-stark">{tr(T.baustellen)}</p>
        <span className="bg-praxis-600 text-white text-xs font-bold rounded-full px-2 py-0.5">{zeilen.length}</span>
        <button
          onClick={() => setAlleZeigen(!alleZeigen)}
          className="ml-auto text-xs font-semibold text-schrift-leise hover:text-praxis-700"
        >
          {alleZeigen ? 'nur offene zeigen' : 'auch abgeschlossene zeigen'}
        </button>
        <button
          onClick={() => navigate('/projekte')}
          className="text-xs font-semibold text-praxis-700 hover:underline"
        >
          Alle Projekte →
        </button>
      </div>

      {zeilen.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-schrift-zart">
          Keine offenen Baustellen. Neue Baustelle anlegen unter Projekte → „Neues Projekt".
        </p>
      ) : (
        <div className="divide-y divide-rahmen">
          {zeilen.map(({ p, kunde, soll, ist, prozent, offeneTermine, naechster, offeneBerichte }) => {
            const st = statusInfo(p.status)
            return (
              <div key={p.id} className="px-5 py-4 flex flex-wrap items-start gap-x-4 gap-y-3">
                <div className="min-w-[240px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.farbe || st.farbe }} />
                    <button
                      onClick={() => navigate(`/projekte/${p.id}`)}
                      className="font-semibold text-schrift-stark hover:text-praxis-700 hover:underline text-left"
                    >
                      {p.name}
                    </button>
                    <span className="text-[12px] font-mono text-schrift-zart">{p.nummer}</span>
                    <span
                      className="text-[11px] font-bold rounded-full px-2 py-0.5"
                      style={{ backgroundColor: `${st.farbe}1f`, color: st.farbe }}
                    >
                      {st.label}
                    </span>
                    {offeneBerichte > 0 && (
                      <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-sky-100 text-sky-700">
                        {offeneBerichte} Bericht(e) zur Freigabe
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-schrift-leise">
                    {kunde ? (kunde.firma || `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim()) : 'kein Kunde'}
                    {p.anschrift?.strasse ? ` · ${p.anschrift.strasse}` : ''}
                    {p.anschrift?.plzOrt ? `, ${p.anschrift.plzOrt}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-schrift-zart">
                    {naechster
                      ? `Nächster Einsatz: ${new Date(naechster.datum + 'T12:00:00').toLocaleDateString('de-DE')} · ${naechster.start} Uhr`
                      : 'Kein Einsatz geplant'}
                    {offeneTermine > 0 ? ` · ${offeneTermine} offen` : ''}
                  </p>
                  {soll > 0 && (
                    <div className="mt-2 max-w-xs">
                      <div className="h-1.5 bg-gedeckt-tief rounded-full overflow-hidden">
                        <div className="h-full bg-praxis-600 rounded-full" style={{ width: `${prozent}%` }} />
                      </div>
                      <p className="mt-1 text-[12px] text-schrift-zart">
                        {prozent} % geleistet ({euro(ist)} von {euro(soll)})
                      </p>
                    </div>
                  )}
                </div>

                {/* Direkt-Aktionen */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => onAufgabe(p.id)}
                    className={`${knopf} bg-praxis-600 border-praxis-600 text-white hover:bg-praxis-700`}
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" /> Aufgabe
                  </button>
                  <button
                    onClick={() => navigate(`/projekte/${p.id}?bereich=regie`)}
                    className={`${knopf} bg-karte border-rahmen text-schrift hover:border-praxis-400`}
                  >
                    <Icon name="bericht" className="w-3.5 h-3.5" /> Bericht
                  </button>
                  <button
                    onClick={() => navigate(`/projekte/${p.id}?bereich=rechnungen`)}
                    className={`${knopf} bg-karte border-rahmen text-schrift hover:border-praxis-400`}
                  >
                    <Icon name="euro" className="w-3.5 h-3.5" /> Abrechnung
                  </button>
                  <button
                    onClick={() => navigate(`/projekte/${p.id}?bereich=lv`)}
                    className={`${knopf} bg-karte border-rahmen text-schrift hover:border-praxis-400`}
                  >
                    <Icon name="list" className="w-3.5 h-3.5" /> LV
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
