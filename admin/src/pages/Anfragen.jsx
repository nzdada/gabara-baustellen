import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCollection, withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { endeZeit } from '@shared/slots.js'
import Modal from '../components/Modal.jsx'
import { kalenderVerbunden, eventAnlegen } from '@shared/googleCalendar.js'
import { mailKonfiguriert, sendePatientenMail } from '@shared/mail.js'
import { useLang, tr, datumLok } from '@shared/i18n.js'

const T = {
  titel: { de: 'Terminanfragen von der Webseite', en: 'Appointment requests from the website', ar: 'طلبات المواعيد من الموقع' },
  untertitel: { de: 'Neue Online-Anfragen prüfen und mit einem Klick in einen festen Termin verwandeln.', en: 'Review new online requests and turn them into fixed appointments with one click.', ar: 'راجع الطلبات الجديدة وحوّلها إلى مواعيد ثابتة بنقرة واحدة.' },
  leer: { de: 'Keine offenen Anfragen – alles erledigt!', en: 'No open requests – all done!', ar: 'لا توجد طلبات مفتوحة – كل شيء منجز!' },
  neu: { de: 'NEU', en: 'NEW', ar: 'جديد' },
  wunsch: { de: 'Wunsch:', en: 'Requested:', ar: 'المطلوب:' },
  min: { de: 'Min.', en: 'min', ar: 'دقيقة' },
  bestaetigen: { de: 'Bestätigen', en: 'Confirm', ar: 'تأكيد' },
  ablehnen: { de: 'Ablehnen', en: 'Decline', ar: 'رفض' },
  zuletzt: { de: 'Zuletzt bearbeitet', en: 'Recently processed', ar: 'عولجت مؤخرًا' },
  bestaetigt: { de: 'Bestätigt', en: 'Confirmed', ar: 'مؤكد' },
  abgelehnt: { de: 'Abgelehnt', en: 'Declined', ar: 'مرفوض' },
  uhr: { de: 'Uhr', en: '', ar: '' },
  modalTitel: { de: 'Anfrage bestätigen', en: 'Confirm request', ar: 'تأكيد الطلب' },
  zuordnen: { de: 'Patient zuordnen:', en: 'Assign patient:', ar: 'ربط المريض:' },
  vorhanden: { de: 'Vorhandener Patient:', en: 'Existing patient:', ar: 'مريض موجود:' },
  alsNeu: { de: 'Als Neupatient anlegen:', en: 'Create as new patient:', ar: 'إنشاء كمريض جديد:' },
  wirdNeu: { de: 'wird als Neupatient angelegt', en: 'will be created as a new patient', ar: 'سيُسجَّل كمريض جديد' },
  kasseUnbekannt: { de: 'Versicherung unbekannt', en: 'Insurance unknown', ar: 'التأمين غير معروف' },
  anlegen: { de: 'Termin bestätigen & anlegen', en: 'Confirm & create appointment', ar: 'تأكيد وإنشاء الموعد' },
  laedt: { de: 'Wird angelegt …', en: 'Creating …', ar: 'جارٍ الإنشاء …' },
  hinweisKalender: { de: 'Der Termin erscheint sofort im Kalender', en: 'The appointment appears in the calendar immediately', ar: 'يظهر الموعد فورًا في التقويم' },
  hinweisGoogle: { de: ' und im Google Kalender', en: ' and in Google Calendar', ar: ' وفي تقويم جوجل' },
  mailWird: { de: 'Der Patient erhält automatisch eine Bestätigungs-E-Mail an', en: 'The patient automatically receives a confirmation e-mail at', ar: 'سيتلقى المريض رسالة تأكيد تلقائيًا على' },
  mailNichtKonf: { de: 'E-Mail-Versand noch nicht eingerichtet – der Mail-Dienst (seed/erinnerung.gs) muss einmalig als Web-App bereitgestellt und die URL in der App hinterlegt werden. Bis dahin bitte telefonisch bestätigen.', en: 'E-mail sending not set up yet – deploy the mail service (seed/erinnerung.gs) as a web app once and store its URL in the app. Until then please confirm by phone.', ar: 'إرسال البريد غير مفعّل بعد – انشر خدمة البريد مرة واحدة وأدخل الرابط في التطبيق. حتى ذلك الحين يرجى التأكيد هاتفيًا.' },
  gesperrtWarnung: {
    de: '⛔ Dieser Patient ist für die Online-Buchung GESPERRT (zu viele kurzfristige Absagen). Termin nur nach Rücksprache mit der Praxisleitung vergeben – Sperre im Dashboard aufhebbar.',
    en: '⛔ This patient is BLOCKED for online booking (too many short-notice cancellations). Only book after consulting practice management – unblock via the dashboard.',
    ar: '⛔ هذا المريض محظور من الحجز الإلكتروني (إلغاءات متأخرة كثيرة). لا يُمنح موعد إلا بعد مراجعة الإدارة.',
  },
  // Bearbeitbare Patientendaten im Bestätigen-Dialog
  datenTitel: { de: 'Patientendaten prüfen & ergänzen', en: 'Check & complete patient data', ar: 'مراجعة بيانات المريض وإكمالها' },
  fVorname: { de: 'Vorname', en: 'First name', ar: 'الاسم الأول' },
  fNachname: { de: 'Nachname', en: 'Last name', ar: 'اسم العائلة' },
  fTelefon: { de: 'Telefon', en: 'Phone', ar: 'الهاتف' },
  fEmail: { de: 'E-Mail', en: 'E-mail', ar: 'البريد الإلكتروني' },
  fGeburt: { de: 'Geburtsdatum', en: 'Date of birth', ar: 'تاريخ الميلاد' },
  fKasse: { de: 'Versicherung', en: 'Insurance', ar: 'التأمين' },
  fNotiz: { de: 'Notiz', en: 'Note', ar: 'ملاحظة' },
  fNotizPlatzhalter: { de: 'z. B. Angstpatient, Empfehlung, Allergie …', en: 'e.g. anxious patient, referral, allergy …', ar: 'مثال: مريض قلق، توصية، حساسية …' },
  // Ablehnen mit Grund
  ablehnenTitel: { de: 'Anfrage ablehnen', en: 'Decline request', ar: 'رفض الطلب' },
  ablehnenFrage: {
    de: 'Warum lehnen wir ab? Der Grund wird dem Patienten in der Absage-Mail mitgeteilt.',
    en: 'Why are we declining? The reason is included in the e-mail to the patient.',
    ar: 'لماذا نرفض؟ سيُذكر السبب في رسالة الرفض للمريض.',
  },
  grundTelefon: { de: '📞 Telefonnummer stimmt nicht – Patient soll uns anrufen und den Termin bestätigen', en: '📞 Phone number incorrect – patient should call us to confirm', ar: '📞 رقم الهاتف غير صحيح – على المريض الاتصال بنا للتأكيد' },
  grundAusgebucht: { de: '📅 Termin ist bereits ausgebucht', en: '📅 Time is already fully booked', ar: '📅 الوقت محجوز بالكامل' },
  grundUrlaub: { de: '🏖 Praxis ist im Urlaub', en: '🏖 Practice is on holiday', ar: '🏖 العيادة في إجازة' },
  grundKeiner: { de: '✉ Ohne Grund (Standardtext)', en: '✉ No reason (standard text)', ar: '✉ بدون سبب (نص قياسي)' },
  ablehnenSenden: { de: 'Ablehnen & Patient informieren', en: 'Decline & notify patient', ar: 'رفض وإبلاغ المريض' },
  mGesendet: { de: '✉ Mail gesendet', en: '✉ e-mail sent', ar: '✉ أُرسل البريد' },
  mFehler: { de: '✉ Mail fehlgeschlagen', en: '✉ e-mail failed', ar: '✉ فشل الإرسال' },
  mKeineMail: { de: 'keine E-Mail', en: 'no e-mail', ar: 'لا بريد إلكتروني' },
  mNichtKonf: { de: '✉ Versand nicht eingerichtet', en: '✉ sending not set up', ar: '✉ الإرسال غير مفعّل' },
}

// Versucht die Patienten-Mail zu senden und liefert den Status für die Anzeige
export async function mailSenden(typ, anfrage, extra = {}) {
  if (!anfrage.email) return 'keine-email'
  if (!mailKonfiguriert()) return 'nicht-konfiguriert'
  const ok = await sendePatientenMail(typ, {
    email: anfrage.email,
    name: anfrage.name,
    datum: new Date(anfrage.datum + 'T12:00:00').toLocaleDateString('de-DE'),
    start: anfrage.start,
    behandlung: anfrage.anliegen,
    sprache: anfrage.sprache || 'de',
    ...extra, // terminId + stornoToken -> Absage-Link in der Mail
  })
  return ok ? 'gesendet' : 'fehler'
}

function normalisiereTelefon(t) {
  return (t || '').replace(/\D/g, '')
}

export default function Anfragen({ user }) {
  useLang()
  const requests = useCollection('requests')
  const patients = useCollection('patients')
  const [bestaetige, setBestaetige] = useState(null)

  // Deep-Link aus der Toast-Benachrichtigung: #/anfragen?id=<id>
  // -> Anfrage hervorheben und den Bestätigen-Dialog direkt öffnen
  const location = useLocation()
  const deepLinkId = new URLSearchParams(location.search).get('id')
  const deepLinkVerarbeitet = useRef('')
  useEffect(() => {
    if (!deepLinkId || deepLinkVerarbeitet.current === deepLinkId) return
    const ziel = requests.find((r) => r.id === deepLinkId && r.status === 'neu')
    if (ziel) {
      deepLinkVerarbeitet.current = deepLinkId
      setBestaetige(ziel)
    }
  }, [deepLinkId, requests])

  const neue = requests.filter((r) => r.status === 'neu').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  const erledigte = requests.filter((r) => r.status !== 'neu').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10)
  const [ablehne, setAblehne] = useState(null)

  return (
    <div className="p-4 lg:p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-slate-900 mb-1">{tr(T.titel)}</h1>
      <p className="text-sm text-slate-500 mb-5">{tr(T.untertitel)}</p>

      {neue.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
          <Icon name="inbox" className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{tr(T.leer)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {neue.map((r) => (
            <div
              key={r.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 ${
                r.id === deepLinkId ? 'border-praxis-500 ring-2 ring-praxis-300' : 'border-amber-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900 flex items-center gap-2">
                    {r.name}
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{tr(T.neu)}</span>
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {r.anliegen} · {tr(T.wunsch)} <span className="font-semibold text-slate-700">{datumLok(r.datum)}, {r.start} {tr(T.uhr)}</span> ({r.dauer} {tr(T.min)})
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    <Icon name="phone" className="w-3.5 h-3.5 inline mr-1" />{r.telefon}
                    {r.email && <span className="ml-3"><Icon name="mail" className="w-3.5 h-3.5 inline mr-1" />{r.email}</span>}
                  </p>
                  {r.nachricht && <p className="text-sm text-slate-600 mt-1.5 bg-slate-50 rounded-lg px-3 py-2">„{r.nachricht}"</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBestaetige(r)}
                    className="bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2.5 rounded-full"
                  >
                    {tr(T.bestaetigen)}
                  </button>
                  <button
                    onClick={() => setAblehne(r)}
                    className="bg-white border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600 text-sm font-semibold px-4 py-2.5 rounded-full"
                  >
                    {tr(T.ablehnen)}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {erledigte.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-slate-500 mt-8 mb-3">{tr(T.zuletzt)}</h2>
          <div className="space-y-2">
            {erledigte.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600">{r.name} · {r.anliegen} · {datumLok(r.datum)}, {r.start} {tr(T.uhr)}</span>
                <span className="flex items-center gap-1.5">
                  {r.mailStatus === 'gesendet' && (
                    <span className="text-[10px] font-bold rounded-full px-2 py-1 bg-sky-100 text-sky-700">{tr(T.mGesendet)}</span>
                  )}
                  {r.mailStatus === 'fehler' && (
                    <span className="text-[10px] font-bold rounded-full px-2 py-1 bg-red-100 text-red-700">{tr(T.mFehler)}</span>
                  )}
                  {r.mailStatus === 'nicht-konfiguriert' && (
                    <span className="text-[10px] font-bold rounded-full px-2 py-1 bg-amber-100 text-amber-700" title={tr(T.mailNichtKonf)}>{tr(T.mNichtKonf)}</span>
                  )}
                  <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${
                    r.status === 'bestaetigt' ? 'bg-praxis-100 text-praxis-800' : 'bg-red-50 text-red-600'
                  }`}>
                    {r.status === 'bestaetigt' ? tr(T.bestaetigt) : tr(T.abgelehnt)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {bestaetige && (
        <BestaetigenModal
          anfrage={bestaetige}
          patients={patients}
          onClose={() => setBestaetige(null)}
        />
      )}
      {ablehne && <AblehnenModal anfrage={ablehne} onClose={() => setAblehne(null)} />}
    </div>
  )
}

// Ablehnen mit wählbarem Grund – der Grund landet in der Absage-Mail des Patienten
export function AblehnenModal({ anfrage, onClose }) {
  const [grund, setGrund] = useState('ausgebucht')
  const [laedt, setLaedt] = useState(false)
  const GRUENDE = [
    ['telefon', T.grundTelefon],
    ['ausgebucht', T.grundAusgebucht],
    ['urlaub', T.grundUrlaub],
    ['', T.grundKeiner],
  ]

  async function absenden() {
    setLaedt(true)
    await withStore((s) => s.update('requests', anfrage.id, { status: 'abgelehnt', ablehnGrund: grund || '' }))
    // Mail im Hintergrund (Apps-Script-Kaltstart) – Status wird nachgetragen
    mailSenden('absage', anfrage, grund ? { grund } : {})
      .then((mailStatus) => withStore((s) => s.update('requests', anfrage.id, { mailStatus })))
      .catch(() => {})
    onClose()
  }

  return (
    <Modal titel={tr(T.ablehnenTitel)} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-2xl p-4 text-sm">
          <p className="font-bold text-slate-900">{anfrage.name}</p>
          <p className="text-slate-600 mt-0.5">{anfrage.anliegen} · {datumLok(anfrage.datum)}, {anfrage.start} {tr(T.uhr)}</p>
        </div>
        <p className="text-sm text-slate-600">{tr(T.ablehnenFrage)}</p>
        <div className="space-y-2">
          {GRUENDE.map(([key, label]) => (
            <label
              key={key}
              className="flex items-start gap-3 bg-white border-2 rounded-xl p-3.5 cursor-pointer transition has-checked:border-red-400 border-slate-200"
            >
              <input
                type="radio"
                name="ablehn-grund"
                checked={grund === key}
                onChange={() => setGrund(key)}
                className="mt-0.5 accent-red-600"
              />
              <span className="text-sm text-slate-700">{tr(label)}</span>
            </label>
          ))}
        </div>
        <button
          onClick={absenden}
          disabled={laedt}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl"
        >
          {laedt ? tr(T.laedt) : tr(T.ablehnenSenden)}
        </button>
      </div>
    </Modal>
  )
}

// Anfrage-Daten in bearbeitbare Patientenfelder aufteilen (Name -> Vor-/Nachname)
function datenAusAnfrage(anfrage) {
  const teile = anfrage.name.trim().split(/\s+/)
  return {
    vorname: teile.slice(0, -1).join(' ') || teile[0],
    nachname: teile.length > 1 ? teile[teile.length - 1] : '',
    telefon: anfrage.telefon || '',
    email: anfrage.email || '',
    geburtsdatum: '',
    versicherung: '',
    notizen: '',
  }
}

function datenAusPatient(p) {
  return {
    vorname: p.vorname || '', nachname: p.nachname || '', telefon: p.telefon || '',
    email: p.email || '', geburtsdatum: p.geburtsdatum || '', versicherung: p.versicherung || '',
    notizen: p.notizen || '',
  }
}

export function BestaetigenModal({ anfrage, patients, onClose }) {
  // Vorschlag: existiert die Telefonnummer schon, ist es wohl derselbe Patient
  const vorschlag = useMemo(() => {
    const tel = normalisiereTelefon(anfrage.telefon)
    return patients.find(
      (p) => (tel && normalisiereTelefon(p.telefon) === tel) ||
        `${p.vorname} ${p.nachname}`.toLowerCase() === anfrage.name.toLowerCase()
    )
  }, [anfrage, patients])

  const [modus, setModus] = useState(vorschlag ? 'vorhanden' : 'neu')
  const [laedt, setLaedt] = useState(false)
  // Bearbeitbare Patientendaten – neue Infos aus dem Telefonat direkt mitnehmen
  const [daten, setDaten] = useState(() => (vorschlag ? datenAusPatient(vorschlag) : datenAusAnfrage(anfrage)))

  function moduswechsel(neuerModus) {
    setModus(neuerModus)
    setDaten(neuerModus === 'vorhanden' ? datenAusPatient(vorschlag) : datenAusAnfrage(anfrage))
  }

  async function bestaetigen() {
    setLaedt(true)
    try {
      await withStore(async (s) => {
        let patient
        if (modus === 'vorhanden') {
          // Bearbeitete Felder am bestehenden Patienten speichern
          await s.update('patients', vorschlag.id, { ...daten })
          patient = { ...vorschlag, ...daten }
        } else {
          const neu = {
            ...daten,
            notizen: daten.notizen.trim() || 'Neupatient über Online-Buchung',
            createdAt: Date.now(),
          }
          const id = await s.add('patients', neu)
          patient = { ...neu, id }
        }
        const termin = {
          patientId: patient.id,
          patientName: `${patient.vorname} ${patient.nachname}`.trim(),
          datum: anfrage.datum,
          start: anfrage.start,
          ende: endeZeit(anfrage.start, anfrage.dauer || 30),
          behandlung: anfrage.anliegen,
          status: 'bestaetigt',
          erinnerung: 'offen',
          arzt: 'J. Strötz',
          summary: { text: '', checks: [], updatedAt: null, updatedBy: '' },
          googleEventId: null,
          // für Mail-Dienst: Erinnerung + Absage-Link + Sprache des Patienten
          patientEmail: patient.email || anfrage.email || '',
          sprache: anfrage.sprache || 'de',
          stornoToken: crypto.randomUUID(),
          feedbackToken: crypto.randomUUID(),
        }
        const terminId = await s.add('appointments', termin)
        termin.id = terminId
        if (s.mode === 'firebase') await s.schreibeSlot(termin)
        if (kalenderVerbunden()) {
          try {
            const eventId = await eventAnlegen(termin, patient.email || '')
            if (eventId) await s.update('appointments', terminId, { googleEventId: eventId })
          } catch (e) { /* Kalender optional */ }
        }
        await s.update('requests', anfrage.id, { status: 'bestaetigt', terminId })
        // Mail im HINTERGRUND senden (Apps Script braucht beim Kaltstart einige Sekunden) –
        // der Dialog schließt sofort, der Mail-Status wird nachgetragen.
        // Mit den ggf. korrigierten Daten (Name/E-Mail) aus dem Dialog.
        mailSenden(
          'bestaetigung',
          { ...anfrage, name: `${patient.vorname} ${patient.nachname}`.trim(), email: patient.email || anfrage.email },
          { terminId, stornoToken: termin.stornoToken }
        )
          .then((mailStatus) => withStore((s2) => s2.update('requests', anfrage.id, { mailStatus })))
          .catch(() => {})
      })
      onClose()
    } finally {
      setLaedt(false)
    }
  }

  return (
    <Modal titel={tr(T.modalTitel)} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-praxis-50 rounded-2xl p-4 text-sm">
          <p className="font-bold text-slate-900">{anfrage.anliegen}</p>
          <p className="text-slate-600 mt-0.5">{datumLok(anfrage.datum)}, {anfrage.start} {tr(T.uhr)} · {anfrage.dauer} {tr(T.min)}</p>
        </div>

        {vorschlag ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">{tr(T.zuordnen)}</p>
            <label className="flex items-start gap-3 bg-white border-2 rounded-xl p-3.5 cursor-pointer transition has-checked:border-praxis-500 border-slate-200">
              <input type="radio" name="patient-zuordnung" checked={modus === 'vorhanden'} onChange={() => moduswechsel('vorhanden')} className="mt-1 accent-teal-600" />
              <span className="text-sm">
                <span className="font-semibold">{tr(T.vorhanden)}</span> {vorschlag.vorname} {vorschlag.nachname}
                <span className="block text-xs text-slate-400">{vorschlag.telefon} · {vorschlag.versicherung || tr(T.kasseUnbekannt)}</span>
              </span>
            </label>
            <label className="flex items-start gap-3 bg-white border-2 rounded-xl p-3.5 cursor-pointer transition has-checked:border-praxis-500 border-slate-200">
              <input type="radio" name="patient-zuordnung" checked={modus === 'neu'} onChange={() => moduswechsel('neu')} className="mt-1 accent-teal-600" />
              <span className="text-sm">
                <span className="font-semibold">{tr(T.alsNeu)}</span> {anfrage.name}
                <span className="block text-xs text-slate-400">{anfrage.telefon}{anfrage.email ? ` · ${anfrage.email}` : ''}</span>
              </span>
            </label>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{anfrage.name}</span> {tr(T.wirdNeu)}.
          </p>
        )}

        {/* Patientendaten direkt bearbeiten – neue Infos (Geburtsdatum, Kasse, korrigierte
            Nummer …) landen beim Bestätigen sofort in der Patientenakte */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">{tr(T.datenTitel)}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ['vorname', T.fVorname, 'text'],
              ['nachname', T.fNachname, 'text'],
              ['telefon', T.fTelefon, 'tel'],
              ['email', T.fEmail, 'email'],
              ['geburtsdatum', T.fGeburt, 'date'],
              ['versicherung', T.fKasse, 'text'],
            ].map(([key, label, typ]) => (
              <label key={key} className="block text-xs font-medium text-slate-500">
                {tr(label)}
                <input
                  type={typ}
                  value={daten[key]}
                  onChange={(e) => setDaten({ ...daten, [key]: e.target.value })}
                  dir={typ === 'tel' || typ === 'email' ? 'ltr' : undefined}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-praxis-500"
                />
              </label>
            ))}
          </div>
          <label className="mt-2.5 block text-xs font-medium text-slate-500">
            {tr(T.fNotiz)}
            <input
              value={daten.notizen}
              onChange={(e) => setDaten({ ...daten, notizen: e.target.value })}
              placeholder={tr(T.fNotizPlatzhalter)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-praxis-500"
            />
          </label>
        </div>

        {vorschlag?.gesperrt && (
          <p className="text-sm font-semibold text-red-700 bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3">
            {tr(T.gesperrtWarnung)}
          </p>
        )}
        <button
          onClick={bestaetigen}
          disabled={laedt || vorschlag?.gesperrt}
          className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl"
        >
          {laedt ? tr(T.laedt) : tr(T.anlegen)}
        </button>
        <p className="text-xs text-slate-400 text-center">
          {tr(T.hinweisKalender)}{kalenderVerbunden() ? tr(T.hinweisGoogle) : ''}.
        </p>
        {anfrage.email && mailKonfiguriert() && (
          <p className="text-xs text-sky-700 bg-sky-50 rounded-xl px-4 py-2.5 text-center">
            ✉ {tr(T.mailWird)} <strong dir="ltr">{anfrage.email}</strong>
          </p>
        )}
        {anfrage.email && !mailKonfiguriert() && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-4 py-2.5">
            ⚠ {tr(T.mailNichtKonf)}
          </p>
        )}
      </div>
    </Modal>
  )
}
