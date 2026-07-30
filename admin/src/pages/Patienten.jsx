import { useMemo, useState } from 'react'
import { useCollection, withStore, alter, fmtGeburtstag } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { useLang, tr, datumLok } from '@shared/i18n.js'
import Modal from '../components/Modal.jsx'
import NeuerTermin from '../components/NeuerTermin.jsx'
import { summe, euro } from '@shared/format.js'
import { druckeBericht, druckeHKP } from '../drucken.js'

const LEER = { vorname: '', nachname: '', geburtsdatum: '', telefon: '', email: '', versicherung: '', zusatzversicherung: '', zusatzversicherungNr: '', notizen: '', tags: [] }

const TAG_OPTIONEN = [
  { key: 'angst', icon: '⚠️', label: { de: 'Angstpatient', en: 'Anxious patient', ar: 'مريض قلق' } },
  { key: 'schmerz', icon: '⏱️', label: { de: 'Chronische Schmerzen', en: 'Chronic pain', ar: 'آلام مزمنة' } },
]

const T = {
  titel: { de: 'Patienten', en: 'Patients', ar: 'المرضى' },
  neu: { de: 'Neu', en: 'New', ar: 'جديد' },
  suche: { de: 'Suchen: Name, Telefon, Kasse …', en: 'Search: name, phone, insurance …', ar: 'بحث: الاسم، الهاتف، التأمين …' },
  keineTreffer: { de: 'Keine Treffer.', en: 'No results.', ar: 'لا توجد نتائج.' },
  auswaehlen: { de: 'Patient auswählen oder neu anlegen.', en: 'Select a patient or create a new one.', ar: 'اختر مريضًا أو أنشئ مريضًا جديدًا.' },
  jahre: { de: 'Jahre', en: 'years', ar: 'سنة' },
  kasseUnbekannt: { de: 'Versicherung unbekannt', en: 'Insurance unknown', ar: 'التأمين غير معروف' },
  termin: { de: 'Termin', en: 'Appointment', ar: 'موعد' },
  bearbeiten: { de: 'Bearbeiten', en: 'Edit', ar: 'تعديل' },
  historie: { de: 'Behandlungshistorie', en: 'Treatment history', ar: 'سجل العلاجات' },
  keineTermine: { de: 'Noch keine Termine.', en: 'No appointments yet.', ar: 'لا توجد مواعيد بعد.' },
  uhr: { de: 'Uhr', en: '', ar: '' },
  stAbgeschlossen: { de: 'Abgeschlossen', en: 'Completed', ar: 'منجز' },
  stAbgesagt: { de: 'Abgesagt', en: 'Cancelled', ar: 'ملغى' },
  stBestaetigt: { de: 'Bestätigt', en: 'Confirmed', ar: 'مؤكد' },
  formNeu: { de: 'Neuer Patient', en: 'New patient', ar: 'مريض جديد' },
  formBearbeiten: { de: 'Patient bearbeiten', en: 'Edit patient', ar: 'تعديل بيانات المريض' },
  vorname: { de: 'Vorname *', en: 'First name *', ar: 'الاسم الأول *' },
  nachname: { de: 'Nachname *', en: 'Last name *', ar: 'اسم العائلة *' },
  geburtsdatum: { de: 'Geburtsdatum', en: 'Date of birth', ar: 'تاريخ الميلاد' },
  telefon: { de: 'Telefon', en: 'Phone', ar: 'الهاتف' },
  email: { de: 'E-Mail', en: 'E-mail', ar: 'البريد الإلكتروني' },
  kasse: { de: 'Krankenkasse', en: 'Health insurance', ar: 'التأمين الصحي' },
  zusatz: { de: 'Zahnzusatzversicherung', en: 'Suppl. dental insurance', ar: 'تأمين أسنان تكميلي' },
  zusatzGes: { de: 'Zahnzusatz – Gesellschaft', en: 'Suppl. insurance – company', ar: 'التأمين التكميلي – الشركة' },
  zusatzNr: { de: 'Zahnzusatz – Versicherungsnr.', en: 'Suppl. insurance – policy no.', ar: 'التأمين التكميلي – رقم الوثيقة' },
  nr: { de: 'Nr.', en: 'no.', ar: 'رقم' },
  hinweise: { de: 'Wichtige Hinweise (Allergien, Ängste …)', en: 'Important notes (allergies, anxieties …)', ar: 'ملاحظات مهمة (حساسية، مخاوف …)' },
  pflicht: { de: 'Vor- und Nachname sind Pflicht.', en: 'First and last name are required.', ar: 'الاسم الأول واسم العائلة إلزاميان.' },
  speichern: { de: 'Speichern', en: 'Save', ar: 'حفظ' },
  bericht: { de: 'Bericht (PDF)', en: 'Report (PDF)', ar: 'تقرير (PDF)' },
  plaene: { de: 'Behandlungspläne (Heil- und Kostenplan)', en: 'Treatment plans (cost estimate / HKP)', ar: 'خطط العلاج (HKP)' },
  planNeu: { de: 'Neuer Plan', en: 'New plan', ar: 'خطة جديدة' },
  keinePlaene: { de: 'Kein Behandlungsplan vorhanden. Für Zahnersatz/Implantate vor Behandlungsbeginn erstellen und bei der (Zusatz-)Versicherung einreichen.', en: 'No treatment plan yet. For dentures/implants create one before treatment and submit it to the insurer.', ar: 'لا توجد خطة علاج بعد. للتركيبات/الزراعة أنشئ خطة قبل بدء العلاج وقدّمها للتأمين.' },
  planStatus: {
    entwurf: { de: 'Erstellt', en: 'Created', ar: 'أُنشئت' },
    eingereicht: { de: 'Eingereicht', en: 'Submitted', ar: 'مقدَّمة' },
    genehmigt: { de: 'Genehmigt', en: 'Approved', ar: 'موافَق عليها' },
    abgelehnt: { de: 'Abgelehnt', en: 'Rejected', ar: 'مرفوضة' },
  },
  gueltigBis: { de: 'gültig bis', en: 'valid until', ar: 'صالحة حتى' },
  abgelaufen: { de: 'abgelaufen!', en: 'expired!', ar: 'منتهية!' },
  planDrucken: { de: 'HKP (PDF)', en: 'Plan (PDF)', ar: 'الخطة (PDF)' },
  planTitel: { de: 'Titel (z. B. Implantat Regio 46)', en: 'Title (e.g. implant region 46)', ar: 'العنوان (مثل زرعة في منطقة 46)' },
  befund: { de: 'Befund', en: 'Findings', ar: 'التشخيص' },
  therapie: { de: 'Geplante Therapie', en: 'Planned therapy', ar: 'العلاج المخطط' },
  positionen: { de: 'Geplante Leistungen', en: 'Planned services', ar: 'الخدمات المخططة' },
  posWaehlen: { de: '+ Leistung aus Katalog …', en: '+ service from catalogue …', ar: '+ خدمة من الكتالوج …' },
  gesamt: { de: 'Voraussichtliche Kosten', en: 'Estimated costs', ar: 'التكلفة المتوقعة' },
  loeschenFrage: { de: 'Plan wirklich löschen?', en: 'Really delete this plan?', ar: 'هل تريد حذف الخطة فعلًا؟' },
}

export default function Patienten() {
  useLang()
  const patients = useCollection('patients')
  const appointments = useCollection('appointments')
  const photos = useCollection('photos')
  const plaene = useCollection('plaene')
  const [planBearbeiten, setPlanBearbeiten] = useState(null) // null | 'neu' | plan
  const [suche, setSuche] = useState('')
  const [gewaehlt, setGewaehlt] = useState(null)
  const [bearbeite, setBearbeite] = useState(null) // null | 'neu' | patient
  const [terminFuer, setTerminFuer] = useState(null)

  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return patients
      .filter((p) =>
        !q ||
        `${p.vorname} ${p.nachname}`.toLowerCase().includes(q) ||
        (p.telefon || '').includes(q) ||
        (p.versicherung || '').toLowerCase().includes(q)
      )
      .sort((a, b) => `${a.nachname} ${a.vorname}`.localeCompare(`${b.nachname} ${b.vorname}`))
  }, [patients, suche])

  const patient = patients.find((p) => p.id === gewaehlt)
  const historie = useMemo(
    () =>
      appointments
        .filter((a) => a.patientId === gewaehlt)
        .sort((a, b) => `${b.datum}${b.start}`.localeCompare(`${a.datum}${a.start}`)),
    [appointments, gewaehlt]
  )

  return (
    <div className="p-4 lg:p-6 flex flex-col lg:flex-row gap-5">
      {/* Liste */}
      <div className="lg:w-96 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-xl font-bold text-slate-900">{tr(T.titel)}</h1>
          <span className="text-xs text-slate-400 bg-white border border-slate-200 rounded-full px-2.5 py-1">{patients.length}</span>
          <button
            onClick={() => setBearbeite('neu')}
            className="ml-auto rtl:ml-0 rtl:mr-auto inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-3.5 py-2 rounded-full"
          >
            <Icon name="plus" className="w-4 h-4" /> {tr(T.neu)}
          </button>
        </div>
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={tr(T.suche)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-praxis-500"
        />
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto">
          {liste.map((p) => (
            <button
              key={p.id}
              onClick={() => setGewaehlt(p.id)}
              className={`w-full text-left rtl:text-right px-4 py-3 transition ${
                gewaehlt === p.id ? 'bg-praxis-600' : 'hover:bg-praxis-50/60'
              }`}
            >
              <p className={`font-semibold text-sm ${gewaehlt === p.id ? 'text-white' : 'text-slate-900'}`}>{p.nachname}, {p.vorname}</p>
              <p className={`text-xs ${gewaehlt === p.id ? 'text-praxis-100' : 'text-slate-400'}`}>{fmtGeburtstag(p.geburtsdatum)} · {p.versicherung || '–'}</p>
            </button>
          ))}
          {liste.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">{tr(T.keineTreffer)}</p>}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        {!patient ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 h-full flex flex-col items-center justify-center">
            <Icon name="users" className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">{tr(T.auswaehlen)}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{patient.vorname} {patient.nachname}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {fmtGeburtstag(patient.geburtsdatum)}{patient.geburtsdatum ? ` (${alter(patient.geburtsdatum)} ${tr(T.jahre)})` : ''} · {patient.versicherung || tr(T.kasseUnbekannt)}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  <Icon name="phone" className="w-3.5 h-3.5 inline mx-1" /><span dir="ltr">{patient.telefon || '–'}</span>
                  {patient.email && <span className="mx-3"><Icon name="mail" className="w-3.5 h-3.5 inline mx-1" /><span dir="ltr">{patient.email}</span></span>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTerminFuer(patient)}
                  className="bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2 rounded-full inline-flex items-center gap-1.5"
                >
                  <Icon name="calendar" className="w-4 h-4" /> {tr(T.termin)}
                </button>
                <button
                  onClick={() => druckeBericht(patient, historie.filter((t) => t.status === 'abgeschlossen'), photos)}
                  className="bg-white border border-slate-200 hover:border-praxis-400 text-slate-600 text-sm font-semibold px-4 py-2 rounded-full"
                >
                  {tr(T.bericht)}
                </button>
                <button
                  onClick={() => setBearbeite(patient)}
                  className="bg-white border border-slate-200 hover:border-praxis-400 text-slate-600 text-sm font-semibold px-4 py-2 rounded-full"
                >
                  {tr(T.bearbeiten)}
                </button>
              </div>
            </div>

            {patient.zusatzversicherung && (
              <p className="mt-3 text-xs font-medium text-sky-700 bg-sky-50 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                <Icon name="shield" className="w-3.5 h-3.5" /> {tr(T.zusatz)}: <strong>{patient.zusatzversicherung}</strong>
                {patient.zusatzversicherungNr && <span>· {tr(T.nr)} <strong dir="ltr">{patient.zusatzversicherungNr}</strong></span>}
              </p>
            )}

            {patient.notizen && (
              <p className="mt-4 text-sm font-semibold text-red-700 bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
                <Icon name="alert" className="w-4 h-4 shrink-0" /> {patient.notizen}
              </p>
            )}

            {/* Behandlungspläne / HKP */}
            <div className="mt-6 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">{tr(T.plaene)}</h3>
              <button
                onClick={() => setPlanBearbeiten('neu')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-praxis-700 bg-praxis-50 hover:bg-praxis-100 rounded-full px-3 py-1.5"
              >
                <Icon name="plus" className="w-3.5 h-3.5" /> {tr(T.planNeu)}
              </button>
            </div>
            {plaene.filter((pl) => pl.patientId === patient.id).length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">{tr(T.keinePlaene)}</p>
            ) : (
              <div className="mt-2 space-y-2">
                {plaene.filter((pl) => pl.patientId === patient.id).map((pl) => (
                  <div key={pl.id} className="border border-slate-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-800 mr-auto rtl:mr-0 rtl:ml-auto">{pl.titel}</span>
                    <span className="font-bold" dir="ltr">{euro(summe(pl.positionen))}</span>
                    <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 ${
                      pl.status === 'genehmigt' ? 'bg-praxis-100 text-praxis-800'
                      : pl.status === 'eingereicht' ? 'bg-sky-100 text-sky-700'
                      : pl.status === 'abgelehnt' ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tr(T.planStatus[pl.status || 'entwurf'])}
                      {pl.status === 'genehmigt' && pl.gueltigBis && (
                        <span className={new Date(pl.gueltigBis) < new Date() ? ' text-red-600' : ''}>
                          {' '}· {new Date(pl.gueltigBis) < new Date() ? tr(T.abgelaufen) : `${tr(T.gueltigBis)} ${datumLok(pl.gueltigBis)}`}
                        </span>
                      )}
                    </span>
                    <button onClick={() => druckeHKP(patient, pl)} className="text-xs font-semibold text-praxis-700 hover:underline">{tr(T.planDrucken)}</button>
                    <button onClick={() => setPlanBearbeiten(pl)} className="text-slate-400 hover:text-praxis-700 text-xs font-semibold">✎</button>
                  </div>
                ))}
              </div>
            )}

            <h3 className="mt-6 mb-3 font-bold text-slate-800 text-sm">{tr(T.historie)} ({historie.length})</h3>
            {historie.length === 0 ? (
              <p className="text-sm text-slate-400">{tr(T.keineTermine)}</p>
            ) : (
              <div className="space-y-2.5">
                {historie.map((t) => (
                  <div key={t.id} className="border border-slate-100 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {datumLok(t.datum)} · {t.start} {tr(T.uhr)} — {t.behandlung}
                      </p>
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        t.status === 'abgeschlossen' ? 'bg-slate-200 text-slate-600'
                        : t.status === 'abgesagt' ? 'bg-red-50 text-red-600'
                        : 'bg-praxis-100 text-praxis-800'
                      }`}>
                        {t.status === 'abgeschlossen' ? tr(T.stAbgeschlossen) : t.status === 'abgesagt' ? tr(T.stAbgesagt) : tr(T.stBestaetigt)}
                      </span>
                    </div>
                    {(t.summary?.text || t.summary?.checks?.length > 0) && (
                      <div className="mt-1.5 text-sm text-slate-600">
                        {t.summary.checks?.length > 0 && (
                          <p className="text-xs text-praxis-700 font-medium">{t.summary.checks.join(' · ')}</p>
                        )}
                        {t.summary.text && <p className="mt-0.5">{t.summary.text}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {bearbeite && (
        <PatientForm
          patient={bearbeite === 'neu' ? null : bearbeite}
          onClose={() => setBearbeite(null)}
          onGespeichert={(id) => setGewaehlt(id)}
        />
      )}
      {terminFuer && (
        <NeuerTermin
          patients={patients}
          appointments={appointments}
          vorbelegt={{ patientId: terminFuer.id }}
          onClose={() => setTerminFuer(null)}
        />
      )}
      {planBearbeiten && patient && (
        <PlanForm
          patient={patient}
          plan={planBearbeiten === 'neu' ? null : planBearbeiten}
          onClose={() => setPlanBearbeiten(null)}
        />
      )}
    </div>
  )
}

// Behandlungsplan / Heil- und Kostenplan anlegen & bearbeiten
function PlanForm({ patient, plan, onClose }) {
  const katalog = useCollection('katalog')
  const [form, setForm] = useState(
    plan || { titel: '', befund: '', therapie: '', positionen: [], status: 'entwurf', gueltigBis: '' }
  )

  function posHinzu(katalogId) {
    const k = katalog.find((k) => k.id === katalogId)
    if (!k) return
    setForm({ ...form, positionen: [...form.positionen, { katalogId: k.id, code: k.code, name: k.name, preis: k.preis, anzahl: 1 }] })
  }

  function posAnzahl(i, delta) {
    const neu = form.positionen.map((p, idx) => (idx === i ? { ...p, anzahl: Math.max(1, (p.anzahl || 1) + delta) } : p))
    setForm({ ...form, positionen: neu })
  }

  async function speichern(e) {
    e.preventDefault()
    if (!form.titel.trim()) return
    const daten = {
      ...form,
      patientId: patient.id,
      patientName: `${patient.vorname} ${patient.nachname}`,
      createdAt: form.createdAt || Date.now(),
    }
    await withStore(async (s) => {
      if (plan) await s.update('plaene', plan.id, daten)
      else await s.add('plaene', daten)
    })
    onClose()
  }

  async function loeschen() {
    if (!plan || !confirm(tr(T.loeschenFrage))) return
    await withStore((s) => s.remove('plaene', plan.id))
    onClose()
  }

  return (
    <Modal titel={`${tr(T.planNeu)} — ${patient.vorname} ${patient.nachname}`} onClose={onClose} breite="max-w-xl">
      <form onSubmit={speichern} className="space-y-3.5">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{tr(T.planTitel)} *</span>
          <input value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{tr(T.befund)}</span>
          <textarea value={form.befund} onChange={(e) => setForm({ ...form, befund: e.target.value })} rows={2}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{tr(T.therapie)}</span>
          <textarea value={form.therapie} onChange={(e) => setForm({ ...form, therapie: e.target.value })} rows={2}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500" />
        </label>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">{tr(T.positionen)}</span>
            <select
              value=""
              onChange={(e) => e.target.value && posHinzu(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 max-w-56"
            >
              <option value="">{tr(T.posWaehlen)}</option>
              {[...katalog].sort((a, b) => (a.code || '').localeCompare(b.code || '')).map((k) => (
                <option key={k.id} value={k.id}>{k.code} · {k.name} — {euro(k.preis)}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 space-y-1.5">
            {form.positionen.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm">
                <span className="text-xs font-mono text-praxis-700 shrink-0">{p.code}</span>
                <span className="flex-1 min-w-0 truncate">{p.name}</span>
                <button type="button" onClick={() => posAnzahl(i, -1)} className="w-6 h-6 rounded-full bg-white border border-slate-200 font-bold">–</button>
                <span className="w-7 text-center font-semibold">{p.anzahl}×</span>
                <button type="button" onClick={() => posAnzahl(i, +1)} className="w-6 h-6 rounded-full bg-white border border-slate-200 font-bold">+</button>
                <span className="w-20 text-right font-bold" dir="ltr">{euro(p.preis * p.anzahl)}</span>
                <button type="button" onClick={() => setForm({ ...form, positionen: form.positionen.filter((_, idx) => idx !== i) })}
                  className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
              </div>
            ))}
            {form.positionen.length > 0 && (
              <div className="flex justify-between font-bold text-sm bg-praxis-50 rounded-xl px-3 py-2.5 text-praxis-900">
                <span>{tr(T.gesamt)}</span><span dir="ltr">{euro(summe(form.positionen))}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 text-[11px] font-bold w-fit">
            {['entwurf', 'eingereicht', 'genehmigt', 'abgelehnt'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const patch = { status: s }
                  // Genehmigt: Gültigkeit standardmäßig 6 Monate (HKP-Regel)
                  if (s === 'genehmigt' && !form.gueltigBis) {
                    const d = new Date()
                    d.setMonth(d.getMonth() + 6)
                    patch.gueltigBis = d.toISOString().slice(0, 10)
                  }
                  setForm({ ...form, ...patch })
                }}
                className={`px-3 py-1.5 rounded-full ${
                  form.status === s ? (s === 'abgelehnt' ? 'bg-red-600 text-white' : 'bg-praxis-600 text-white') : 'text-slate-500'
                }`}
              >
                {tr(T.planStatus[s])}
              </button>
            ))}
          </div>
          {form.status === 'genehmigt' && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              {tr(T.gueltigBis)}
              <input
                type="date"
                value={form.gueltigBis || ''}
                onChange={(e) => setForm({ ...form, gueltigBis: e.target.value })}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              />
            </label>
          )}
        </div>

        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3 rounded-xl">{tr(T.speichern)}</button>
          {plan && (
            <button type="button" onClick={loeschen} className="bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold px-4 rounded-xl text-sm">
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}

function PatientForm({ patient, onClose, onGespeichert }) {
  const [form, setForm] = useState(patient ? { ...LEER, ...patient } : { ...LEER })
  const [fehler, setFehler] = useState('')

  const felder = [
    ['vorname', T.vorname, 'text'],
    ['nachname', T.nachname, 'text'],
    ['geburtsdatum', T.geburtsdatum, 'date'],
    ['telefon', T.telefon, 'tel'],
    ['email', T.email, 'email'],
    ['versicherung', T.kasse, 'text'],
    ['zusatzversicherung', T.zusatzGes, 'text'],
    ['zusatzversicherungNr', T.zusatzNr, 'text'],
  ]

  async function speichern(e) {
    e.preventDefault()
    if (!form.vorname.trim() || !form.nachname.trim()) return setFehler(tr(T.pflicht))
    const daten = { ...form, vorname: form.vorname.trim(), nachname: form.nachname.trim() }
    const id = await withStore(async (s) => {
      if (patient) {
        await s.update('patients', patient.id, daten)
        return patient.id
      }
      return s.add('patients', { ...daten, createdAt: Date.now() })
    })
    onGespeichert?.(id)
    onClose()
  }

  return (
    <Modal titel={patient ? tr(T.formBearbeiten) : tr(T.formNeu)} onClose={onClose}>
      <form onSubmit={speichern} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          {felder.map(([key, label, typ]) => (
            <label key={key} className="block">
              <span className="text-sm font-medium text-slate-700">{tr(label)}</span>
              <input
                type={typ}
                value={form[key] || ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
              />
            </label>
          ))}
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{tr(T.hinweise)}</span>
          <textarea
            value={form.notizen || ''}
            onChange={(e) => setForm({ ...form, notizen: e.target.value })}
            rows={2}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
          />
        </label>
        {/* Risiko-Tags (erscheinen groß im Arzt-Cockpit) */}
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONEN.map((o) => {
            const aktiv = (form.tags || []).includes(o.key)
            return (
              <button
                key={o.key}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    tags: aktiv ? (form.tags || []).filter((t) => t !== o.key) : [...(form.tags || []), o.key],
                  })
                }
                className={`text-xs font-bold rounded-full px-3.5 py-2 border-2 transition ${
                  aktiv ? 'bg-red-50 border-red-400 text-red-700' : 'border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                {o.icon} {tr(o.label)}
              </button>
            )
          })}
        </div>
        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>}
        <button type="submit" className="w-full bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3.5 rounded-xl">
          {tr(T.speichern)}
        </button>
      </form>
    </Modal>
  )
}
