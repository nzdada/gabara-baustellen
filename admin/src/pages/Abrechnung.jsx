import { useMemo, useState } from 'react'
import { useCollection, withStore, useEinstellungen } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { summe, euro } from '@shared/format.js'
import { useLang, tr, datumLok } from '@shared/i18n.js'
import { druckeRechnung } from '../drucken.js'
import Modal from '../components/Modal.jsx'
import SummaryEditor from '../components/SummaryEditor.jsx'

// Abrechnung: (1) Rechnungsübersicht mit Zusatzversicherungs-Hinweis,
// (2) Leistungskatalog pflegen (GOZ-Nr., Bezeichnung, Preis),
// (3) Textbausteine für die Behandlungs-Zusammenfassung pflegen.

const T = {
  titel: { de: 'Abrechnung', en: 'Billing', ar: 'الفوترة' },
  tabs: [
    { key: 'rechnungen', label: { de: 'Rechnungen', en: 'Invoices', ar: 'الفواتير' } },
    { key: 'katalog', label: { de: 'Leistungskatalog', en: 'Service catalogue', ar: 'كتالوج الخدمات' } },
    { key: 'bausteine', label: { de: 'Textbausteine', en: 'Text blocks', ar: 'القوالب النصية' } },
  ],
  // Rechnungen
  rUntertitel: { de: 'Abgeschlossene Behandlungen mit Leistungen – Rechnung drucken und Status pflegen.', en: 'Completed treatments with services – print invoices and track status.', ar: 'العلاجات المنجزة مع الخدمات – اطبع الفواتير وتابع الحالة.' },
  keine: { de: 'Keine abrechenbaren Behandlungen vorhanden.', en: 'No billable treatments available.', ar: 'لا توجد علاجات قابلة للفوترة.' },
  zusatz: { de: 'Zahnzusatzversicherung – Rechnung zur Einreichung geeignet', en: 'Supplementary dental insurance – invoice suitable for submission', ar: 'تأمين أسنان تكميلي – الفاتورة صالحة للتقديم' },
  drucken: { de: 'Rechnung (PDF)', en: 'Invoice (PDF)', ar: 'فاتورة (PDF)' },
  status: {
    offen: { de: 'Offen', en: 'Open', ar: 'مفتوحة' },
    pruefen: { de: 'Prüfen', en: 'Review', ar: 'مراجعة' },
    gestellt: { de: 'Gestellt', en: 'Issued', ar: 'صادرة' },
    bezahlt: { de: 'Bezahlt', en: 'Paid', ar: 'مدفوعة' },
  },
  bereit: { de: 'Bereit für Abrechnung (vom Arzt übergeben)', en: 'Ready for billing (handed over by doctor)', ar: 'جاهز للفوترة (سلّمه الطبيب)' },
  bereitHinweis: { de: 'Vom Behandler vorerfasste Leistungen kurz prüfen und mit einem Klick die Rechnung erstellen.', en: 'Briefly review the services pre-recorded by the practitioner and generate the invoice with one click.', ar: 'راجع الخدمات المسجلة مسبقًا وأنشئ الفاتورة بنقرة واحدة.' },
  summeOffen: { de: 'Offene Beträge gesamt', en: 'Total open amount', ar: 'إجمالي المبالغ المفتوحة' },
  // Katalog
  kUntertitel: { de: 'Diese Leistungen kann der Arzt im Cockpit antippen. Preise = 2,3-facher GOZ-Satz (frei anpassbar).', en: 'The doctor can tap these services in the cockpit. Prices = 2.3× GOZ rate (freely adjustable).', ar: 'يمكن للطبيب اختيار هذه الخدمات في شاشته. الأسعار = 2.3 × معدل GOZ (قابلة للتعديل).' },
  neuLeistung: { de: 'Neue Leistung', en: 'New service', ar: 'خدمة جديدة' },
  code: { de: 'Nr. (z. B. GOZ 1040)', en: 'No. (e.g. GOZ 1040)', ar: 'الرقم (مثل GOZ 1040)' },
  name: { de: 'Bezeichnung', en: 'Description', ar: 'الوصف' },
  preis: { de: 'Preis €', en: 'Price €', ar: 'السعر €' },
  speichern: { de: 'Speichern', en: 'Save', ar: 'حفظ' },
  loeschenFrage: { de: 'Wirklich löschen?', en: 'Really delete?', ar: 'هل تريد الحذف فعلًا؟' },
  // Bausteine
  bUntertitel: { de: 'Vorlagen-Blöcke für die Zusammenfassung – der Arzt fügt sie im Cockpit mit einem Tipp ein. **fett** und "- " für Listen.', en: 'Template blocks for the summary – the doctor inserts them with one tap. Use **bold** and "- " for lists.', ar: 'قوالب جاهزة للملخص – يدرجها الطبيب بلمسة واحدة. استخدم **غامق** و "- " للقوائم.' },
  neuBaustein: { de: 'Neuer Baustein', en: 'New block', ar: 'قالب جديد' },
  bTitel: { de: 'Titel (Knopf-Beschriftung)', en: 'Title (button label)', ar: 'العنوان (نص الزر)' },
  bText: { de: 'Text', en: 'Text', ar: 'النص' },
}

export default function Abrechnung() {
  useLang()
  const [tab, setTab] = useState('rechnungen')
  return (
    <div className="p-4 lg:p-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-slate-900">{tr(T.titel)}</h1>
        <div className="flex items-center gap-1 bg-white rounded-full border border-slate-200 p-1 text-xs font-semibold">
          {T.tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full ${tab === t.key ? 'bg-praxis-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {tr(t.label)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'rechnungen' && <Rechnungen />}
      {tab === 'katalog' && <Katalog />}
      {tab === 'bausteine' && <Bausteine />}
    </div>
  )
}

function Rechnungen() {
  const appointments = useCollection('appointments')
  const patients = useCollection('patients')
  const einst = useEinstellungen()

  const abrechenbar = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'abgeschlossen' && (a.leistungen?.length || 0) > 0)
        .sort((a, b) => `${b.datum}${b.start}`.localeCompare(`${a.datum}${a.start}`)),
    [appointments]
  )
  // "Bereit für Abrechnung": vom Arzt abgeschlossen und zur Prüfung übergeben
  const bereit = abrechenbar.filter((a) => (a.rechnung || 'offen') === 'pruefen')
  const uebrige = abrechenbar.filter((a) => (a.rechnung || 'offen') !== 'pruefen')
  const offenSumme = abrechenbar.filter((a) => !['bezahlt'].includes(a.rechnung)).reduce((s, a) => s + summe(a.leistungen), 0)

  async function setzeStatus(t, status) {
    await withStore((s) => s.update('appointments', t.id, { rechnung: status }))
  }

  const karte = (t) => {
            const patient = patients.find((p) => p.id === t.patientId)
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{t.patientName}</p>
                    <p className="text-xs text-slate-400">{datumLok(t.datum)} · {t.behandlung} · {t.arzt} · {t.leistungen.length} Pos.</p>
                  </div>
                  <span className="font-bold text-lg text-slate-900" dir="ltr">{euro(summe(t.leistungen))}</span>
                  <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 text-[11px] font-bold">
                    {['pruefen', 'gestellt', 'bezahlt'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setzeStatus(t, s)}
                        className={`px-2.5 py-1 rounded-full ${
                          (t.rechnung || 'offen') === s
                            ? s === 'bezahlt' ? 'bg-praxis-600 text-white' : s === 'gestellt' ? 'bg-sky-600 text-white' : 'bg-violet-600 text-white'
                            : 'text-slate-500'
                        }`}
                      >
                        {tr(T.status[s])}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => druckeRechnung(patient, t, einst)}
                    className="inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-xs font-semibold px-3.5 py-2 rounded-full"
                  >
                    {tr(T.drucken)}
                  </button>
                </div>
                {patient?.zusatzversicherung && (
                  <p className="mt-2.5 text-xs font-medium text-sky-700 bg-sky-50 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                    <Icon name="shield" className="w-3.5 h-3.5" /> {patient.zusatzversicherung}
                    {patient.zusatzversicherungNr && <span dir="ltr">(Nr. {patient.zusatzversicherungNr})</span>}: {tr(T.zusatz)}
                  </p>
                )}
              </div>
            )
  }

  return (
    <>
      <p className="text-sm text-slate-500 mb-4">{tr(T.rUntertitel)}</p>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 mb-4 flex items-center justify-between text-sm">
        <span className="font-semibold text-amber-800">{tr(T.summeOffen)}</span>
        <span className="font-bold text-amber-800 text-lg" dir="ltr">{euro(offenSumme)}</span>
      </div>

      {/* Vom Arzt übergebene Behandlungen zuerst – kurz prüfen, Rechnung erstellen */}
      {bereit.length > 0 && (
        <div className="mb-5">
          <p className="font-bold text-sm text-violet-800 bg-violet-50 border border-violet-200 rounded-t-2xl px-5 py-3">
            ⚡ {tr(T.bereit)} ({bereit.length})
          </p>
          <div className="border border-t-0 border-violet-200 rounded-b-2xl p-3 space-y-2.5 bg-violet-50/40">
            <p className="text-xs text-violet-700 px-2">{tr(T.bereitHinweis)}</p>
            {bereit.map(karte)}
          </div>
        </div>
      )}

      {abrechenbar.length === 0 ? (
        <p className="bg-white rounded-2xl border border-slate-200 px-5 py-8 text-center text-sm text-slate-400">{tr(T.keine)}</p>
      ) : (
        <div className="space-y-2.5">{uebrige.map(karte)}</div>
      )}
    </>
  )
}

function Katalog() {
  const katalog = useCollection('katalog')
  const [bearbeite, setBearbeite] = useState(null) // null | 'neu' | eintrag

  async function loeschen(k) {
    if (!confirm(tr(T.loeschenFrage))) return
    await withStore((s) => s.remove('katalog', k.id))
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500">{tr(T.kUntertitel)}</p>
        <button
          onClick={() => setBearbeite('neu')}
          className="shrink-0 inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2 rounded-full"
        >
          <Icon name="plus" className="w-4 h-4" /> {tr(T.neuLeistung)}
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {[...katalog].sort((a, b) => (a.code || '').localeCompare(b.code || '')).map((k) => (
          <div key={k.id} className="px-5 py-3 flex items-center gap-3 text-sm">
            <span className="font-mono text-xs text-praxis-700 w-24 shrink-0">{k.code}</span>
            <span className="flex-1 font-medium text-slate-800 min-w-0 truncate">{k.name}</span>
            <span className="font-bold text-slate-900 w-24 text-right rtl:text-left" dir="ltr">{euro(k.preis)}</span>
            <button onClick={() => setBearbeite(k)} className="text-slate-400 hover:text-praxis-700 text-xs font-semibold">✎</button>
            <button onClick={() => loeschen(k)} className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      {bearbeite && <KatalogForm eintrag={bearbeite === 'neu' ? null : bearbeite} onClose={() => setBearbeite(null)} />}
    </>
  )
}

function KatalogForm({ eintrag, onClose }) {
  const [form, setForm] = useState(eintrag || { code: '', name: '', preis: '' })
  async function speichern(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    const daten = { ...form, name: form.name.trim(), preis: Number(form.preis) || 0, faktor: form.faktor || 2.3 }
    await withStore(async (s) => {
      if (eintrag) await s.update('katalog', eintrag.id, daten)
      else await s.add('katalog', daten)
    })
    onClose()
  }
  return (
    <Modal titel={tr(T.neuLeistung)} onClose={onClose}>
      <form onSubmit={speichern} className="space-y-3.5">
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{tr(T.code)}</span>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500" />
          </label>
          <label className="block col-span-2">
            <span className="text-sm font-medium text-slate-700">{tr(T.name)} *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{tr(T.preis)}</span>
          <input type="number" step="0.01" min="0" value={form.preis} onChange={(e) => setForm({ ...form, preis: e.target.value })}
            className="mt-1.5 w-40 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500" dir="ltr" />
        </label>
        <button type="submit" className="w-full bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3 rounded-xl">{tr(T.speichern)}</button>
      </form>
    </Modal>
  )
}

function Bausteine() {
  const bausteine = useCollection('bausteine')
  const [bearbeite, setBearbeite] = useState(null)

  async function loeschen(b) {
    if (!confirm(tr(T.loeschenFrage))) return
    await withStore((s) => s.remove('bausteine', b.id))
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500">{tr(T.bUntertitel)}</p>
        <button
          onClick={() => setBearbeite('neu')}
          className="shrink-0 inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2 rounded-full"
        >
          <Icon name="plus" className="w-4 h-4" /> {tr(T.neuBaustein)}
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {bausteine.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="font-bold text-sm text-slate-900">{b.titel}</p>
              <span className="flex gap-2 shrink-0">
                <button onClick={() => setBearbeite(b)} className="text-slate-400 hover:text-praxis-700 text-xs font-semibold">✎</button>
                <button onClick={() => loeschen(b)} className="text-slate-300 hover:text-red-500"><Icon name="x" className="w-4 h-4" /></button>
              </span>
            </div>
            <p className="text-xs text-slate-500 whitespace-pre-line line-clamp-4">{b.text}</p>
          </div>
        ))}
      </div>
      {bearbeite && <BausteinForm eintrag={bearbeite === 'neu' ? null : bearbeite} onClose={() => setBearbeite(null)} />}
    </>
  )
}

function BausteinForm({ eintrag, onClose }) {
  const [form, setForm] = useState(eintrag || { titel: '', text: '' })
  async function speichern(e) {
    e.preventDefault()
    if (!form.titel.trim() || !form.text.trim()) return
    await withStore(async (s) => {
      if (eintrag) await s.update('bausteine', eintrag.id, form)
      else await s.add('bausteine', form)
    })
    onClose()
  }
  return (
    <Modal titel={tr(T.neuBaustein)} onClose={onClose}>
      <form onSubmit={speichern} className="space-y-3.5">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{tr(T.bTitel)} *</span>
          <input value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500" />
        </label>
        <div>
          <span className="text-sm font-medium text-slate-700 block mb-1.5">{tr(T.bText)} *</span>
          <SummaryEditor
            text={form.text}
            onText={(text) => setForm((f) => ({ ...f, text }))}
            placeholder={'**Überschrift:** …\n- Punkt 1\n- Punkt 2'}
            rows={6}
            mitBausteinen={false}
          />
        </div>
        <button type="submit" className="w-full bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3 rounded-xl">{tr(T.speichern)}</button>
      </form>
    </Modal>
  )
}
