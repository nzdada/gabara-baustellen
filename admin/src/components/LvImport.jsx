import { useState } from 'react'
import Modal from './Modal.jsx'
import { useWhere, withStore } from '../hooks.js'
import { parseCSV, parseZahl } from '../csv.js'
import { euro } from '@shared/format.js'
import { Icon } from '@shared/ui.jsx'

// LV-Import in zwei Wegen:
//  1. CSV-Datei mit Spalten-Mapping (Auto-Erkennung über die Kopfzeile)
//  2. Text aus dem LV-PDF einfügen -> Heuristik erkennt OZ/Kurztext/Menge/Flags

const ZIELFELDER = [
  { key: 'oz', label: 'OZ / Positionsnummer' },
  { key: 'kurztext', label: 'Kurztext' },
  { key: 'langtext', label: 'Langtext' },
  { key: 'menge', label: 'Menge' },
  { key: 'einheit', label: 'Einheit (ME)' },
  { key: 'einheitspreis', label: 'Einheitspreis (EP)' },
]

// Auto-Erkennung: langtext VOR kurztext prüfen, damit „Langtext" nicht als Kurztext landet
const ERKENNUNG = [
  ['oz', /^(oz|pos)/i],
  ['langtext', /lang|beschreib/i],
  ['kurztext', /kurz|text|bezeich/i],
  ['menge', /menge/i],
  ['einheit', /^(me|einheit)$/i],
  ['einheitspreis', /preis|ep/i],
]

const LEERES_MAPPING = { oz: '', kurztext: '', langtext: '', menge: '', einheit: '', einheitspreis: '' }

function autoMapping(kopf) {
  const map = { ...LEERES_MAPPING }
  const belegt = new Set()
  for (const [key, re] of ERKENNUNG) {
    const idx = kopf.findIndex((h, i) => !belegt.has(i) && re.test((h || '').trim()))
    if (idx >= 0) {
      map[key] = String(idx)
      belegt.add(idx)
    }
  }
  return map
}

// Neue LV-Position in kanonischer Form
function neuePosition(projektId, felder, sort) {
  return {
    projektId,
    oz: felder.oz,
    typ: felder.typ || 'position',
    kurztext: felder.kurztext || '',
    langtext: felder.langtext || '',
    menge: felder.menge || 0,
    einheit: felder.einheit || '',
    einheitspreis: felder.einheitspreis || 0,
    flags: felder.flags || {},
    istMenge: 0,
    istVon: '',
    istAm: '',
    abgerechnetMenge: 0,
    sort,
  }
}

export default function LvImport({ projektId, onClose }) {
  const vorhandene = useWhere('lvpositionen', 'projektId', projektId)
  const maxSort = vorhandene.reduce((m, p) => Math.max(m, p.sort || 0), 0)

  const [tab, setTab] = useState('csv')
  const [laeuft, setLaeuft] = useState(false)
  const [ergebnis, setErgebnis] = useState(null) // { importiert, uebersprungen }

  // --- Tab 1: CSV ---
  const [csvZeilen, setCsvZeilen] = useState(null) // [ [kopf], [daten...] ]
  const [mapping, setMapping] = useState({ ...LEERES_MAPPING })

  async function dateiGewaehlt(e) {
    const datei = e.target.files?.[0]
    if (!datei) return
    const text = await datei.text()
    const zeilen = parseCSV(text)
    setCsvZeilen(zeilen)
    setMapping(autoMapping(zeilen[0] || []))
    setErgebnis(null)
  }

  function csvFeld(zeile, key) {
    if (mapping[key] === '') return ''
    return (zeile[Number(mapping[key])] || '').trim()
  }

  async function importiereCsv() {
    if (!csvZeilen || laeuft) return
    setLaeuft(true)
    let sort = maxSort + 1
    let importiert = 0
    let uebersprungen = 0
    await withStore(async (s) => {
      for (const zeile of csvZeilen.slice(1)) {
        const oz = csvFeld(zeile, 'oz')
        // Zeilen ohne Ziffern in der OZ überspringen (Leer-/Überschriftszeilen)
        if (!/\d/.test(oz)) {
          uebersprungen++
          continue
        }
        await s.add('lvpositionen', neuePosition(projektId, {
          oz,
          typ: 'position',
          kurztext: csvFeld(zeile, 'kurztext'),
          langtext: csvFeld(zeile, 'langtext'),
          menge: parseZahl(csvFeld(zeile, 'menge')),
          einheit: csvFeld(zeile, 'einheit'),
          einheitspreis: parseZahl(csvFeld(zeile, 'einheitspreis')),
        }, sort++))
        importiert++
      }
    })
    setLaeuft(false)
    setCsvZeilen(null)
    setErgebnis({ importiert, uebersprungen })
  }

  // --- Tab 2: PDF-Text ---
  const [pdfText, setPdfText] = useState('')
  const [vorschau, setVorschau] = useState(null) // editierbare Zeilen

  function analysieren() {
    const ozRe = /^\s*(\d+(?:\.\d+)*(?:\.\.\d+)?)\b/
    const mengeRe = /([\d.,]+)\s*(m²|m2|lfm|Stck\.?|Stück|Std\.?|psch|Pauschale)/
    const eintraege = []
    let akt = null

    const pruefeZeile = (eintrag, zeile) => {
      if (zeile.includes('(Bedarfspos')) eintrag.flags.bedarf = true
      if (/\bNEP\b/.test(zeile)) eintrag.flags.nep = true
      if (!eintrag.menge) {
        const m = zeile.match(mengeRe)
        if (m) {
          eintrag.menge = parseZahl(m[1])
          eintrag.einheit = m[2] === 'm2' ? 'm²' : m[2]
        }
      }
    }

    for (const roh of pdfText.split(/\r?\n/)) {
      if (!roh.trim()) continue
      const m = roh.match(ozRe)
      if (m) {
        // Neue OZ -> neuer Eintrag, Rest der Zeile = Kurztext-Anfang
        if (akt) eintraege.push(akt)
        akt = { oz: m[1], kurztext: roh.slice(m[0].length).trim(), langtextZeilen: [], menge: 0, einheit: '', flags: {} }
        pruefeZeile(akt, roh)
      } else if (akt) {
        pruefeZeile(akt, roh)
        akt.langtextZeilen.push(roh.trim())
      }
    }
    if (akt) eintraege.push(akt)

    setVorschau(eintraege.map((e) => ({
      oz: e.oz,
      // Ohne Menge und ohne weitere Zeilen -> vermutlich eine Titelzeile
      typ: e.menge === 0 && e.langtextZeilen.length === 0 ? 'titel' : 'position',
      kurztext: e.kurztext,
      langtext: e.langtextZeilen.join('\n'),
      mengeText: e.menge ? String(e.menge).replace('.', ',') : '',
      einheit: e.einheit,
      epText: '',
      flags: e.flags,
    })))
    setErgebnis(null)
  }

  function vorschauAendern(i, patch) {
    setVorschau(vorschau.map((z, idx) => (idx === i ? { ...z, ...patch } : z)))
  }

  async function uebernehmen() {
    if (!vorschau || laeuft) return
    setLaeuft(true)
    let sort = maxSort + 1
    let importiert = 0
    await withStore(async (s) => {
      for (const z of vorschau) {
        await s.add('lvpositionen', neuePosition(projektId, {
          oz: z.oz,
          typ: z.typ,
          kurztext: z.kurztext,
          langtext: z.langtext,
          menge: parseZahl(z.mengeText),
          einheit: z.einheit,
          einheitspreis: parseZahl(z.epText),
          flags: z.flags,
        }, sort++))
        importiert++
      }
    })
    setLaeuft(false)
    setVorschau(null)
    setPdfText('')
    setErgebnis({ importiert, uebersprungen: 0 })
  }

  const feldKlein = 'w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-praxis-500'

  return (
    <Modal titel="LV importieren" onClose={onClose} breite="max-w-3xl">
      {/* Tab-Umschalter */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 text-xs font-bold w-fit mb-4">
        {[['csv', 'CSV-Datei'], ['pdf', 'Aus PDF einfügen']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-full ${tab === id ? 'bg-praxis-600 text-white' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {ergebnis && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-semibold">
          <span>
            <Icon name="check" className="w-4 h-4 inline mr-1.5" />
            {ergebnis.importiert} Positionen importiert{ergebnis.uebersprungen > 0 ? `, ${ergebnis.uebersprungen} Zeilen übersprungen` : ''}.
          </span>
          <button onClick={onClose} className="text-xs font-bold text-emerald-700 hover:underline shrink-0">Schließen</button>
        </div>
      )}

      {/* ---------- Tab 1: CSV ---------- */}
      {tab === 'csv' && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">CSV-Datei wählen (Trennzeichen ; , oder Tab)</span>
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              onChange={dateiGewaehlt}
              className="mt-1.5 block w-full text-sm text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-praxis-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-praxis-700 hover:file:bg-praxis-100"
            />
          </label>

          {csvZeilen && csvZeilen.length > 1 && (
            <>
              {/* Spalten-Mapping */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Spalten zuordnen</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ZIELFELDER.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-[11px] font-semibold text-slate-500">{f.label}</span>
                      <select
                        value={mapping[f.key]}
                        onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-praxis-500"
                      >
                        <option value="">– nicht zugeordnet –</option>
                        {csvZeilen[0].map((h, i) => (
                          <option key={i} value={String(i)}>{h?.trim() || `Spalte ${i + 1}`}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {/* Vorschau erste 5 Zeilen */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Vorschau ({Math.min(5, csvZeilen.length - 1)} von {csvZeilen.length - 1} Zeilen)
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        {csvZeilen[0].map((h, i) => (
                          <th key={i} className="px-3 py-2 font-bold text-slate-500 whitespace-nowrap">{h?.trim() || `Spalte ${i + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvZeilen.slice(1, 6).map((zeile, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          {csvZeilen[0].map((_, j) => (
                            <td key={j} className="px-3 py-1.5 text-slate-600 whitespace-nowrap max-w-56 truncate">{zeile[j] || ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                onClick={importiereCsv}
                disabled={laeuft || mapping.oz === ''}
                className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl"
              >
                {laeuft ? 'Importiere …' : `${csvZeilen.length - 1} Zeilen importieren`}
              </button>
              {mapping.oz === '' && (
                <p className="text-xs text-red-600">Bitte zuerst die OZ-Spalte zuordnen.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------- Tab 2: PDF-Text ---------- */}
      {tab === 'pdf' && (
        <div className="space-y-4">
          {!vorschau && (
            <>
              <textarea
                value={pdfText}
                onChange={(e) => setPdfText(e.target.value)}
                rows={12}
                placeholder={'Text aus dem LV-PDF hier einfügen …\n\nBeispiel:\n4.2.3.7.1.1 Flächen vorbereiten und grundieren\nTiefengrundierung liefern und auftragen …\n2.582,421 m²'}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-praxis-500"
              />
              <button
                onClick={analysieren}
                disabled={!pdfText.trim()}
                className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl"
              >
                Analysieren
              </button>
            </>
          )}

          {vorschau && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">{vorschau.length} Einträge erkannt – vor der Übernahme prüfen und korrigieren</p>
                <button onClick={() => setVorschau(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Zurück zum Text</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs min-w-[560px]">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-2 py-2 font-bold text-slate-500 w-24">OZ</th>
                      <th className="px-2 py-2 font-bold text-slate-500 w-20">Typ</th>
                      <th className="px-2 py-2 font-bold text-slate-500">Kurztext</th>
                      <th className="px-2 py-2 font-bold text-slate-500 w-20">Menge</th>
                      <th className="px-2 py-2 font-bold text-slate-500 w-16">ME</th>
                      <th className="px-2 py-2 font-bold text-slate-500 w-20">EP (€)</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vorschau.map((z, i) => (
                      <tr key={i} className={`border-t border-slate-100 align-top ${z.typ === 'titel' ? 'bg-slate-50' : ''}`}>
                        <td className="px-2 py-1.5 font-mono text-slate-500 whitespace-nowrap">{z.oz}</td>
                        <td className="px-2 py-1.5">
                          <select value={z.typ} onChange={(e) => vorschauAendern(i, { typ: e.target.value })} className={feldKlein}>
                            <option value="position">Position</option>
                            <option value="titel">Titel</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={z.kurztext} onChange={(e) => vorschauAendern(i, { kurztext: e.target.value })} className={feldKlein} />
                          {(z.flags?.bedarf || z.flags?.nep) && (
                            <p className="mt-1 flex gap-1">
                              {z.flags?.bedarf && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">Bedarf</span>}
                              {z.flags?.nep && <span className="text-[10px] font-bold bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">NEP</span>}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {z.typ === 'position' && (
                            <input value={z.mengeText} onChange={(e) => vorschauAendern(i, { mengeText: e.target.value })} placeholder="0,00" className={`${feldKlein} text-right`} />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {z.typ === 'position' && (
                            <input value={z.einheit} onChange={(e) => vorschauAendern(i, { einheit: e.target.value })} placeholder="ME" className={feldKlein} />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {z.typ === 'position' && (
                            <input value={z.epText} onChange={(e) => vorschauAendern(i, { epText: e.target.value })} placeholder="0,00" className={`${feldKlein} text-right`} />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => setVorschau(vorschau.filter((_, idx) => idx !== i))}
                            className="text-slate-300 hover:text-red-500"
                            title="Zeile entfernen"
                          >
                            <Icon name="x" className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Zahlen im deutschen Format (z. B. 2.582,421) werden automatisch umgerechnet. Summe der erfassten EP: {euro(vorschau.reduce((s, z) => s + parseZahl(z.mengeText) * parseZahl(z.epText), 0))}
                </p>
                <button
                  onClick={uebernehmen}
                  disabled={laeuft || vorschau.length === 0}
                  className="shrink-0 bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl"
                >
                  {laeuft ? 'Übernehme …' : 'Übernehmen'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
