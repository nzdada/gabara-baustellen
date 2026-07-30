import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, withStore, alter, fmtGeburtstag, patientTags } from '../hooks.js'
import Zahnschema from '../components/Zahnschema.jsx'
import { ZahnLogo, Icon } from '@shared/ui.jsx'
import { BEHANDLUNGS_CHECKS } from '@shared/praxis.js'
import { heuteISO, zuMinuten } from '@shared/slots.js'
import { useLang, tr, datumLok } from '@shared/i18n.js'
import TerminBilder from '../components/TerminBilder.jsx'
import SummaryEditor from '../components/SummaryEditor.jsx'
import LeistungenListe from '../components/LeistungenListe.jsx'
import { textZuHtml, hatFormatierung } from '@shared/format.js'

const T = {
  titel: { de: 'Arzt-Cockpit', en: 'Doctor cockpit', ar: 'شاشة الطبيب' },
  heute: { de: 'Heute', en: 'Today', ar: 'اليوم' },
  termine: { de: 'Termine', en: 'appointments', ar: 'مواعيد' },
  abgesagtZahl: { de: 'abgesagt', en: 'cancelled', ar: 'ملغاة' },
  abgesagt: { de: 'ABGESAGT', en: 'CANCELLED', ar: 'ملغى' },
  keineTermine: { de: 'Heute keine Termine.', en: 'No appointments today.', ar: 'لا مواعيد اليوم.' },
  auswaehlen: { de: 'Termin auswählen.', en: 'Select an appointment.', ar: 'اختر موعدًا.' },
  gebUnbekannt: { de: 'Geburtsdatum unbekannt', en: 'Date of birth unknown', ar: 'تاريخ الميلاد غير معروف' },
  jahre: { de: 'Jahre', en: 'years', ar: 'سنة' },
  abgesagtHinweis: { de: 'Dieser Termin wurde abgesagt – das Zeitfenster ist frei.', en: 'This appointment was cancelled – the slot is free.', ar: 'أُلغي هذا الموعد – الوقت أصبح متاحًا.' },
  zusammenfassung: { de: 'Behandlungs-Zusammenfassung', en: 'Treatment summary', ar: 'ملخص العلاج' },
  notizPlatzhalter: { de: 'Notizen zur Behandlung … (werden live mit dem Empfang geteilt)', en: 'Treatment notes … (shared live with the front desk)', ar: 'ملاحظات العلاج … (تُشارك مباشرة مع الاستقبال)' },
  zuletzt: { de: 'Zuletzt:', en: 'Last update:', ar: 'آخر تحديث:' },
  keineEintraege: { de: 'Noch keine Einträge', en: 'No entries yet', ar: 'لا مدخلات بعد' },
  abschliessen: { de: 'Behandlung abschließen ✓', en: 'Complete treatment ✓', ar: 'إنهاء العلاج ✓' },
  letzte: { de: 'Letzte Behandlungen', en: 'Previous treatments', ar: 'العلاجات السابقة' },
  keineFrueheren: { de: 'Keine früheren Behandlungen dokumentiert.', en: 'No previous treatments documented.', ar: 'لا توجد علاجات سابقة موثقة.' },
  uhrKurz: { de: 'Uhr', en: '', ar: '' },
}

// Arzt-Cockpit: Tablet-Ansicht für den Behandler.
// Zeigt die heutigen Termine + die Behandlungs-Zusammenfassung LIVE —
// tippt der Empfang am PC, erscheint es hier sofort ohne Neuladen.

export default function Cockpit({ user }) {
  useLang()
  const appointments = useCollection('appointments')
  const patients = useCollection('patients')
  const heute = heuteISO()
  const [gewaehltId, setGewaehltId] = useState(null)
  const [uhr, setUhr] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setUhr(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // Alle heutigen Termine – auch abgesagte, damit der Arzt Lücken sofort erkennt
  const heutige = useMemo(
    () =>
      appointments
        .filter((a) => a.datum === heute)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [appointments, heute]
  )
  const aktive = heutige.filter((a) => a.status !== 'abgesagt')

  // Automatisch den nächsten anstehenden Termin auswählen (nie einen abgesagten)
  useEffect(() => {
    if (gewaehltId || aktive.length === 0) return
    const jetzt = uhr.getHours() * 60 + uhr.getMinutes()
    const naechster =
      aktive.find((a) => a.status === 'bestaetigt' && zuMinuten(a.ende) > jetzt) || aktive[aktive.length - 1]
    setGewaehltId(naechster.id)
  }, [aktive, gewaehltId, uhr])

  const termin = heutige.find((a) => a.id === gewaehltId) || null
  const patient = termin ? patients.find((p) => p.id === termin.patientId) : null
  const historie = useMemo(
    () =>
      termin
        ? appointments
            .filter((a) => a.patientId === termin.patientId && a.id !== termin.id && a.status === 'abgeschlossen')
            .sort((a, b) => `${b.datum}${b.start}`.localeCompare(`${a.datum}${a.start}`))
            .slice(0, 3)
        : [],
    [appointments, termin]
  )

  async function speichereSummary(patch) {
    if (!termin) return
    const neu = { ...termin.summary, ...patch, updatedAt: Date.now(), updatedBy: user?.name || 'Arzt' }
    await withStore((s) => s.update('appointments', termin.id, { summary: neu }))
  }

  function toggleCheck(check) {
    const checks = termin.summary.checks.includes(check)
      ? termin.summary.checks.filter((c) => c !== check)
      : [...termin.summary.checks, check]
    speichereSummary({ checks })
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Kopf */}
      <header className="flex items-center gap-4 px-5 h-16 bg-slate-950/60 border-b border-white/10 shrink-0">
        <ZahnLogo className="w-8 h-8 text-praxis-500" />
        <div className="leading-tight">
          <p className="font-bold">{tr(T.titel)}</p>
          <p className="text-xs text-slate-400">{datumLok(heute, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
        </div>
        <span className="inline-flex items-center gap-2 bg-praxis-500/15 text-praxis-300 text-xs font-bold rounded-full px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-praxis-400 animate-pulse" /> LIVE
        </span>
        <p className="ml-auto rtl:ml-0 rtl:mr-auto text-2xl font-bold tabular-nums" dir="ltr">
          {uhr.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <Link to="/kalender" className="text-slate-400 hover:text-white" title="Zur Verwaltung">
          <Icon name="logout" className="w-5 h-5" />
        </Link>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Terminliste heute */}
        <aside className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 overflow-y-auto">
          <p className="px-5 pt-4 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
            {tr(T.heute)} · {aktive.length} {tr(T.termine)}
            {heutige.length > aktive.length && (
              <span className="mx-2 text-red-400 normal-case">({heutige.length - aktive.length} {tr(T.abgesagtZahl)})</span>
            )}
          </p>
          {heutige.length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-500">{tr(T.keineTermine)}</p>
          )}
          <div className="px-3 pb-4 space-y-1.5 flex lg:block gap-1.5 overflow-x-auto lg:overflow-x-visible">
            {heutige.map((a) => {
              const aktiv = a.id === gewaehltId
              const fertig = a.status === 'abgeschlossen'
              const abgesagt = a.status === 'abgesagt'
              return (
                <button
                  key={a.id}
                  onClick={() => setGewaehltId(a.id)}
                  className={`shrink-0 lg:w-full text-left rounded-2xl px-4 py-3 transition border ${
                    aktiv
                      ? 'bg-praxis-600 border-praxis-500'
                      : abgesagt
                        ? 'bg-red-500/10 border-red-500/25 opacity-75 hover:opacity-100'
                        : fertig
                          ? 'bg-white/5 border-transparent opacity-60 hover:opacity-90'
                          : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <p className="text-sm font-bold flex items-center gap-2">
                    <span className={abgesagt ? 'line-through text-red-300' : ''}>{a.start}</span>
                    {fertig && <Icon name="check" className="w-4 h-4 text-praxis-300" strokeWidth={3} />}
                    {abgesagt && (
                      <span className="text-[9px] font-bold bg-red-500/25 text-red-300 rounded-full px-1.5 py-0.5">{tr(T.abgesagt)}</span>
                    )}
                  </p>
                  <p className={`text-sm truncate ${abgesagt ? 'line-through text-red-200/80' : ''}`}>{a.patientName}</p>
                  <p className={`text-xs truncate ${aktiv ? 'text-praxis-100' : abgesagt ? 'text-red-300/60' : 'text-slate-400'}`}>{a.behandlung} · {a.arzt}</p>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Hauptbereich */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          {!termin ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <p>{tr(T.auswaehlen)}</p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-6">
              {/* Patient */}
              <div className="bg-white/5 rounded-3xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-3xl font-bold">{termin.patientName}</h1>
                    <p className="text-slate-400 mt-1">
                      {patient?.geburtsdatum
                        ? `${fmtGeburtstag(patient.geburtsdatum)} · ${alter(patient.geburtsdatum)} ${tr(T.jahre)}`
                        : tr(T.gebUnbekannt)}
                      {patient?.versicherung ? ` · ${patient.versicherung}` : ''}
                    </p>
                    {/* Risiko-Tags: sofort sichtbar, farbcodiert */}
                    {patientTags(patient).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {patientTags(patient).map((tag) => (
                          <span key={tag.key} className={`text-xs font-bold rounded-full px-3 py-1.5 border ${tag.dunkelFarbe}`}>
                            {tag.icon} {tr(tag.label)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right rtl:text-left">
                    <p className="text-2xl font-bold text-praxis-300" dir="ltr">{termin.start} – {termin.ende}</p>
                    <p className="text-slate-400 text-sm">{termin.behandlung}</p>
                  </div>
                </div>
                {termin.status === 'abgesagt' && (
                  <p className="mt-4 bg-red-500/15 text-red-300 font-semibold rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Icon name="alert" className="w-5 h-5 shrink-0" /> {tr(T.abgesagtHinweis)}
                  </p>
                )}
                {patient?.notizen && (
                  <p className="mt-4 bg-red-500/15 text-red-300 font-semibold rounded-2xl px-4 py-3 flex items-center gap-2 text-lg">
                    <Icon name="alert" className="w-6 h-6 shrink-0" /> {patient.notizen}
                  </p>
                )}
              </div>

              {/* Live-Zusammenfassung */}
              <div className="bg-white/5 rounded-3xl p-6">
                <p className="font-bold flex items-center gap-2 text-lg">
                  {tr(T.zusammenfassung)}
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-praxis-300 bg-praxis-500/15 rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-praxis-400 animate-pulse" /> LIVE
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {BEHANDLUNGS_CHECKS.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleCheck(c)}
                      className={`text-sm font-semibold rounded-full px-4 py-2.5 border transition ${
                        termin.summary?.checks?.includes(c)
                          ? 'bg-praxis-500 border-praxis-400 text-white'
                          : 'border-white/15 text-slate-300 hover:border-praxis-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <SummaryEditor
                    text={termin.summary?.text || ''}
                    onText={(text) => speichereSummary({ text })}
                    placeholder={tr(T.notizPlatzhalter)}
                    dunkel
                    rows={4}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {termin.summary?.updatedAt
                      ? `${tr(T.zuletzt)} ${termin.summary.updatedBy} · ${new Date(termin.summary.updatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} ${tr(T.uhrKurz)}`
                      : tr(T.keineEintraege)}
                  </span>
                  {termin.status !== 'abgeschlossen' && termin.status !== 'abgesagt' && (
                    <button
                      onClick={() =>
                        withStore((s) =>
                          s.update('appointments', termin.id, {
                            status: 'abgeschlossen',
                            abgeschlossenAm: new Date().toISOString(), // Basis für den Feedback-Versand
                            // Übergabe an die Verwaltung: Warenkorb prüfen -> Rechnung stellen
                            ...(!['gestellt', 'bezahlt'].includes(termin.rechnung) ? { rechnung: 'pruefen' } : {}),
                          })
                        )
                      }
                      className="bg-praxis-600 hover:bg-praxis-500 text-white font-bold px-5 py-2.5 rounded-full text-sm"
                    >
                      {tr(T.abschliessen)}
                    </button>
                  )}
                </div>
              </div>

              {/* Zahnschema: Zahn antippen -> Befund erfassen */}
              <div className="bg-white/5 rounded-3xl p-6">
                <Zahnschema
                  termin={termin}
                  patientTermine={appointments.filter((a) => a.patientId === termin.patientId)}
                  user={user}
                  dunkel
                />
              </div>

              {/* Leistungen & Abrechnung: antippen -> Rechnungsgrundlage */}
              <div className="bg-white/5 rounded-3xl p-6">
                <LeistungenListe termin={termin} dunkel />
              </div>

              {/* Bilder & Scans: Foto direkt am Tablet aufnehmen oder Scan hochladen */}
              <div className="bg-white/5 rounded-3xl p-6">
                <TerminBilder termin={termin} user={user} dunkel />
              </div>

              {/* Letzte Behandlungen */}
              <div className="bg-white/5 rounded-3xl p-6">
                <p className="font-bold text-lg mb-3">{tr(T.letzte)}</p>
                {historie.length === 0 ? (
                  <p className="text-slate-500 text-sm">{tr(T.keineFrueheren)}</p>
                ) : (
                  <div className="space-y-3">
                    {historie.map((h) => (
                      <div key={h.id} className="border-l-2 rtl:border-l-0 rtl:border-r-2 border-praxis-500/50 pl-4 rtl:pl-0 rtl:pr-4">
                        <p className="text-sm font-semibold text-praxis-300">
                          {datumLok(h.datum)} — {h.behandlung} <span className="text-slate-400 font-normal">· {h.arzt}</span>
                        </p>
                        {h.summary?.checks?.length > 0 && (
                          <p className="text-xs text-slate-400 mt-0.5">{h.summary.checks.join(' · ')}</p>
                        )}
                        {h.summary?.text && (
                          hatFormatierung(h.summary.text)
                            ? <div className="text-sm text-slate-300 mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-0.5" dangerouslySetInnerHTML={{ __html: textZuHtml(h.summary.text) }} />
                            : <p className="text-sm text-slate-300 mt-1">{h.summary.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
