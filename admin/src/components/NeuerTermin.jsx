import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { freieSlots, buchbareTage, endeZeit, heuteISO, addTage, wochentag as wochentagVon, imUrlaub } from '@shared/slots.js'
import { withStore, useCollection } from '../hooks.js'
import { kalenderVerbunden, eventAnlegen } from '@shared/googleCalendar.js'
import { istOffen } from '@shared/projektstatus.js'

const DAUERN = [30, 60, 90, 120, 180, 240, 480, 600]

// Termin-Kategorien der Baustellen-Planung (Reihenfolge = Anzeige im Select)
export const KATEGORIEN = [
  ['umsetzung', 'Umsetzung'],
  ['fertigstellung', 'Fertigstellung'],
  ['reklamation', 'Reklamationsarbeit'],
  ['krank', 'Krank/Abwesend'],
  ['privat', 'Privater Termin'],
]

function dauerLabel(min) {
  if (min < 60) return `${min} Minuten`
  const std = min / 60
  return `${std.toLocaleString('de-DE')} Std.`
}

function tagLabel(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })
}

function kundeName(k) {
  if (!k) return ''
  return k.firma || `${k.vorname} ${k.nachname}`.trim()
}

// Halbe Stunden von 07:00 bis 20:00 – interne Blocker dürfen auch außerhalb
// der Arbeitszeiten liegen (Frühbesprechung, Materialfahrt, ganzer Nachmittag …)
const INTERN_ZEITEN = []
for (let m = 7 * 60; m <= 20 * 60; m += 30) {
  INTERN_ZEITEN.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
}

// bearbeiten: vorhandener INTERNER Termin -> Dialog wird zum Editor (Zeiten ändern, löschen)
export default function NeuerTermin({ patients, appointments, vorbelegt = {}, bearbeiten = null, onClose, onAngelegt }) {
  const [typ, setTyp] = useState(bearbeiten ? 'intern' : 'patient') // patient (=Einsatz/Termin) | intern (Blocker)
  const [grund, setGrund] = useState(bearbeiten?.behandlung || '')
  const [von, setVon] = useState(bearbeiten?.start || vorbelegt.start || '09:00')
  const [bis, setBis] = useState(bearbeiten?.ende || (vorbelegt.start ? endeZeit(vorbelegt.start, 60) : '10:00'))
  const [suche, setSuche] = useState(vorbelegt.patientName || '')
  const [patientId, setPatientId] = useState(vorbelegt.patientId || null)
  const [titel, setTitel] = useState(vorbelegt.titel || vorbelegt.behandlung || '')
  const [kategorie, setKategorie] = useState(vorbelegt.kategorie || 'umsetzung')
  const [projektId, setProjektId] = useState(vorbelegt.projektId || '')
  const [beschreibung, setBeschreibung] = useState(vorbelegt.beschreibung || '')
  const [mitarbeiterIds, setMitarbeiterIds] = useState(bearbeiten?.mitarbeiterIds || vorbelegt.mitarbeiterIds || [])
  const [dauer, setDauer] = useState(vorbelegt.dauer || 60)
  const [datum, setDatum] = useState(bearbeiten?.datum || vorbelegt.datum || heuteISO())
  const [start, setStart] = useState(vorbelegt.start || '')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)

  // Interne Blocker: alle Kalendertage der nächsten 3 Wochen (auch Fr/Sa/So)
  const internTage = useMemo(() => Array.from({ length: 21 }, (_, i) => addTage(heuteISO(), i)), [])

  // Mitarbeiter kommen aus der users-Sammlung (statt hartcodierter Liste)
  const alleUsers = useCollection('users')
  const monteure = useMemo(() => alleUsers.filter((u) => u.rolle === 'mitarbeiter' && u.aktiv), [alleUsers])
  const gewaehlteNamen = mitarbeiterIds.map((id) => alleUsers.find((u) => u.id === id)?.name).filter(Boolean)

  // Projekte (Baustellen): offene zuerst zur Auswahl, gewähltes bleibt immer sichtbar
  const projekte = useCollection('projekte')
  const projektAuswahl = useMemo(
    () =>
      projekte
        .filter((p) => istOffen(p.status) || p.id === projektId)
        .sort((a, b) => (a.nummer || '').localeCompare(b.nummer || '')),
    [projekte, projektId]
  )

  function toggleMitarbeiter(id) {
    setMitarbeiterIds((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]))
  }

  function projektWaehlen(id) {
    setProjektId(id)
    const p = projekte.find((x) => x.id === id)
    if (!p) return
    // Kunde des Projekts automatisch übernehmen
    if (p.kundeId && patients.some((k) => k.id === p.kundeId)) {
      setPatientId(p.kundeId)
      setSuche('')
    }
    // Titel-Vorschlag, solange noch nichts eingetippt wurde
    if (!titel.trim()) {
      const katLabel = KATEGORIEN.find(([k]) => k === kategorie)?.[1] || 'Einsatz'
      setTitel(`${katLabel} – ${p.name}`)
    }
  }

  async function internLoeschen() {
    if (!bearbeiten || !confirm('Diesen internen Termin löschen? Das Zeitfenster wird wieder frei.')) return
    await withStore(async (s) => {
      await s.remove('appointments', bearbeiten.id)
      if (s.mode === 'firebase') await s.loescheSlot(bearbeiten.id)
    })
    onClose()
  }

  // Pausen + konfigurierte Arbeitszeiten aus den Einstellungen gelten auch intern
  const settingsRows = useCollection('settings')
  const pausen = settingsRows.find((r) => r.id === 'pausen')?.eintraege || []
  const ozDoc = settingsRows.find((r) => r.id === 'oeffnungszeiten')
  const zeiten = ozDoc?.fenster || null
  const urlaub = ozDoc?.urlaub || []

  const busy = useMemo(
    () => appointments.filter((t) => t.status !== 'abgesagt').map((t) => ({ datum: t.datum, start: t.start, ende: t.ende })),
    [appointments]
  )
  const tage = useMemo(() => buchbareTage(21, zeiten).filter((t) => !imUrlaub(t, urlaub)), [zeiten, urlaub])
  const slots = useMemo(() => {
    // Urlaub blockt Termine komplett (interne Blocker bleiben möglich)
    if (imUrlaub(datum, urlaub)) return []
    const tagesPausen = pausen
      .filter((p) => p.tag === wochentagVon(datum))
      .map((p) => ({ datum, start: p.von, ende: p.bis }))
    return freieSlots(datum, dauer, [...busy, ...tagesPausen], zeiten)
  }, [datum, dauer, busy, pausen, zeiten, urlaub])

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase()
    if (q.length < 2) return []
    return patients
      .filter(
        (p) =>
          `${p.firma || ''} ${p.vorname} ${p.nachname}`.toLowerCase().includes(q) ||
          (p.telefon || '').includes(q)
      )
      .slice(0, 6)
  }, [suche, patients])

  const gewaehlt = patients.find((p) => p.id === patientId)

  async function anlegen() {
    setFehler('')
    const intern = typ === 'intern'
    const ohneKunde = kategorie === 'krank' || kategorie === 'privat'
    if (!intern && !ohneKunde && !gewaehlt) {
      return setFehler('Bitte einen Kunden wählen oder ein Projekt zuordnen (bei Krank/Privat nicht nötig).')
    }
    if (intern && bis <= von) return setFehler('„Bis“ muss nach „Von“ liegen.')
    if (!datum || (!intern && !start)) return setFehler('Bitte Datum und Uhrzeit wählen.')
    // Auch vorbelegte Zeiten (Klick im Kalender) müssen in den Arbeitszeiten liegen und frei sein
    if (!intern && !bearbeiten && !slots.includes(start)) {
      return setFehler('Die Uhrzeit liegt außerhalb der Arbeitszeiten oder ist belegt – bitte eine der freien Uhrzeiten wählen.')
    }
    setLaedt(true)
    try {
      // BEARBEITEN eines bestehenden internen Termins: Zeiten/Grund/Mitarbeiter ändern
      if (bearbeiten) {
        await withStore(async (s) => {
          const patch = {
            behandlung: grund.trim() || 'Intern',
            titel: grund.trim() || 'Intern',
            patientName: `Intern: ${grund.trim() || 'Blockiert'}`,
            arzt: gewaehlteNamen[0] || '',
            mitarbeiterIds,
            datum, start: von, ende: bis,
          }
          await s.update('appointments', bearbeiten.id, patch)
          if (s.mode === 'firebase') await s.schreibeSlot({ ...bearbeiten, ...patch })
        })
        onAngelegt?.()
        onClose()
        return
      }
      const termin = intern
        ? {
            // Interner Blocker: kein Kunde, Slot wird online gesperrt
            intern: true,
            patientId: '',
            patientName: `Intern: ${grund.trim() || 'Blockiert'}`,
            datum,
            start: von,
            ende: bis,
            behandlung: grund.trim() || 'Intern',
            titel: grund.trim() || 'Intern',
            kategorie: 'privat',
            projektId: '',
            mitarbeiterIds,
            beschreibung: '',
            erledigt: false,
            erledigtAm: '',
            positionsIds: [],
            status: 'bestaetigt',
            erinnerung: 'gesendet', // keine Erinnerungs-/Feedback-Mails für interne Termine
            arzt: gewaehlteNamen[0] || '',
            summary: { text: '', checks: [], updatedAt: null, updatedBy: '' },
            googleEventId: null,
            patientEmail: '',
            sprache: 'de',
            stornoToken: crypto.randomUUID(),
            feedbackToken: '',
          }
        : {
            patientId: gewaehlt?.id || '',
            patientName: kundeName(gewaehlt),
            datum,
            start,
            ende: endeZeit(start, dauer),
            behandlung: titel.trim() || 'Einsatz',
            titel: titel.trim() || 'Einsatz',
            kategorie,
            projektId: projektId || '',
            mitarbeiterIds,
            beschreibung: beschreibung.trim(),
            erledigt: false,
            erledigtAm: '',
            positionsIds: [],
            status: 'bestaetigt',
            erinnerung: 'offen',
            arzt: gewaehlteNamen[0] || '',
            summary: { text: '', checks: [], updatedAt: null, updatedBy: '' },
            befunde: [],
            leistungen: [],
            rechnung: 'offen',
            googleEventId: null,
            patientEmail: gewaehlt?.email || '',
            sprache: 'de',
            stornoToken: crypto.randomUUID(),
            feedbackToken: crypto.randomUUID(),
          }
      await withStore(async (s) => {
        const id = await s.add('appointments', termin)
        termin.id = id
        if (s.mode === 'firebase') await s.schreibeSlot(termin)
        if (!intern && kalenderVerbunden()) {
          try {
            const eventId = await eventAnlegen(termin, gewaehlt?.email || '')
            if (eventId) await s.update('appointments', id, { googleEventId: eventId })
          } catch (e) { /* Google nicht erreichbar – Termin bleibt trotzdem bestehen */ }
        }
      })
      onAngelegt?.()
      onClose()
    } catch (e) {
      setFehler('Termin konnte nicht angelegt werden.')
    } finally {
      setLaedt(false)
    }
  }

  return (
    <Modal titel={bearbeiten ? 'Internen Termin bearbeiten' : 'Neuer Termin'} onClose={onClose} breite="max-w-xl">
      <div className="space-y-4">
        {/* Termin-Art: Einsatz/Termin oder interner Blocker (online nicht buchbar) */}
        <div className={`flex gap-2 ${bearbeiten ? 'hidden' : ''}`}>
          {[['patient', 'Einsatz / Termin'], ['intern', 'Intern blockieren']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTyp(key)}
              className={`flex-1 text-sm font-semibold rounded-xl px-3 py-2.5 border-2 transition ${
                typ === key
                  ? key === 'intern' ? 'bg-slate-700 border-slate-700 text-white' : 'bg-praxis-600 border-praxis-600 text-white'
                  : 'border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {typ === 'intern' && (
          <>
            <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-2.5">
              Interner Termin: Das Zeitfenster wird blockiert und ist online NICHT buchbar (Besprechung, Materialfahrt, Puffer …).
            </p>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Bezeichnung / Grund</span>
              <input
                autoFocus
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                placeholder="z. B. Teambesprechung, Materialfahrt, Urlaub …"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
              />
            </label>
          </>
        )}

        {typ === 'patient' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Kategorie</span>
              <select
                value={kategorie}
                onChange={(e) => setKategorie(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
              >
                {KATEGORIEN.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Projekt (optional)</span>
              <select
                value={projektId}
                onChange={(e) => projektWaehlen(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
              >
                <option value="">– kein Projekt –</option>
                {projektAuswahl.map((p) => (
                  <option key={p.id} value={p.id}>{p.nummer} · {p.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Kunde suchen (bei Krank/Privat optional) */}
        <div className={typ === 'intern' ? 'hidden' : ''}>
          <span className="text-sm font-medium text-slate-700">
            Kunde {kategorie === 'krank' || kategorie === 'privat' ? '(optional)' : '*'}
          </span>
          {gewaehlt ? (
            <div className="mt-1.5 flex items-center justify-between bg-praxis-50 border border-praxis-200 rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{kundeName(gewaehlt)}</p>
                <p className="text-xs text-slate-500">
                  {[gewaehlt.ansprechpartner, gewaehlt.telefon].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button onClick={() => { setPatientId(null); setSuche('') }} className="text-xs text-praxis-700 font-medium hover:underline">
                Ändern
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Firma, Name oder Telefonnummer suchen …"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
              />
              {treffer.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {treffer.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPatientId(p.id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-praxis-50 text-sm border-b border-slate-50 last:border-0"
                    >
                      <span className="font-medium">{kundeName(p)}</span>
                      <span className="text-slate-400 text-xs ml-2">{p.telefon}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {typ === 'patient' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Titel</span>
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="z. B. Umsetzung – 1. OG Flure streichen"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
            />
          </label>
        )}

        {/* Mitarbeiter als Chips-Mehrfachauswahl (Farbe = Punkt) */}
        <div>
          <span className="text-sm font-medium text-slate-700">Mitarbeiter</span>
          {monteure.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-2.5">
              Keine aktiven Mitarbeiter angelegt.
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {monteure.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleMitarbeiter(u.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2 border-2 transition ${
                    mitarbeiterIds.includes(u.id)
                      ? 'bg-praxis-600 border-praxis-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-praxis-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: u.farbe || '#94a3b8' }} />
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`grid gap-3 ${typ === 'intern' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Tag</span>
            <select
              value={datum}
              onChange={(e) => { setDatum(e.target.value); setStart('') }}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
            >
              {(typ === 'intern' ? internTage : tage).includes(datum) ? null : (
                <option value={datum}>{tagLabel(datum)}</option>
              )}
              {(typ === 'intern' ? internTage : tage).map((t) => (
                <option key={t} value={t}>{tagLabel(t)}</option>
              ))}
            </select>
          </label>
          {typ === 'intern' ? (
            <>
              {/* Von–Bis frei wählbar: auch lange Blöcke (ganzer Nachmittag) möglich */}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Von</span>
                <select
                  value={von}
                  onChange={(e) => { setVon(e.target.value); if (bis <= e.target.value) setBis(endeZeit(e.target.value, 60)) }}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
                >
                  {INTERN_ZEITEN.slice(0, -1).map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Bis</span>
                <select
                  value={bis}
                  onChange={(e) => setBis(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
                >
                  {INTERN_ZEITEN.filter((z) => z > von).map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
            </>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Dauer</span>
              <select
                value={dauer}
                onChange={(e) => { setDauer(Number(e.target.value)); setStart('') }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
              >
                {DAUERN.map((d) => <option key={d} value={d}>{dauerLabel(d)}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className={typ === 'intern' ? 'hidden' : ''}>
          <span className="text-sm font-medium text-slate-700">Freie Uhrzeiten</span>
          {slots.length === 0 ? (
            <p className="mt-1.5 text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-3">
              An diesem Tag ist nichts mehr frei – bitte anderen Tag oder kürzere Dauer wählen.
            </p>
          ) : (
            <div className="mt-1.5 grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => setStart(s)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                    start === s
                      ? 'bg-praxis-600 border-praxis-600 text-white'
                      : 'border-slate-100 text-slate-700 hover:border-praxis-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {typ === 'patient' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Beschreibung</span>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={3}
              placeholder="Hinweise für das Team: Material, Zugang, Ansprechpartner vor Ort …"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
            />
          </label>
        )}

        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>}
        <div className="flex gap-2">
          <button
            onClick={anlegen}
            disabled={laedt}
            className="flex-1 bg-praxis-600 hover:bg-praxis-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl"
          >
            {laedt ? 'Wird angelegt …' : bearbeiten ? 'Änderungen speichern' : typ === 'intern' ? 'Zeitfenster blockieren' : 'Termin anlegen'}
          </button>
          {bearbeiten && (
            <button
              onClick={internLoeschen}
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold px-4 rounded-xl text-sm"
            >
              Löschen
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
