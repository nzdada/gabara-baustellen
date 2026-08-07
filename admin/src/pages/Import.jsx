import { useState } from 'react'
import { withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { useLang, tr } from '@shared/i18n.js'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'

const TT = {
  titel: { de: 'Kunden-Import aus dem Altsystem', en: 'Customer import from your old system', ar: 'استيراد العملاء من النظام القديم' },
  untertitel: {
    de: 'Kundenliste als CSV-Datei exportieren (aus der bisherigen Software oder Excel: „Speichern unter → CSV") und hier hochladen. Die Spalten werden automatisch erkannt – die Zuordnung lässt sich anpassen.',
    en: 'Export your customer list as a CSV file (from your previous software or Excel: “Save as → CSV”) and upload it here. Columns are detected automatically – you can adjust the mapping.',
    ar: 'صدّر قائمة العملاء كملف CSV وارفعه هنا. تُكتشف الأعمدة تلقائيًا ويمكنك تعديل الربط.',
  },
  importiert: { de: 'Kunden importiert.', en: 'customers imported.', ar: 'عميلًا تم استيرادهم.' },
  uebersprungen: { de: 'übersprungen (leer oder bereits vorhanden).', en: 'skipped (empty or already existing).', ar: 'تم تخطيهم (فارغ أو موجود مسبقًا).' },
  waehlen: { de: 'CSV-Datei auswählen', en: 'Choose CSV file', ar: 'اختر ملف CSV' },
  trenner: { de: 'Trennzeichen ; , oder Tab – wird automatisch erkannt', en: 'Delimiter ; , or tab – detected automatically', ar: 'الفاصل ; أو , أو Tab – يُكتشف تلقائيًا' },
  zuordnen: { de: 'Spalten zuordnen', en: 'Map columns', ar: 'ربط الأعمدة' },
  zeilen: { de: 'Zeilen erkannt', en: 'rows detected', ar: 'صفًا تم اكتشافها' },
  nicht: { de: '– nicht importieren –', en: '– do not import –', ar: '– لا تستورد –' },
  spalte: { de: 'Spalte', en: 'Column', ar: 'عمود' },
  vorschau: { de: 'Vorschau (erste 5 Zeilen)', en: 'Preview (first 5 rows)', ar: 'معاينة (أول 5 صفوف)' },
  importieren: { de: 'Kunden importieren', en: 'Import customers', ar: 'استيراد العملاء' },
  laeuft: { de: 'Importiere …', en: 'Importing …', ar: 'جارٍ الاستيراد …' },
  pflichtFehlt: { de: 'Bitte mindestens Firma oder Nachname zuordnen.', en: 'Please map at least company or last name.', ar: 'يرجى ربط الشركة أو اسم العائلة على الأقل.' },
  dubletten: { de: 'Doppelte Kunden (gleicher Name/Firma + Telefon) werden automatisch übersprungen.', en: 'Duplicate customers (same name/company + phone) are skipped automatically.', ar: 'يتم تلقائيًا تخطي العملاء المكررين.' },
  ziele: {
    vorname: { de: 'Vorname', en: 'First name', ar: 'الاسم الأول' },
    nachname: { de: 'Nachname', en: 'Last name', ar: 'اسم العائلة' },
    firma: { de: 'Firma', en: 'Company', ar: 'الشركة' },
    telefon: { de: 'Telefon', en: 'Phone', ar: 'الهاتف' },
    email: { de: 'E-Mail', en: 'E-mail', ar: 'البريد الإلكتروني' },
    strasse: { de: 'Straße und Nr.', en: 'Street', ar: 'الشارع' },
    plzOrt: { de: 'PLZ und Ort', en: 'Postcode and town', ar: 'الرمز البريدي والمدينة' },
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
  { key: 'firma', muster: /firma|company|organisation|betrieb/i },
  { key: 'vorname', muster: /vorname|first/i },
  { key: 'nachname', muster: /nachname|name|last/i },
  { key: 'telefon', muster: /tel|phone|handy|mobil/i },
  { key: 'email', muster: /mail/i },
  { key: 'strasse', muster: /stra(ss|ß)e|adresse|anschrift|street/i },
  { key: 'plzOrt', muster: /plz|ort|stadt|postleit|city|town/i },
  { key: 'notizen', muster: /notiz|hinweis|bemerk|anmerk/i },
]

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
          const firma = wert('firma')
          const vorname = wert('vorname')
          const nachname = wert('nachname')
          // Ein Kunde braucht mindestens eine Firma ODER einen Namen
          if (!firma && !vorname && !nachname) { uebersprungen++; continue }
          const telefon = wert('telefon')
          const kennung = (p) => `${p.firma || ''}|${p.vorname || ''}|${p.nachname || ''}`.toLowerCase()
          const neuKennung = `${firma}|${vorname}|${nachname}`.toLowerCase()
          const doppelt = vorhandene.find(
            (p) => kennung(p) === neuKennung
              && (!telefon || (p.telefon || '').replace(/\D/g, '') === telefon.replace(/\D/g, ''))
          )
          if (doppelt) { uebersprungen++; continue }
          await s.add('patients', {
            firma, vorname, nachname,
            ansprechpartner: `${vorname} ${nachname}`.trim(),
            telefon,
            email: wert('email'),
            strasse: wert('strasse'),
            plzOrt: wert('plzOrt'),
            // Abrechnungs-Standards wie bei neuen Kunden (§13b für Gewerbe)
            typ: firma ? 'gu' : 'privat',
            ustModus: firma ? '13b' : 'ust19',
            notizen: wert('notizen'),
            fastbillCustomerId: null,
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

  // Mindestens Firma ODER Nachname muss zugeordnet sein
  const pflichtOk = mapping.firma !== undefined || mapping.nachname !== undefined

  return (
    <div className={S.SEITE_SCHMAL}>
      <Seitenkopf icon="upload" titel={tr(TT.titel)} sub={tr(TT.untertitel)} />

      {ergebnis && (
        <div className="mb-5 bg-praxis-50 border border-praxis-200 rounded-karte px-5 py-4 text-sm text-praxis-900 flex items-center gap-3">
          <Icon name="check" className="w-5 h-5 text-praxis-600" strokeWidth={2.5} />
          <span>
            <strong>{ergebnis.neu} {tr(TT.importiert)}</strong>
            {ergebnis.uebersprungen > 0 && ` ${ergebnis.uebersprungen} ${tr(TT.uebersprungen)}`}
          </span>
        </div>
      )}

      <label className="block bg-karte border-2 border-dashed border-rahmen hover:border-praxis-400 rounded-karte p-10 text-center cursor-pointer transition">
        <input type="file" accept=".csv,.txt" onChange={dateiGeladen} className="hidden" />
        <Icon name="upload" className="w-10 h-10 mx-auto text-praxis-500" />
        <p className="mt-3 font-semibold text-schrift">{tr(TT.waehlen)}</p>
        <p className="text-xs text-schrift-zart mt-1">{dateiName || tr(TT.trenner)}</p>
      </label>

      {kopf.length > 0 && (
        <div className="mt-6 bg-karte rounded-karte border border-rahmen p-6">
          <h2 className="font-bold text-schrift-stark text-sm mb-4">
            {tr(TT.zuordnen)} <span className="text-schrift-zart font-normal">({daten.length} {tr(TT.zeilen)})</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {ZIELE.map((z) => (
              <label key={z.key} className="flex items-center gap-3 text-sm">
                <span className={`w-32 shrink-0 ${z.pflicht ? 'font-semibold text-schrift-stark' : 'text-schrift'}`}>
                  {tr(TT.ziele[z.key])}{z.pflicht && ' *'}
                </span>
                <select
                  value={mapping[z.key] ?? ''}
                  onChange={(e) =>
                    setMapping({ ...mapping, [z.key]: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                  className="flex-1 rounded-feld border border-rahmen px-3 py-2 bg-karte text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
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
          <h3 className="font-bold text-schrift-stark text-sm mt-6 mb-2">{tr(TT.vorschau)}</h3>
          <div className="overflow-x-auto border border-rahmen rounded-feld">
            <table className="w-full text-xs">
              <thead className="bg-gedeckt">
                <tr>
                  {ZIELE.filter((z) => mapping[z.key] !== undefined).map((z) => (
                    <th key={z.key} className="text-left rtl:text-right px-3 py-2 font-semibold text-schrift">{tr(TT.ziele[z.key])}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {daten.slice(0, 5).map((zeile, i) => (
                  <tr key={i} className="border-t border-rahmen">
                    {ZIELE.filter((z) => mapping[z.key] !== undefined).map((z) => (
                      <td key={z.key} className="px-3 py-2 text-schrift">
                        {zeile[mapping[z.key]]}
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
            className="mt-5 w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-feld"
          >
            {laedt ? tr(TT.laeuft) : `${daten.length} ${tr(TT.importieren)}`}
          </button>
          {!pflichtOk && <p className="mt-2 text-xs text-red-600 text-center">{tr(TT.pflichtFehlt)}</p>}
          <p className="mt-2 text-xs text-schrift-zart text-center">{tr(TT.dubletten)}</p>
        </div>
      )}
    </div>
  )
}
