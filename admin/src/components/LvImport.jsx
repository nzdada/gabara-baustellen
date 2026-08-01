import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { useWhere, withStore } from '../hooks.js'
import { parseCSV, parseZahl } from '../csv.js'
import { analysiereLvText, markiereTitel } from '../lvparser.js'
import { euro } from '@shared/format.js'
import { Icon } from '@shared/ui.jsx'
import InfoHinweis, { FeldLabel } from './InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'

// LV-Import in zwei Wegen:
//  1. CSV-Datei mit Spalten-Mapping (Auto-Erkennung über die Kopfzeile)
//  2. Text aus dem LV-PDF einfügen -> Heuristik in ../lvparser.js
// Beide Wege enden in derselben Vorschau-Tabelle: erst prüfen/korrigieren,
// dann in EINEM Schreibvorgang übernehmen (store.addMany).

const ZIELFELDER = [
  { key: 'oz', label: 'OZ / Positionsnummer' },
  { key: 'kurztext', label: 'Kurztext' },
  { key: 'langtext', label: 'Langtext' },
  { key: 'menge', label: 'Menge' },
  { key: 'einheit', label: 'Einheit (ME)' },
  { key: 'einheitspreis', label: 'Einheitspreis (EP)' },
  { key: 'typ', label: 'Typ (Titel/Position)' },
]

// Auto-Erkennung: spezifische Muster VOR den allgemeinen prüfen
const ERKENNUNG = [
  ['oz', /^(oz|pos|position(s)?(nr|nummer)?|nr\.?)$/i],
  ['einheitspreis', /(einheits?preis|^ep$|preis\s*\/|e-?preis)/i],
  ['langtext', /(lang|beschreib|detail)/i],
  ['einheit', /^(me|einheit|mengeneinheit|einh\.?)$/i],
  ['menge', /(menge|anzahl|masse)/i],
  ['typ', /^(typ|art|zeilenart|ebene)$/i],
  ['kurztext', /(kurz|bezeich|titel|text|leistung)/i],
  ['oz', /^(oz|pos)/i],
  ['einheitspreis', /(preis|ep)/i],
]

const LEERES_MAPPING = { oz: '', kurztext: '', langtext: '', menge: '', einheit: '', einheitspreis: '', typ: '' }

function autoMapping(kopf) {
  const map = { ...LEERES_MAPPING }
  const belegt = new Set()
  for (const [key, re] of ERKENNUNG) {
    if (map[key] !== '') continue
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
  const [ergebnis, setErgebnis] = useState(null)   // { importiert, uebersprungen, ersetzt }
  const [ersetzen, setErsetzen] = useState(false)  // vorhandene Positionen vorher löschen
  const [vorschau, setVorschau] = useState(null)   // editierbare Zeilen (beide Wege)
  const [quelle, setQuelle] = useState('')         // Text für die Anzeige der Herkunft

  // --- Tab 1: CSV ---
  const [csvZeilen, setCsvZeilen] = useState(null)
  const [mapping, setMapping] = useState({ ...LEERES_MAPPING })

  async function dateiGewaehlt(e) {
    const datei = e.target.files?.[0]
    if (!datei) return
    const text = await datei.text()
    const zeilen = parseCSV(text)
    setCsvZeilen(zeilen)
    setMapping(autoMapping(zeilen[0] || []))
    setErgebnis(null)
    setVorschau(null)
  }

  function csvFeld(zeile, key) {
    if (mapping[key] === '') return ''
    return (zeile[Number(mapping[key])] || '').trim()
  }

  // CSV -> Vorschau (statt Blind-Import): Titel/Position wird mit erkannt
  function csvAnalysieren() {
    if (!csvZeilen) return
    const roh = []
    for (const zeile of csvZeilen.slice(1)) {
      const oz = csvFeld(zeile, 'oz')
      const kurztext = csvFeld(zeile, 'kurztext')
      // Nur echte Leerzeilen überspringen – eine OZ wie „A" mit Text ist gültig
      if (!oz && !kurztext) continue
      const typRoh = csvFeld(zeile, 'typ').toLowerCase()
      roh.push({
        oz: oz || kurztext.slice(0, 12),
        kurztext,
        langtext: csvFeld(zeile, 'langtext'),
        menge: parseZahl(csvFeld(zeile, 'menge')),
        einheit: csvFeld(zeile, 'einheit'),
        einheitspreis: parseZahl(csvFeld(zeile, 'einheitspreis')),
        typVorgabe: /titel|überschrift|uberschrift|gruppe|los/.test(typRoh) ? 'titel'
          : /pos/.test(typRoh) ? 'position' : '',
        flags: {},
      })
    }
    // markiereTitel erwartet dieselbe Struktur wie der PDF-Parser
    const zeilenMitTyp = markiereTitel(roh).map((z, i) => (
      roh[i].typVorgabe ? { ...z, typ: roh[i].typVorgabe } : z
    ))
    setVorschau(zeilenMitTyp)
    setQuelle(`CSV · ${zeilenMitTyp.length} Zeilen`)
    setErgebnis(null)
  }

  // --- Tab 2: PDF-Text ---
  const [pdfText, setPdfText] = useState('')

  function pdfAnalysieren() {
    const erkannt = analysiereLvText(pdfText)
    setVorschau(erkannt)
    setQuelle(`PDF-Text · ${erkannt.length} Einträge`)
    setErgebnis(null)
  }

  function vorschauAendern(i, patch) {
    setVorschau(vorschau.map((z, idx) => (idx === i ? { ...z, ...patch } : z)))
  }

  const summe = useMemo(
    () => (vorschau || [])
      .filter((z) => z.typ === 'position' && !z.flags?.bedarf && !z.flags?.nep)
      .reduce((s, z) => s + parseZahl(z.mengeText) * parseZahl(z.epText), 0),
    [vorschau]
  )
  const ohnePreis = useMemo(
    () => (vorschau || []).filter((z) => z.typ === 'position' && parseZahl(z.epText) === 0).length,
    [vorschau]
  )
  const ohneMenge = useMemo(
    () => (vorschau || []).filter((z) => z.typ === 'position' && parseZahl(z.mengeText) === 0).length,
    [vorschau]
  )

  async function uebernehmen() {
    if (!vorschau || laeuft) return
    setLaeuft(true)
    let sort = ersetzen ? 1 : maxSort + 1
    const neue = vorschau.map((z) => neuePosition(projektId, {
      oz: z.oz,
      typ: z.typ,
      kurztext: z.kurztext,
      langtext: z.langtext,
      menge: parseZahl(z.mengeText),
      einheit: z.einheit,
      einheitspreis: parseZahl(z.epText),
      flags: z.flags,
    }, sort++))

    let ersetzt = 0
    try {
      await withStore(async (s) => {
        if (ersetzen && vorhandene.length) {
          const ids = vorhandene.map((p) => p.id)
          ersetzt = ids.length
          if (s.removeMany) await s.removeMany('lvpositionen', ids)
          else for (const id of ids) await s.remove('lvpositionen', id)
        }
        // EIN Schreibvorgang statt einer Runde je Zeile
        if (s.addMany) await s.addMany('lvpositionen', neue)
        else for (const p of neue) await s.add('lvpositionen', p)
      })
      setVorschau(null)
      setCsvZeilen(null)
      setPdfText('')
      setErgebnis({ importiert: neue.length, uebersprungen: 0, ersetzt })
    } catch (e) {
      setErgebnis({ fehler: e.message || 'Import fehlgeschlagen.' })
    } finally {
      setLaeuft(false)
    }
  }

  const feldKlein = 'w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-praxis-500'

  return (
    <Modal titel="LV importieren" onClose={onClose} breite="max-w-4xl">
      {!vorschau && (
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 text-xs font-bold w-fit mb-4">
          {[['csv', 'CSV-Datei'], ['pdf', 'Aus PDF einfügen']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); setErgebnis(null) }}
              className={`px-4 py-2 rounded-full ${tab === id ? 'bg-praxis-600 text-white' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {ergebnis?.fehler && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-semibold">
          {ergebnis.fehler}
        </div>
      )}
      {ergebnis && !ergebnis.fehler && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-semibold">
          <span>
            <Icon name="check" className="w-4 h-4 inline mr-1.5" />
            {ergebnis.importiert} Zeilen importiert
            {ergebnis.ersetzt > 0 ? `, ${ergebnis.ersetzt} alte Positionen ersetzt` : ''}.
          </span>
          <button onClick={onClose} className="text-xs font-bold text-emerald-700 hover:underline shrink-0">Schließen</button>
        </div>
      )}

      {/* ---------- Tab 1: CSV ---------- */}
      {!vorschau && tab === 'csv' && (
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
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Spalten zuordnen</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {ZIELFELDER.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-[11px] font-semibold text-slate-500">
                        <FeldLabel info={f.key === 'einheitspreis' ? HINWEIS.importEp : f.key === 'typ' ? HINWEIS.importTyp : ''}>{f.label}</FeldLabel>
                      </span>
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

              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Datei-Vorschau ({Math.min(5, csvZeilen.length - 1)} von {csvZeilen.length - 1} Zeilen)
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
                onClick={csvAnalysieren}
                disabled={mapping.oz === '' && mapping.kurztext === ''}
                className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl"
              >
                Zeilen prüfen ({csvZeilen.length - 1})
              </button>
              {mapping.oz === '' && mapping.kurztext === '' && (
                <p className="text-xs text-red-600">Bitte mindestens die OZ- oder die Kurztext-Spalte zuordnen.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------- Tab 2: PDF-Text ---------- */}
      {!vorschau && tab === 'pdf' && (
        <div className="space-y-4">
          <textarea
            value={pdfText}
            onChange={(e) => setPdfText(e.target.value)}
            rows={12}
            placeholder={'Text aus dem LV-PDF hier einfügen …\n\nBeispiel:\n4.2.3.7.1.1 Flächen vorbereiten und grundieren\nTiefengrundierung liefern und auftragen …\n2.582,421 m²        1,25        3.228,03'}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-praxis-500"
          />
          <p className="text-xs text-slate-400">
            Erkannt werden OZ, Kurztext, Langtext sowie Menge/ME/EP (auch aus der Preiszeile darunter).
            Bedarfs- und NEP-Positionen werden automatisch markiert. Alles ist in der nächsten Ansicht korrigierbar.
          </p>
          <button
            onClick={pdfAnalysieren}
            disabled={!pdfText.trim()}
            className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl"
          >
            Analysieren
          </button>
        </div>
      )}

      {/* ---------- Gemeinsame Vorschau + Übernahme ---------- */}
      {vorschau && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">
              {quelle} – vor der Übernahme prüfen und korrigieren
            </p>
            <button onClick={() => setVorschau(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
              ← Zurück
            </button>
          </div>

          {(ohneMenge > 0 || ohnePreis > 0) && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Hinweis: {ohneMenge > 0 ? `${ohneMenge} Position(en) ohne Menge` : ''}
              {ohneMenge > 0 && ohnePreis > 0 ? ' · ' : ''}
              {ohnePreis > 0 ? `${ohnePreis} Position(en) ohne Einheitspreis` : ''} – bitte ergänzen oder als Titel markieren.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[46vh] overflow-y-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-left">
                  <th className="px-2 py-2 font-bold text-slate-500 w-28">OZ</th>
                  <th className="px-2 py-2 font-bold text-slate-500 w-24">Typ</th>
                  <th className="px-2 py-2 font-bold text-slate-500">Kurztext</th>
                  <th className="px-2 py-2 font-bold text-slate-500 w-24">Menge</th>
                  <th className="px-2 py-2 font-bold text-slate-500 w-20">ME</th>
                  <th className="px-2 py-2 font-bold text-slate-500 w-24">EP (€)</th>
                  <th className="px-2 py-2 font-bold text-slate-500 w-24 text-right">Gesamt</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {vorschau.map((z, i) => (
                  <tr key={i} className={`border-t border-slate-100 align-top ${z.typ === 'titel' ? 'bg-slate-50' : ''}`}>
                    <td className="px-2 py-1.5">
                      <input value={z.oz} onChange={(e) => vorschauAendern(i, { oz: e.target.value })} className={`${feldKlein} font-mono`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={z.typ} onChange={(e) => vorschauAendern(i, { typ: e.target.value })} className={feldKlein}>
                        <option value="position">Position</option>
                        <option value="titel">Titel</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={z.kurztext} onChange={(e) => vorschauAendern(i, { kurztext: e.target.value })} className={feldKlein} />
                      <div className="mt-1 flex flex-wrap gap-1">
                        {z.flags?.bedarf && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">Bedarf</span>}
                        {z.flags?.nep && <span className="text-[10px] font-bold bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">NEP</span>}
                        {z.langtext && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[24rem]" title={z.langtext}>
                            {z.langtext.split('\n')[0]}
                          </span>
                        )}
                      </div>
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
                    <td className="px-2 py-1.5 text-right whitespace-nowrap font-semibold text-slate-700">
                      {z.typ === 'position' ? euro(parseZahl(z.mengeText) * parseZahl(z.epText)) : ''}
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

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={ersetzen} onChange={(e) => setErsetzen(e.target.checked)} className="w-4 h-4" />
            Vorhandene LV-Positionen dieses Projekts vorher löschen
            {vorhandene.length > 0 && <span className="text-slate-400">({vorhandene.length} vorhanden)</span>}
            <InfoHinweis text={HINWEIS.importErsetzen} />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Deutsche Zahlen (2.582,421) werden automatisch umgerechnet.
              LV-Summe der Vorschau (ohne Bedarf/NEP): <strong className="text-slate-800">{euro(summe)}</strong>
            </p>
            <button
              onClick={uebernehmen}
              disabled={laeuft || vorschau.length === 0}
              className="shrink-0 bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl"
            >
              {laeuft ? 'Übernehme …' : `${vorschau.length} Zeilen übernehmen`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
