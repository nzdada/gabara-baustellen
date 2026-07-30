import { useMemo, useState } from 'react'
import { useCollection, withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { heuteISO, addTage } from '@shared/slots.js'
import { summe, euro } from '@shared/format.js'
import { useLang, tr, datumLok } from '@shared/i18n.js'
import { druckeBericht } from '../drucken.js'

// Status-Farben für das Termin-Chart (Palette validiert: Lightness/Chroma/CVD ok;
// Amber hat Kontrast-WARN -> Pflicht-Ausgleich über Legende, Zahlen + Tooltips)
const CHART_FARBEN = {
  abgeschlossen: '#0d9488',
  rechtzeitig: '#f59e0b',
  kurzfristig: '#dc2626',
}

// Arzt-Dashboard: Wer wurde behandelt, was wurde verdient, Bericht-Export
// (Behandlungsprotokoll inkl. Bilder – für Überweisungen oder die Versicherung).

const T = {
  titel: { de: 'Arzt-Dashboard', en: 'Doctor dashboard', ar: 'لوحة الطبيب' },
  untertitel: { de: 'Behandelte Patienten, Umsatz und Berichte auf einen Blick.', en: 'Treated patients, revenue and reports at a glance.', ar: 'المرضى المعالجون والإيرادات والتقارير في لمحة.' },
  zeitraeume: [
    { key: 'heute', label: { de: 'Heute', en: 'Today', ar: 'اليوم' }, tage: 0 },
    { key: 'woche', label: { de: '7 Tage', en: '7 days', ar: '7 أيام' }, tage: 7 },
    { key: 'monat', label: { de: '30 Tage', en: '30 days', ar: '30 يومًا' }, tage: 30 },
    { key: 'alle', label: { de: 'Gesamt', en: 'All', ar: 'الكل' }, tage: 9999 },
  ],
  behandlungen: { de: 'Behandlungen', en: 'Treatments', ar: 'علاجات' },
  patienten: { de: 'Patienten', en: 'Patients', ar: 'مرضى' },
  umsatz: { de: 'Umsatz (Leistungen)', en: 'Revenue (services)', ar: 'الإيرادات (الخدمات)' },
  offenBetrag: { de: 'davon offen', en: 'of which open', ar: 'منها مفتوح' },
  alleAerzte: { de: 'Alle Behandler', en: 'All practitioners', ar: 'كل المعالجين' },
  tabelle: { de: 'Abgeschlossene Behandlungen', en: 'Completed treatments', ar: 'العلاجات المنجزة' },
  keine: { de: 'Im gewählten Zeitraum keine abgeschlossenen Behandlungen.', en: 'No completed treatments in the selected period.', ar: 'لا علاجات منجزة في الفترة المحددة.' },
  bericht: { de: 'Bericht', en: 'Report', ar: 'تقرير' },
  gesamtBericht: { de: 'Gesamtbericht je Patient: Patienten → Patient öffnen → „Bericht (PDF)".', en: 'Full report per patient: Patients → open patient → “Report (PDF)”.', ar: 'تقرير كامل لكل مريض: المرضى ← افتح المريض ← "تقرير PDF".' },
  bilder: { de: 'Bilder', en: 'images', ar: 'صور' },
  rechnungStatus: { offen: { de: 'offen', en: 'open', ar: 'مفتوح' }, pruefen: { de: 'prüfen', en: 'review', ar: 'مراجعة' }, gestellt: { de: 'gestellt', en: 'issued', ar: 'صادرة' }, bezahlt: { de: 'bezahlt', en: 'paid', ar: 'مدفوعة' } },
  patientenGesamt: { de: 'Patienten gesamt', en: 'Total patients', ar: 'إجمالي المرضى' },
  neu30: { de: 'neu in 30 Tagen', en: 'new in 30 days', ar: 'جدد خلال 30 يومًا' },
  ausfallquote: { de: 'Ausfallquote', en: 'No-show rate', ar: 'نسبة الإلغاء' },
  gebuehrenUmsatz: { de: 'Ausfallgebühren', en: 'No-show fees', ar: 'رسوم الإلغاء' },
  chartTitel: { de: 'Termine der letzten 8 Wochen', en: 'Appointments – last 8 weeks', ar: 'مواعيد آخر 8 أسابيع' },
  lAbgeschlossen: { de: 'Erfolgreich', en: 'Completed', ar: 'منجزة' },
  lRechtzeitig: { de: 'Abgesagt (≥ 24 Std.)', en: 'Cancelled (≥ 24 h)', ar: 'ملغاة (≥ 24 س)' },
  lKurzfristig: { de: 'Kurzfristig (< 24 Std.)', en: 'Short notice (< 24 h)', ar: 'متأخرة (< 24 س)' },
  woche: { de: 'KW', en: 'Wk', ar: 'أسبوع' },
  auffTitel: { de: 'Auffällige Patienten (≥ 2 kurzfristige Absagen)', en: 'Conspicuous patients (≥ 2 short-notice cancellations)', ar: 'مرضى ملفتون (≥ إلغاءان متأخران)' },
  auffLeer: { de: 'Keine auffälligen Patienten – sehr gut!', en: 'No conspicuous patients – great!', ar: 'لا يوجد مرضى ملفتون – ممتاز!' },
  spAbsagen: { de: 'kurzfr. Absagen', en: 'short-notice', ar: 'إلغاءات متأخرة' },
  spGebuehren: { de: 'Gebühren offen', en: 'fees open', ar: 'رسوم مفتوحة' },
  sperren: { de: 'Online-Buchung sperren', en: 'Block online booking', ar: 'حظر الحجز الإلكتروني' },
  entsperren: { de: 'Sperre aufheben', en: 'Unblock', ar: 'إلغاء الحظر' },
  gesperrt: { de: 'GESPERRT', en: 'BLOCKED', ar: 'محظور' },
}

// Gestapeltes Wochen-Chart: Erfolgreich (teal) / rechtzeitig abgesagt (amber) /
// kurzfristig abgesagt (rot). Dünne Balken, 2px-Lücken zwischen Segmenten,
// Legende + Hover-Tooltip (Pflicht-Ausgleich für den Amber-Kontrast).
function WochenChart({ appointments }) {
  useLang()
  const [tip, setTip] = useState(null) // {x, y, woche, werte}
  const heute = heuteISO()

  const wochen = useMemo(() => {
    const liste = []
    for (let w = 7; w >= 0; w--) {
      const bis = addTage(heute, -w * 7)
      const von = addTage(bis, -6)
      const im = appointments.filter((a) => a.datum >= von && a.datum <= bis)
      liste.push({
        label: `${new Date(von + 'T12:00:00').getDate()}.${new Date(von + 'T12:00:00').getMonth() + 1}.`,
        abgeschlossen: im.filter((a) => a.status === 'abgeschlossen').length,
        rechtzeitig: im.filter((a) => a.status === 'abgesagt' && !a.kurzfristig).length,
        kurzfristig: im.filter((a) => a.status === 'abgesagt' && a.kurzfristig).length,
      })
    }
    return liste
  }, [appointments, heute])

  const max = Math.max(1, ...wochen.map((w) => w.abgeschlossen + w.rechtzeitig + w.kurzfristig))
  const B = 34 // Balkenbreite
  const H = 150 // Plot-Höhe
  const abstand = 66

  const legende = [
    ['abgeschlossen', T.lAbgeschlossen],
    ['rechtzeitig', T.lRechtzeitig],
    ['kurzfristig', T.lKurzfristig],
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 relative">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <p className="font-bold text-sm text-slate-800 mr-auto rtl:mr-0 rtl:ml-auto">{tr(T.chartTitel)}</p>
        {legende.map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-[4px]" style={{ background: CHART_FARBEN[key] }} /> {tr(label)}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto" dir="ltr">
        <svg viewBox={`0 0 ${wochen.length * abstand + 20} ${H + 34}`} className="mt-3 w-full min-w-[520px]" onMouseLeave={() => setTip(null)}>
          {wochen.map((w, i) => {
            const gesamt = w.abgeschlossen + w.rechtzeitig + w.kurzfristig
            const x = 14 + i * abstand
            let y = H
            const segmente = []
            for (const key of ['abgeschlossen', 'rechtzeitig', 'kurzfristig']) {
              const h = (w[key] / max) * (H - 18)
              if (w[key] > 0) {
                y -= h
                segmente.push(
                  <rect
                    key={key}
                    x={x}
                    y={y}
                    width={B}
                    height={Math.max(h - 2, 2) /* 2px Lücke zwischen Segmenten */}
                    rx="4"
                    fill={CHART_FARBEN[key]}
                    onMouseEnter={() => setTip({ x: x + B / 2, woche: w })}
                  />
                )
              }
            }
            return (
              <g key={i}>
                {segmente}
                {gesamt > 0 && (
                  <text x={x + B / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">{gesamt}</text>
                )}
                <text x={x + B / 2} y={H + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">{tr(T.woche)} {w.label}</text>
                <rect x={x - 8} y={0} width={B + 16} height={H} fill="transparent" onMouseEnter={() => setTip({ x: x + B / 2, woche: w })} />
              </g>
            )
          })}
          <line x1="8" y1={H} x2={wochen.length * abstand + 14} y2={H} stroke="#e2e8f0" strokeWidth="1" />
        </svg>
      </div>
      {tip && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 shadow-xl pointer-events-none z-10">
          {legende.map(([key, label]) => (
            <p key={key} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_FARBEN[key] }} />
              {tr(label)}: <strong>{tip.woche[key]}</strong>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  useLang()
  const appointments = useCollection('appointments')
  const patients = useCollection('patients')
  const photos = useCollection('photos')
  const [zeitraum, setZeitraum] = useState('woche')
  const [arzt, setArzt] = useState('')

  const heute = heuteISO()
  const aerzte = useMemo(() => [...new Set(appointments.map((a) => a.arzt).filter(Boolean))].sort(), [appointments])

  const fertige = useMemo(() => {
    const zr = T.zeitraeume.find((z) => z.key === zeitraum)
    const von = addTage(heute, -zr.tage)
    return appointments
      .filter((a) => a.status === 'abgeschlossen' && a.datum >= von && a.datum <= heute && (!arzt || a.arzt === arzt))
      .sort((a, b) => `${b.datum}${b.start}`.localeCompare(`${a.datum}${a.start}`))
  }, [appointments, zeitraum, arzt, heute])

  const umsatz = fertige.reduce((s, a) => s + summe(a.leistungen), 0)
  const offen = fertige.filter((a) => ['offen', 'pruefen'].includes(a.rechnung || 'offen')).reduce((s, a) => s + summe(a.leistungen), 0)
  const patientenAnzahl = new Set(fertige.map((a) => a.patientId)).size

  // Praxis-Kennzahlen (Modul 7)
  const neue30 = patients.filter((p) => p.createdAt && Date.now() - p.createdAt < 30 * 86400000).length
  const zr = T.zeitraeume.find((z) => z.key === zeitraum)
  const vonDatum = addTage(heute, -zr.tage)
  const imZeitraum = appointments.filter((a) => a.datum >= vonDatum && a.datum <= heute && a.status !== 'bestaetigt')
  const abgesagtZahl = imZeitraum.filter((a) => a.status === 'abgesagt').length
  const ausfallquote = imZeitraum.length > 0 ? Math.round((abgesagtZahl / imZeitraum.length) * 100) : 0
  const gebuehrenUmsatz = appointments
    .filter((a) => a.datum >= vonDatum)
    .reduce((s, a) => s + (a.leistungen || []).filter((l) => l.katalogId === 'ausfall').reduce((x, l) => x + l.preis * (l.anzahl || 1), 0), 0)

  // Auffällige Patienten: >= 2 kurzfristige Absagen
  const auffaellige = useMemo(() => {
    const zaehler = {}
    for (const a of appointments) {
      if (a.status === 'abgesagt' && a.kurzfristig) {
        zaehler[a.patientId] = zaehler[a.patientId] || { anzahl: 0, gebuehren: 0 }
        zaehler[a.patientId].anzahl++
        if (a.ausfallgebuehr === 'ausstehend') {
          zaehler[a.patientId].gebuehren += (a.leistungen || []).filter((l) => l.katalogId === 'ausfall').reduce((x, l) => x + l.preis, 0)
        }
      }
    }
    return Object.entries(zaehler)
      .filter(([, w]) => w.anzahl >= 2)
      .map(([pid, w]) => ({ patient: patients.find((p) => p.id === pid), ...w }))
      .filter((e) => e.patient)
      .sort((a, b) => b.anzahl - a.anzahl)
  }, [appointments, patients])

  async function sperren(patient, wert) {
    await withStore((s) => s.update('patients', patient.id, { gesperrt: wert }))
  }

  function bericht(t) {
    const patient = patients.find((p) => p.id === t.patientId)
    druckeBericht(patient, [t], photos)
  }

  const stat = [
    { icon: 'check', wert: fertige.length, label: T.behandlungen },
    { icon: 'users', wert: patientenAnzahl, label: T.patienten },
    { icon: 'calendar', wert: euro(umsatz), label: T.umsatz, gruen: true },
    { icon: 'alert', wert: euro(offen), label: T.offenBetrag, amber: true },
    { icon: 'users', wert: patients.length, label: T.patientenGesamt, trend: `+${neue30} ${tr(T.neu30)}` },
    { icon: 'x', wert: `${ausfallquote} %`, label: T.ausfallquote, amber: ausfallquote >= 15 },
    { icon: 'shield', wert: euro(gebuehrenUmsatz), label: T.gebuehrenUmsatz, gruen: gebuehrenUmsatz > 0 },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-xl font-bold text-slate-900">{tr(T.titel)}</h1>
        <div className="flex items-center gap-1 bg-white rounded-full border border-slate-200 p-1 text-xs font-semibold">
          {T.zeitraeume.map((z) => (
            <button
              key={z.key}
              onClick={() => setZeitraum(z.key)}
              className={`px-3 py-1.5 rounded-full ${zeitraum === z.key ? 'bg-praxis-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {tr(z.label)}
            </button>
          ))}
        </div>
        <select
          value={arzt}
          onChange={(e) => setArzt(e.target.value)}
          className="ml-auto rtl:ml-0 rtl:mr-auto text-sm bg-white border border-slate-200 rounded-full px-3.5 py-2"
        >
          <option value="">{tr(T.alleAerzte)}</option>
          {aerzte.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <p className="text-sm text-slate-500 mb-5">{tr(T.untertitel)}</p>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stat.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              s.gruen ? 'bg-praxis-100 text-praxis-700' : s.amber ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <Icon name={s.icon} className="w-5 h-5" />
            </div>
            <p className={`mt-3 text-2xl font-bold ${s.gruen ? 'text-praxis-700' : s.amber ? 'text-amber-600' : 'text-slate-900'}`} dir="ltr">{s.wert}</p>
            <p className="text-xs text-slate-500 mt-0.5">{tr(s.label)}</p>
            {s.trend && <p className="text-[11px] font-semibold text-praxis-700 mt-0.5">↗ {s.trend}</p>}
          </div>
        ))}
      </div>

      {/* Termin-Verlauf: gestapelte Wochen-Balken (grün/gelb/rot) */}
      <WochenChart appointments={appointments} />

      {/* Auffällige Patienten ("Blacklist") */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
        <p className="px-5 py-3.5 font-bold text-sm text-slate-800 border-b border-slate-100">⚠ {tr(T.auffTitel)}</p>
        {auffaellige.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-400">{tr(T.auffLeer)}</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {auffaellige.map((e) => (
              <div key={e.patient.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
                <p className="font-semibold text-slate-900 min-w-0 flex-1">
                  {e.patient.vorname} {e.patient.nachname}
                  {e.patient.gesperrt && (
                    <span className="mx-2 text-[10px] font-bold bg-red-600 text-white rounded-full px-2 py-0.5 align-middle">{tr(T.gesperrt)}</span>
                  )}
                </p>
                <span className="text-xs font-bold bg-red-100 text-red-700 rounded-full px-2.5 py-1">{e.anzahl}× {tr(T.spAbsagen)}</span>
                <span className="text-xs font-bold bg-amber-100 text-amber-700 rounded-full px-2.5 py-1" dir="ltr">{euro(e.gebuehren)} {tr(T.spGebuehren)}</span>
                <button
                  onClick={() => sperren(e.patient, !e.patient.gesperrt)}
                  className={`text-xs font-semibold rounded-full px-3.5 py-2 border ${
                    e.patient.gesperrt
                      ? 'border-slate-200 text-slate-500 hover:border-praxis-400'
                      : 'border-red-300 text-red-600 hover:bg-red-50'
                  }`}
                >
                  {e.patient.gesperrt ? tr(T.entsperren) : tr(T.sperren)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Behandlungsliste */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <p className="px-5 py-3.5 font-bold text-sm text-slate-800 border-b border-slate-100">{tr(T.tabelle)} ({fertige.length})</p>
        {fertige.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">{tr(T.keine)}</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {fertige.map((t) => {
              const bilder = photos.filter((p) => p.terminId === t.id).length
              const betrag = summe(t.leistungen)
              const patient = patients.find((p) => p.id === t.patientId)
              return (
                <div key={t.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">
                      {t.patientName}
                      {patient?.zusatzversicherung && (
                        <span className="mx-2 text-[10px] font-bold bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 align-middle">
                          + {patient.zusatzversicherung}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {datumLok(t.datum)} · {t.start} · {t.behandlung} · {t.arzt}
                      {bilder > 0 && ` · ${bilder} ${tr(T.bilder)}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 ${
                    t.rechnung === 'bezahlt' ? 'bg-praxis-100 text-praxis-800'
                    : t.rechnung === 'gestellt' ? 'bg-sky-100 text-sky-700'
                    : t.rechnung === 'pruefen' ? 'bg-violet-100 text-violet-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}>
                    {tr(T.rechnungStatus[t.rechnung || 'offen'])}
                  </span>
                  <span className="w-24 text-right rtl:text-left font-bold text-slate-900" dir="ltr">{betrag > 0 ? euro(betrag) : '–'}</span>
                  <button
                    onClick={() => bericht(t)}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-praxis-400 text-slate-600 text-xs font-semibold px-3 py-2 rounded-full"
                  >
                    <Icon name="upload" className="w-3.5 h-3.5 rotate-180" /> {tr(T.bericht)} (PDF)
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-400">{tr(T.gesamtBericht)}</p>
    </div>
  )
}
