import { useState } from 'react'
import { withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { useLang, tr } from '@shared/i18n.js'

const TT = {
  titel: { de: 'Daten-Import aus dem Altsystem', en: 'Data import from your old system', ar: 'استيراد البيانات من النظام القديم' },
  untertitel: {
    de: 'Patientenliste als CSV-Datei exportieren (aus jedem Praxisprogramm oder Excel: „Speichern unter → CSV") und hier hochladen. Die Spalten werden automatisch erkannt – Sie können die Zuordnung anpassen.',
    en: 'Export your patient list as a CSV file (from any practice software or Excel: “Save as → CSV”) and upload it here. Columns are detected automatically – you can adjust the mapping.',
    ar: 'صدّر قائمة المرضى كملف CSV (من أي برنامج عيادة أو Excel: "حفظ باسم ← CSV") وارفعه هنا. تُكتشف الأعمدة تلقائيًا ويمكنك تعديل الربط.',
  },
  importiert: { de: 'Patienten importiert.', en: 'patients imported.', ar: 'مريضًا تم استيرادهم.' },
  uebersprungen: { de: 'übersprungen (leer oder bereits vorhanden).', en: 'skipped (empty or already existing).', ar: 'تم تخطيهم (فارغ أو موجود مسبقًا).' },
  waehlen: { de: 'CSV-Datei auswählen', en: 'Choose CSV file', ar: 'اختر ملف CSV' },
  trenner: { de: 'Trennzeichen ; , oder Tab – wird automatisch erkannt', en: 'Delimiter ; , or tab – detected automatically', ar: 'الفاصل ; أو , أو Tab – يُكتشف تلقائيًا' },
  zuordnen: { de: 'Spalten zuordnen', en: 'Map columns', ar: 'ربط الأعمدة' },
  zeilen: { de: 'Zeilen erkannt', en: 'rows detected', ar: 'صفًا تم اكتشافها' },
  nicht: { de: '– nicht importieren –', en: '– do not import –', ar: '– لا تستورد –' },
  spalte: { de: 'Spalte', en: 'Column', ar: 'عمود' },
  vorschau: { de: 'Vorschau (erste 5 Zeilen)', en: 'Preview (first 5 rows)', ar: 'معاينة (أول 5 صفوف)' },
  importieren: { de: 'Patienten importieren', en: 'Import patients', ar: 'استيراد المرضى' },
  laeuft: { de: 'Importiere …', en: 'Importing …', ar: 'جارٍ الاستيراد …' },
  pflichtFehlt: { de: 'Bitte mindestens Vor- und Nachname zuordnen.', en: 'Please map at least first and last name.', ar: 'يرجى ربط الاسم الأول واسم العائلة على الأقل.' },
  dubletten: { de: 'Doppelte Patienten (gleicher Name + Telefon) werden automatisch übersprungen.', en: 'Duplicate patients (same name + phone) are skipped automatically.', ar: 'يتم تلقائيًا تخطي المرضى المكررين (نفس الاسم والهاتف).' },
  ziele: {
    vorname: { de: 'Vorname', en: 'First name', ar: 'الاسم الأول' },
    nachname: { de: 'Nachname', en: 'Last name', ar: 'اسم العائلة' },
    geburtsdatum: { de: 'Geburtsdatum', en: 'Date of birth', ar: 'تاريخ الميلاد' },
    telefon: { de: 'Telefon', en: 'Phone', ar: 'الهاتف' },
    email: { de: 'E-Mail', en: 'E-mail', ar: 'البريد الإلكتروني' },
    versicherung: { de: 'Krankenkasse', en: 'Health insurance', ar: 'التأمين الصحي' },
    notizen: { de: 'Notizen/Hinweise', en: 'Notes', ar: 'ملاحظات' },
  },
}

// Einfacher, robuster CSV-Parser (Trennzeichen ; , oder Tab, Anführungszeichen erlaubt)
function parseCSV(text) {
  const erste = text.split(/\r?\n/).find((z) => z.trim()) || ''
  const kandidaten = [';', ',', '\t']
  const trenner = kandidaten.reduce((best, t) =>
    erste.split(t).length > erste.split(best).length ? t : best
  )
  const zeilen = []
  let feld = ''
  let zeile = []
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++ }
      else if (c === '"') inQuote = false
      else feld += c
    } else if (c === '"') inQuote = true
    else if (c === trenner) { zeile.push(feld); feld = '' }
    else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
      if (c === '\r') i++
      zeile.push(feld); feld = ''
      if (zeile.some((f) => f.trim())) zeilen.push(zeile)
      zeile = []
    } else feld += c
  }
  if (feld || zeile.length) { zeile.push(feld); if (zeile.some((f) => f.trim())) zeilen.push(zeile) }
  return zeilen
}

const ZIELE = [
  { key: 'vorname', pflicht: true, muster: /vorname|first/i },
  { key: 'nachname', pflicht: true, muster: /nachname|name|last/i },
  { key: 'geburtsdatum', muster: /geb|birth/i },
  { key: 'telefon', muster: /tel|phone|handy|mobil/i },
  { key: 'email', muster: /mail/i },
  { key: 'versicherung', muster: /kasse|versich|kk/i },
  { key: 'notizen', muster: /notiz|hinweis|bemerk|anmerk/i },
]

// Datum aus Altsystemen normalisieren: 03.05.1970 / 1970-05-03 / 3.5.70
function normDatum(wert) {
  const w = (wert || '').trim()
  if (!w) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w
  const m = w.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (m) {
    let jahr = Number(m[3])
    if (jahr < 100) jahr += jahr > 26 ? 1900 : 2000
    return `${jahr}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  return w
}

export default function Import() {
  useLang()
  const [kopf, setKopf] = useState([])
  const [daten, setDaten] = useState([])
  const [mapping, setMapping] = useState({})
  const [ergebnis, setErgebnis] = useState(null)
  const [dateiName, setDateiName] = useState('')
  const [laedt, setLaedt] = useState(false)

  function dateiGeladen(e) {
    const datei = e.target.files?.[0]
    if (!datei) return
    setDateiName(datei.name)
    setErgebnis(null)
    const reader = new FileReader()
    reader.onload = () => {
      const zeilen = parseCSV(String(reader.result))
      if (zeilen.length < 2) return
      const header = zeilen[0].map((h) => h.trim())
      setKopf(header)
      setDaten(zeilen.slice(1))
      // Spalten automatisch zuordnen
      const auto = {}
      for (const ziel of ZIELE) {
        const idx = header.findIndex((h, i) => ziel.muster.test(h) && !Object.values(auto).includes(i))
        if (idx >= 0) auto[ziel.key] = idx
      }
      setMapping(auto)
    }
    reader.readAsText(datei, 'utf-8')
  }

  async function importieren() {
    setLaedt(true)
    try {
      let neu = 0
      let uebersprungen = 0
      await withStore(async (s) => {
        const vorhandene = await s.list('patients')
        for (const zeile of daten) {
          const wert = (key) => (mapping[key] !== undefined ? (zeile[mapping[key]] || '').trim() : '')
          const vorname = wert('vorname')
          const nachname = wert('nachname')
          if (!vorname && !nachname) { uebersprungen++; continue }
          const telefon = wert('telefon')
          const doppelt = vorhandene.find(
            (p) =>
              p.vorname.toLowerCase() === vorname.toLowerCase() &&
              p.nachname.toLowerCase() === nachname.toLowerCase() &&
              (!telefon || (p.telefon || '').replace(/\D/g, '') === telefon.replace(/\D/g, ''))
          )
          if (doppelt) { uebersprungen++; continue }
          await s.add('patients', {
            vorname, nachname,
            geburtsdatum: normDatum(wert('geburtsdatum')),
            telefon,
            email: wert('email'),
            versicherung: wert('versicherung'),
            notizen: wert('notizen'),
            createdAt: Date.now(),
          })
          neu++
        }
      })
      setErgebnis({ neu, uebersprungen })
      setKopf([]); setDaten([]); setMapping({})
    } finally {
      setLaedt(false)
    }
  }

  const pflichtOk = ZIELE.filter((z) => z.pflicht).every((z) => mapping[z.key] !== undefined)

  return (
    <div className="p-4 lg:p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-slate-900 mb-1">{tr(TT.titel)}</h1>
      <p className="text-sm text-slate-500 mb-5">{tr(TT.untertitel)}</p>

      {ergebnis && (
        <div className="mb-5 bg-praxis-50 border border-praxis-200 rounded-2xl px-5 py-4 text-sm text-praxis-900 flex items-center gap-3">
          <Icon name="check" className="w-5 h-5 text-praxis-600" strokeWidth={2.5} />
          <span>
            <strong>{ergebnis.neu} {tr(TT.importiert)}</strong>
            {ergebnis.uebersprungen > 0 && ` ${ergebnis.uebersprungen} ${tr(TT.uebersprungen)}`}
          </span>
        </div>
      )}

      <label className="block bg-white border-2 border-dashed border-slate-200 hover:border-praxis-400 rounded-2xl p-10 text-center cursor-pointer transition">
        <input type="file" accept=".csv,.txt" onChange={dateiGeladen} className="hidden" />
        <Icon name="upload" className="w-10 h-10 mx-auto text-praxis-500" />
        <p className="mt-3 font-semibold text-slate-700">{tr(TT.waehlen)}</p>
        <p className="text-xs text-slate-400 mt-1">{dateiName || tr(TT.trenner)}</p>
      </label>

      {kopf.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 text-sm mb-4">
            {tr(TT.zuordnen)} <span className="text-slate-400 font-normal">({daten.length} {tr(TT.zeilen)})</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {ZIELE.map((z) => (
              <label key={z.key} className="flex items-center gap-3 text-sm">
                <span className={`w-32 shrink-0 ${z.pflicht ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                  {tr(TT.ziele[z.key])}{z.pflicht && ' *'}
                </span>
                <select
                  value={mapping[z.key] ?? ''}
                  onChange={(e) =>
                    setMapping({ ...mapping, [z.key]: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
                >
                  <option value="">{tr(TT.nicht)}</option>
                  {kopf.map((h, i) => (
                    <option key={i} value={i}>{h || `${tr(TT.spalte)} ${i + 1}`}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {/* Vorschau */}
          <h3 className="font-bold text-slate-800 text-sm mt-6 mb-2">{tr(TT.vorschau)}</h3>
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {ZIELE.filter((z) => mapping[z.key] !== undefined).map((z) => (
                    <th key={z.key} className="text-left rtl:text-right px-3 py-2 font-semibold text-slate-600">{tr(TT.ziele[z.key])}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {daten.slice(0, 5).map((zeile, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    {ZIELE.filter((z) => mapping[z.key] !== undefined).map((z) => (
                      <td key={z.key} className="px-3 py-2 text-slate-700">
                        {z.key === 'geburtsdatum' ? normDatum(zeile[mapping[z.key]]) : zeile[mapping[z.key]]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={importieren}
            disabled={!pflichtOk || laedt}
            className="mt-5 w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl"
          >
            {laedt ? tr(TT.laeuft) : `${daten.length} ${tr(TT.importieren)}`}
          </button>
          {!pflichtOk && <p className="mt-2 text-xs text-red-600 text-center">{tr(TT.pflichtFehlt)}</p>}
          <p className="mt-2 text-xs text-slate-400 text-center">{tr(TT.dubletten)}</p>
        </div>
      )}
    </div>
  )
}
