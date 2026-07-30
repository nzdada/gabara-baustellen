import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { freieSlots, buchbareTage, endeZeit, heuteISO, addTage, wochentag as wochentagVon, imUrlaub } from '@shared/slots.js'
import { withStore, useCollection } from '../hooks.js'
import { kalenderVerbunden, eventAnlegen } from '@shared/googleCalendar.js'
import { useLang, tr, datumLok } from '@shared/i18n.js'

const DAUERN = [15, 30, 45, 60, 90]
const AERZTE = ['J. Strötz', 'I. Steidle', 'E. Erben']

// Halbe Stunden von 07:00 bis 20:00 – interne Termine dürfen auch außerhalb
// der Öffnungszeiten liegen (Frühbesprechung, Abend-Labor, ganzer Nachmittag …)
const INTERN_ZEITEN = []
for (let m = 7 * 60; m <= 20 * 60; m += 30) {
  INTERN_ZEITEN.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
}

const T = {
  titel: { de: 'Neuer Termin', en: 'New appointment', ar: 'موعد جديد' },
  typPatient: { de: '👤 Termin mit Patient', en: '👤 Patient appointment', ar: '👤 موعد مع مريض' },
  typIntern: { de: '🔒 Praxis-Termin (blockieren)', en: '🔒 Practice slot (block)', ar: '🔒 موعد داخلي (حجب)' },
  internHinweis: { de: 'Interner Termin: Das Zeitfenster wird blockiert und ist online NICHT buchbar (Besprechung, Labor, Pause, Notfall-Puffer …).', en: 'Internal slot: the time is blocked and NOT bookable online (meeting, lab, break, emergency buffer …).', ar: 'موعد داخلي: يُحجب الوقت ولا يمكن حجزه عبر الإنترنت.' },
  grund: { de: 'Bezeichnung / Grund', en: 'Title / reason', ar: 'الوصف / السبب' },
  grundPlatzhalter: { de: 'z. B. Teambesprechung, Labor, Mittagspause …', en: 'e.g. team meeting, lab, lunch break …', ar: 'مثال: اجتماع الفريق، مختبر، استراحة …' },
  blockieren: { de: 'Zeitfenster blockieren', en: 'Block time slot', ar: 'حجب الوقت' },
  bearbeitenTitel: { de: 'Praxis-Termin bearbeiten', en: 'Edit practice slot', ar: 'تعديل الموعد الداخلي' },
  von: { de: 'Von', en: 'From', ar: 'من' },
  bis: { de: 'Bis', en: 'Until', ar: 'إلى' },
  speichern: { de: 'Änderungen speichern', en: 'Save changes', ar: 'حفظ التغييرات' },
  loeschen: { de: 'Blockierung löschen', en: 'Delete block', ar: 'حذف الحجب' },
  loeschenFrage: { de: 'Diesen Praxis-Termin löschen? Das Zeitfenster wird wieder online buchbar.', en: 'Delete this practice slot? The time becomes bookable online again.', ar: 'حذف هذا الموعد الداخلي؟ سيصبح الوقت متاحًا للحجز مجددًا.' },
  fehlerVonBis: { de: '„Bis" muss nach „Von" liegen.', en: '“Until” must be after “From”.', ar: 'يجب أن يكون "إلى" بعد "من".' },
  patient: { de: 'Patient *', en: 'Patient *', ar: 'المريض *' },
  suchen: { de: 'Name oder Telefonnummer suchen …', en: 'Search name or phone number …', ar: 'ابحث بالاسم أو رقم الهاتف …' },
  aendern: { de: 'Ändern', en: 'Change', ar: 'تغيير' },
  behandlung: { de: 'Behandlung', en: 'Treatment', ar: 'العلاج' },
  behandler: { de: 'Behandler', en: 'Practitioner', ar: 'المعالج' },
  tag: { de: 'Tag', en: 'Day', ar: 'اليوم' },
  dauer: { de: 'Dauer', en: 'Duration', ar: 'المدة' },
  minuten: { de: 'Minuten', en: 'minutes', ar: 'دقيقة' },
  freie: { de: 'Freie Uhrzeiten', en: 'Available times', ar: 'الأوقات المتاحة' },
  nichtsFrei: { de: 'An diesem Tag ist nichts mehr frei – bitte anderen Tag wählen.', en: 'Nothing available on this day – please choose another day.', ar: 'لا يوجد وقت متاح في هذا اليوم – يرجى اختيار يوم آخر.' },
  fehlerPatient: { de: 'Bitte einen Patienten auswählen (oder erst unter „Patienten" anlegen).', en: 'Please select a patient (or create one under “Patients” first).', ar: 'يرجى اختيار مريض (أو إنشاؤه أولًا في "المرضى").' },
  fehlerZeit: { de: 'Bitte Datum und Uhrzeit wählen.', en: 'Please choose date and time.', ar: 'يرجى اختيار التاريخ والوقت.' },
  fehlerSlot: { de: 'Die Uhrzeit liegt außerhalb der Öffnungszeiten oder ist belegt – bitte eine der freien Uhrzeiten wählen.', en: 'This time is outside opening hours or already taken – please pick one of the available times.', ar: 'هذا الوقت خارج ساعات العمل أو محجوز – يرجى اختيار وقت متاح.' },
  fehlerAnlegen: { de: 'Termin konnte nicht angelegt werden.', en: 'Appointment could not be created.', ar: 'تعذر إنشاء الموعد.' },
  anlegen: { de: 'Termin anlegen', en: 'Create appointment', ar: 'إنشاء الموعد' },
  laedt: { de: 'Wird angelegt …', en: 'Creating …', ar: 'جارٍ الإنشاء …' },
}

// bearbeiten: vorhandener INTERNER Termin -> Dialog wird zum Editor (Zeiten ändern, löschen)
export default function NeuerTermin({ patients, appointments, vorbelegt = {}, bearbeiten = null, onClose, onAngelegt }) {
  useLang()
  const [typ, setTyp] = useState(bearbeiten ? 'intern' : 'patient') // patient | intern (Blocker)
  const [grund, setGrund] = useState(bearbeiten?.behandlung || '')
  const [von, setVon] = useState(bearbeiten?.start || vorbelegt.start || '09:00')
  const [bis, setBis] = useState(bearbeiten?.ende || (vorbelegt.start ? endeZeit(vorbelegt.start, 60) : '10:00'))
  const [suche, setSuche] = useState(vorbelegt.patientName || '')
  const [patientId, setPatientId] = useState(vorbelegt.patientId || null)
  const [behandlung, setBehandlung] = useState(vorbelegt.behandlung || 'Kontrolluntersuchung')
  const [dauer, setDauer] = useState(vorbelegt.dauer || 30)
  const [datum, setDatum] = useState(bearbeiten?.datum || vorbelegt.datum || heuteISO())
  const [start, setStart] = useState(vorbelegt.start || '')
  const [arzt, setArzt] = useState(bearbeiten?.arzt || AERZTE[0])
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)

  // Interne Termine: alle Kalendertage der nächsten 3 Wochen (auch Fr/Sa/So)
  const internTage = useMemo(() => Array.from({ length: 21 }, (_, i) => addTage(heuteISO(), i)), [])

  async function internLoeschen() {
    if (!bearbeiten || !confirm(tr(T.loeschenFrage))) return
    await withStore(async (s) => {
      await s.remove('appointments', bearbeiten.id)
      if (s.mode === 'firebase') await s.loescheSlot(bearbeiten.id)
    })
    onClose()
  }

  // Pausen + konfigurierte Öffnungszeiten aus den Einstellungen gelten auch intern
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
    // Urlaub blockt Patiententermine komplett (interne Blocker bleiben möglich)
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
      .filter((p) => `${p.vorname} ${p.nachname}`.toLowerCase().includes(q) || (p.telefon || '').includes(q))
      .slice(0, 6)
  }, [suche, patients])

  const gewaehlt = patients.find((p) => p.id === patientId)

  async function anlegen() {
    setFehler('')
    const intern = typ === 'intern'
    if (!intern && !gewaehlt) return setFehler(tr(T.fehlerPatient))
    if (intern && bis <= von) return setFehler(tr(T.fehlerVonBis))
    if (!datum || (!intern && !start)) return setFehler(tr(T.fehlerZeit))
    // Auch vorbelegte Zeiten (Klick im Kalender) müssen in den Öffnungszeiten liegen und frei sein
    if (!intern && !bearbeiten && !slots.includes(start)) return setFehler(tr(T.fehlerSlot))
    setLaedt(true)
    try {
      // BEARBEITEN eines bestehenden internen Termins: Zeiten/Grund/Behandler ändern
      if (bearbeiten) {
        await withStore(async (s) => {
          const patch = {
            behandlung: grund.trim() || 'Praxis-intern',
            patientName: `🔒 ${grund.trim() || 'Praxis-intern'}`,
            arzt, datum, start: von, ende: bis,
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
            // Interner Blocker: kein Patient, Slot wird online gesperrt
            intern: true,
            patientId: '',
            patientName: `🔒 ${grund.trim() || 'Praxis-intern'}`,
            datum,
            start: von,
            ende: bis,
            behandlung: grund.trim() || 'Praxis-intern',
            status: 'bestaetigt',
            erinnerung: 'gesendet', // keine Erinnerungs-/Feedback-Mails für interne Termine
            arzt,
            summary: { text: '', checks: [], updatedAt: null, updatedBy: '' },
            googleEventId: null,
            patientEmail: '',
            sprache: 'de',
            stornoToken: crypto.randomUUID(),
            feedbackToken: '',
          }
        : {
            patientId: gewaehlt.id,
            patientName: `${gewaehlt.vorname} ${gewaehlt.nachname}`,
            datum,
            start,
            ende: endeZeit(start, dauer),
            behandlung,
            status: 'bestaetigt',
            erinnerung: 'offen',
            arzt,
            summary: { text: '', checks: [], updatedAt: null, updatedBy: '' },
            googleEventId: null,
            patientEmail: gewaehlt.email || '',
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
            const eventId = await eventAnlegen(termin, gewaehlt.email || '')
            if (eventId) await s.update('appointments', id, { googleEventId: eventId })
          } catch (e) { /* Google nicht erreichbar – Termin bleibt trotzdem bestehen */ }
        }
      })
      onAngelegt?.()
      onClose()
    } catch (e) {
      setFehler(tr(T.fehlerAnlegen))
    } finally {
      setLaedt(false)
    }
  }

  return (
    <Modal titel={bearbeiten ? tr(T.bearbeitenTitel) : tr(T.titel)} onClose={onClose} breite="max-w-xl">
      <div className="space-y-4">
        {/* Termin-Art: Patient oder interner Blocker (online nicht buchbar) */}
        <div className={`flex gap-2 ${bearbeiten ? 'hidden' : ''}`}>
          {[['patient', T.typPatient], ['intern', T.typIntern]].map(([key, label]) => (
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
              {tr(label)}
            </button>
          ))}
        </div>

        {typ === 'intern' && (
          <>
            <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-2.5">{tr(T.internHinweis)}</p>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{tr(T.grund)}</span>
              <input
                autoFocus
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                placeholder={tr(T.grundPlatzhalter)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
              />
            </label>
          </>
        )}

        {/* Patient suchen */}
        <div className={typ === 'intern' ? 'hidden' : ''}>
          <span className="text-sm font-medium text-slate-700">{tr(T.patient)}</span>
          {gewaehlt ? (
            <div className="mt-1.5 flex items-center justify-between bg-praxis-50 border border-praxis-200 rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{gewaehlt.vorname} {gewaehlt.nachname}</p>
                <p className="text-xs text-slate-500">{gewaehlt.telefon} · {gewaehlt.versicherung}</p>
              </div>
              <button onClick={() => { setPatientId(null); setSuche('') }} className="text-xs text-praxis-700 font-medium hover:underline">
                {tr(T.aendern)}
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder={tr(T.suchen)}
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
                      <span className="font-medium">{p.vorname} {p.nachname}</span>
                      <span className="text-slate-400 text-xs ml-2">{p.telefon}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`grid grid-cols-2 gap-3 ${typ === 'intern' ? '!grid-cols-1' : ''}`}>
          <label className={`block ${typ === 'intern' ? 'hidden' : ''}`}>
            <span className="text-sm font-medium text-slate-700">{tr(T.behandlung)}</span>
            <input
              value={behandlung}
              onChange={(e) => setBehandlung(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{tr(T.behandler)}</span>
            <select
              value={arzt}
              onChange={(e) => setArzt(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
            >
              {AERZTE.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
        </div>

        <div className={`grid gap-3 ${typ === 'intern' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{tr(T.tag)}</span>
            <select
              value={datum}
              onChange={(e) => { setDatum(e.target.value); setStart('') }}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
            >
              {(typ === 'intern' ? internTage : tage).includes(datum) ? null : (
                <option value={datum}>{datumLok(datum, { weekday: 'long', day: 'numeric', month: 'short' })}</option>
              )}
              {(typ === 'intern' ? internTage : tage).map((t) => (
                <option key={t} value={t}>{datumLok(t, { weekday: 'long', day: 'numeric', month: 'short' })}</option>
              ))}
            </select>
          </label>
          {typ === 'intern' ? (
            <>
              {/* Von–Bis frei wählbar: auch lange Blöcke (ganzer Nachmittag) möglich */}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{tr(T.von)}</span>
                <select
                  value={von}
                  onChange={(e) => { setVon(e.target.value); if (bis <= e.target.value) setBis(endeZeit(e.target.value, 60)) }}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
                  dir="ltr"
                >
                  {INTERN_ZEITEN.slice(0, -1).map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{tr(T.bis)}</span>
                <select
                  value={bis}
                  onChange={(e) => setBis(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
                  dir="ltr"
                >
                  {INTERN_ZEITEN.filter((z) => z > von).map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
            </>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{tr(T.dauer)}</span>
              <select
                value={dauer}
                onChange={(e) => { setDauer(Number(e.target.value)); setStart('') }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
              >
                {DAUERN.map((d) => <option key={d} value={d}>{d} {tr(T.minuten)}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className={typ === 'intern' ? 'hidden' : ''}>
          <span className="text-sm font-medium text-slate-700">{tr(T.freie)}</span>
          {slots.length === 0 ? (
            <p className="mt-1.5 text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-3">
              {tr(T.nichtsFrei)}
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

        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>}
        <div className="flex gap-2">
          <button
            onClick={anlegen}
            disabled={laedt}
            className="flex-1 bg-praxis-600 hover:bg-praxis-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl"
          >
            {laedt ? tr(T.laedt) : bearbeiten ? `✓ ${tr(T.speichern)}` : typ === 'intern' ? `🔒 ${tr(T.blockieren)}` : tr(T.anlegen)}
          </button>
          {bearbeiten && (
            <button
              onClick={internLoeschen}
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold px-4 rounded-xl text-sm"
            >
              🗑 {tr(T.loeschen)}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
