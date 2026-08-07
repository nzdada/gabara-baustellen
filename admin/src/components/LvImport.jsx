import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { useWhere, withStore } from '../hooks.js'
import { parseCSV, parseZahl, parseZahlPruef } from '../csv.js'
import { analysiereLvText, markiereTitel } from '../lvparser.js'
import { euro } from '@shared/format.js'
import { Icon } from '@shared/ui.jsx'
import InfoHinweis, { FeldLabel } from './InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'
import { useLang, t } from '@shared/i18n.js'

// LV-Import in zwei Wegen:
//  1. CSV-Datei mit Spalten-Mapping (Auto-Erkennung über die Kopfzeile)
//  2. Text aus dem LV-PDF einfügen -> Heuristik in ../lvparser.js
// Beide Wege enden in derselben Vorschau-Tabelle: erst prüfen/korrigieren,
// dann in EINEM Schreibvorgang übernehmen (store.addMany).

const ZIELFELDER = [
  { key: 'oz', schluessel: 'lvImp.spalteOz' },
  { key: 'kurztext', schluessel: 'lv.kurztext' },
  { key: 'langtext', schluessel: 'lv.langtext' },
  { key: 'menge', schluessel: 'allg.menge' },
  { key: 'einheit', schluessel: 'lv.spalteEinheit' },
  { key: 'einheitspreis', schluessel: 'lv.spalteEp' },
  { key: 'typ', schluessel: 'lvImp.spalteTyp' },
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
  useLang()
  const vorhandene = useWhere('lvpositionen', 'projektId', projektId)
  const maxSort = vorhandene.reduce((m, p) => Math.max(m, p.sort || 0), 0)

  const [tab, setTab] = useState('csv')
  const [laeuft, setLaeuft] = useState(false)
  const [ergebnis, setErgebnis] = useState(null)
  // Was beim Einlesen NICHT sauber war – wird über der Vorschau angezeigt,
  // statt still 0-Werte in die Abrechnung zu tragen.
  const [pruefung, setPruefung] = useState(null)   // { importiert, uebersprungen, ersetzt }
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
    const unlesbar = []      // Zahl stand da, war aber nicht auswertbar
    let uebersprungen = 0    // Zeile ohne OZ und ohne Kurztext
    for (const [nr, zeile] of csvZeilen.slice(1).entries()) {
      const oz = csvFeld(zeile, 'oz')
      const kurztext = csvFeld(zeile, 'kurztext')
      // Nur echte Leerzeilen überspringen – eine OZ wie „A" mit Text ist gültig
      if (!oz && !kurztext) {
        if (zeile.some((z) => String(z || '').trim())) uebersprungen++
        continue
      }
      const typRoh = csvFeld(zeile, 'typ').toLowerCase()
      const m = parseZahlPruef(csvFeld(zeile, 'menge'))
      const ep = parseZahlPruef(csvFeld(zeile, 'einheitspreis'))
      // +2: Kopfzeile plus 1-basierte Zählung wie in Excel
      if (!m.ok) unlesbar.push({ zeile: nr + 2, feld: t('allg.menge'), wert: csvFeld(zeile, 'menge') })
      if (!ep.ok) unlesbar.push({ zeile: nr + 2, feld: t('lv.ep'), wert: csvFeld(zeile, 'einheitspreis') })
      roh.push({
        oz: oz || kurztext.slice(0, 12),
        kurztext,
        langtext: csvFeld(zeile, 'langtext'),
        menge: m.wert,
        einheit: csvFeld(zeile, 'einheit'),
        einheitspreis: ep.wert,
        typVorgabe: /titel|überschrift|uberschrift|gruppe|los/.test(typRoh) ? 'titel'
          : /pos/.test(typRoh) ? 'position' : '',
        flags: {},
      })
    }
    setPruefung({ unlesbar, uebersprungen, ignoriert: [] })
    // markiereTitel erwartet dieselbe Struktur wie der PDF-Parser
    const zeilenMitTyp = markiereTitel(roh).map((z, i) => (
      roh[i].typVorgabe ? { ...z, typ: roh[i].typVorgabe } : z
    ))
    setVorschau(zeilenMitTyp)
    setQuelle(t('lvImp.quelleCsv', { n: zeilenMitTyp.length }))
    setErgebnis(null)
  }

  // --- Tab 2: PDF-Text ---
  const [pdfText, setPdfText] = useState('')

  function pdfAnalysieren() {
    const { eintraege, ignoriert } = analysiereLvText(pdfText)
    setVorschau(eintraege)
    setQuelle(t('lvImp.quellePdf', { n: eintraege.length }))
    setPruefung({ unlesbar: [], uebersprungen: 0, ignoriert })
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
  // Nicht nur ZÄHLEN, sondern die Positionsnummern nennen. Bei 200 Zeilen ist
  // "3 Positionen ohne Menge" wertlos - man findet sie nicht wieder.
  const ohnePreisOz = useMemo(
    () => (vorschau || []).filter((z) => z.typ === 'position' && parseZahl(z.epText) === 0).map((z) => z.oz || '?'),
    [vorschau]
  )
  const ohneMengeOz = useMemo(
    () => (vorschau || []).filter((z) => z.typ === 'position' && parseZahl(z.mengeText) === 0).map((z) => z.oz || '?'),
    [vorschau]
  )
  const ohnePreis = ohnePreisOz.length
  const ohneMenge = ohneMengeOz.length
  // Mehr als acht Nummern sprengen die Zeile - dann nur noch anzählen
  const ozListe = (liste) => (liste.length > 8
    ? `${liste.slice(0, 8).join(', ')} ${t('lvImp.undWeitere', { n: liste.length - 8 })}`
    : liste.join(', '))

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
      setErgebnis({ fehler: e.message || t('lv.importFehler') })
    } finally {
      setLaeuft(false)
    }
  }

  const feldKlein = 'w-full rounded-feld border border-rahmen px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-praxis-500'

  return (
    <Modal titel={t('lv.importTitel')} onClose={onClose} breite="max-w-4xl">
      {!vorschau && (
        <div className="flex items-center gap-1 bg-gedeckt-tief rounded-full p-1 text-xs font-bold w-fit mb-4">
          {[['csv', t('lv.ausCsv')], ['pdf', t('lv.ausPdf')]].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); setErgebnis(null) }}
              className={`px-4 py-2 rounded-full ${tab === id ? 'bg-praxis-600 text-white' : 'text-schrift-leise'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {ergebnis?.fehler && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-feld px-4 py-3 text-sm font-semibold">
          {ergebnis.fehler}
        </div>
      )}
      {ergebnis && !ergebnis.fehler && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-feld px-4 py-3 text-sm font-semibold">
          <span>
            <Icon name="check" className="w-4 h-4 inline mr-1.5" />
            {t('lvImp.importiert', { n: ergebnis.importiert })}
            {ergebnis.ersetzt > 0 ? t('lvImp.ersetztAnhang', { n: ergebnis.ersetzt }) : '.'}
          </span>
          <button onClick={onClose} className="text-xs font-bold text-emerald-700 hover:underline shrink-0">{t('allg.schliessen')}</button>
        </div>
      )}

      {/* ---------- Tab 1: CSV ---------- */}
      {!vorschau && tab === 'csv' && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('lv.csvWaehlen')}</span>
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              onChange={dateiGewaehlt}
              className="mt-1.5 block w-full text-sm text-schrift-leise file:mr-3 file:rounded-full file:border-0 file:bg-praxis-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-praxis-700 hover:file:bg-praxis-100"
            />
          </label>

          {csvZeilen && csvZeilen.length > 1 && (
            <>
              <div>
                <p className="text-sm font-medium text-schrift mb-2">{t('lv.spaltenZuordnen')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {ZIELFELDER.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-[12px] font-semibold text-schrift-leise">
                        <FeldLabel info={f.key === 'einheitspreis' ? HINWEIS.importEp : f.key === 'typ' ? HINWEIS.importTyp : ''}>{t(f.schluessel)}</FeldLabel>
                      </span>
                      <select
                        value={mapping[f.key]}
                        onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                        className="mt-1 w-full rounded-feld border border-rahmen bg-karte px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-praxis-500"
                      >
                        <option value="">{t('lv.nichtZugeordnet')}</option>
                        {csvZeilen[0].map((h, i) => (
                          <option key={i} value={String(i)}>{h?.trim() || t('lvImp.spalteNr', { n: i + 1 })}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-schrift mb-2">
                  Datei-Vorschau ({Math.min(5, csvZeilen.length - 1)} von {csvZeilen.length - 1} Zeilen)
                </p>
                <div className="overflow-x-auto rounded-feld border border-rahmen">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gedeckt text-left">
                        {csvZeilen[0].map((h, i) => (
                          <th key={i} className="px-3 py-2 font-bold text-schrift-leise whitespace-nowrap">{h?.trim() || `Spalte ${i + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvZeilen.slice(1, 6).map((zeile, i) => (
                        <tr key={i} className="border-t border-rahmen">
                          {csvZeilen[0].map((_, j) => (
                            <td key={j} className="px-3 py-1.5 text-schrift whitespace-nowrap max-w-56 truncate">{zeile[j] || ''}</td>
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
                className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold py-3 rounded-feld"
              >
                {t('lvImp.zeilenPruefen', { n: csvZeilen.length - 1 })}
              </button>
              {mapping.oz === '' && mapping.kurztext === '' && (
                <p className="text-xs text-red-600">{t('lv.spaltenFehler')}</p>
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
            placeholder={`${t('lv.pdfPlatz')}\n\n4.2.3.7.1.1 …\n2.582,421 m²        1,25        3.228,03`}
            className="w-full rounded-feld border border-rahmen px-4 py-3 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-praxis-500"
          />
          <p className="text-xs text-schrift-zart">
            {t('lvImp.pdfHinweis')}
          </p>
          <button
            onClick={pdfAnalysieren}
            disabled={!pdfText.trim()}
            className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold py-3 rounded-feld"
          >
            {t('lvImp.analysieren')}
          </button>
        </div>
      )}

      {/* ---------- Gemeinsame Vorschau + Übernahme ---------- */}
      {vorschau && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-schrift">
              {quelle} – {t('lvImp.vorschauHinweis')}
            </p>
            <button onClick={() => { setVorschau(null); setPruefung(null) }} className="text-xs font-semibold text-schrift-leise hover:text-schrift-stark">
              ← {t('allg.zurueck')}
            </button>
          </div>

          {pruefung && (pruefung.unlesbar.length > 0 || pruefung.uebersprungen > 0 || pruefung.ignoriert.length > 0) && (
            <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-feld px-3 py-2.5 space-y-1.5">
              <p className="font-bold">{t('lvImp.pruefungTitel')}</p>
              {pruefung.unlesbar.length > 0 && (
                <div>
                  <p>{t('lvImp.unlesbar', { n: pruefung.unlesbar.length })}</p>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    {pruefung.unlesbar.slice(0, 8).map((u, i) => (
                      <li key={i}>{t('lvImp.unlesbarZeile', { zeile: u.zeile, feld: u.feld, wert: u.wert })}</li>
                    ))}
                    {pruefung.unlesbar.length > 8 && <li>{t('lvImp.weitere', { n: pruefung.unlesbar.length - 8 })}</li>}
                  </ul>
                </div>
              )}
              {pruefung.uebersprungen > 0 && <p>{t('lvImp.uebersprungen', { n: pruefung.uebersprungen })}</p>}
              {pruefung.ignoriert.length > 0 && (
                <div>
                  <p>{t('lvImp.ignoriert', { n: pruefung.ignoriert.length })}</p>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5 font-mono text-[11px]">
                    {pruefung.ignoriert.slice(0, 5).map((z, i) => <li key={i} className="truncate">{z}</li>)}
                    {pruefung.ignoriert.length > 5 && <li>{t('lvImp.weitere', { n: pruefung.ignoriert.length - 5 })}</li>}
                  </ul>
                </div>
              )}
              <p className="text-red-700">{t('lvImp.pruefungHinweis')}</p>
            </div>
          )}

          {(ohneMenge > 0 || ohnePreis > 0) && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-feld px-3 py-2">
              {ohneMenge > 0 && (
                <span className="block">
                  {t('lvImp.ohneMenge', { n: ohneMenge })} <span className="font-mono">{ozListe(ohneMengeOz)}</span>
                </span>
              )}
              {ohnePreis > 0 && (
                <span className="block">
                  {t('lvImp.ohnePreis', { n: ohnePreis })} <span className="font-mono">{ozListe(ohnePreisOz)}</span>
                </span>
              )}
              <span className="block mt-1">{t('lvImp.ergaenzen')}</span>
            </p>
          )}

          <div className="overflow-x-auto rounded-feld border border-rahmen max-h-[46vh] overflow-y-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gedeckt text-left">
                  <th className="px-2 py-2 font-bold text-schrift-leise w-28">{t('lv.oz')}</th>
                  <th className="px-2 py-2 font-bold text-schrift-leise w-24">{t('lv.typ')}</th>
                  <th className="px-2 py-2 font-bold text-schrift-leise">{t('lv.kurztext')}</th>
                  <th className="px-2 py-2 font-bold text-schrift-leise w-24">{t('allg.menge')}</th>
                  <th className="px-2 py-2 font-bold text-schrift-leise w-20">{t('lv.me')}</th>
                  <th className="px-2 py-2 font-bold text-schrift-leise w-24">{t('lv.ep')}</th>
                  <th className="px-2 py-2 font-bold text-schrift-leise w-24 text-right">{t('lv.gesamt')}</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {vorschau.map((z, i) => (
                  <tr key={i} className={`border-t border-rahmen align-top ${z.typ === 'titel' ? 'bg-gedeckt' : ''}`}>
                    <td className="px-2 py-1.5">
                      <input value={z.oz} onChange={(e) => vorschauAendern(i, { oz: e.target.value })} className={`${feldKlein} font-mono`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={z.typ} onChange={(e) => vorschauAendern(i, { typ: e.target.value })} className={feldKlein}>
                        <option value="position">{t('lv.position')}</option>
                        <option value="titel">{t('lv.titel')}</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={z.kurztext} onChange={(e) => vorschauAendern(i, { kurztext: e.target.value })} className={feldKlein} />
                      <div className="mt-1 flex flex-wrap gap-1">
                        {z.flags?.bedarf && <span className="text-[11px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{t('lv.bedarf')}</span>}
                        {z.flags?.nep && <span className="text-[11px] font-bold bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">NEP</span>}
                        {z.langtext && (
                          <span className="text-[11px] text-schrift-zart truncate max-w-[24rem]" title={z.langtext}>
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
                        <input value={z.einheit} onChange={(e) => vorschauAendern(i, { einheit: e.target.value })} placeholder={t('lv.me')} className={feldKlein} />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {z.typ === 'position' && (
                        <input value={z.epText} onChange={(e) => vorschauAendern(i, { epText: e.target.value })} placeholder="0,00" className={`${feldKlein} text-right`} />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap font-semibold text-schrift">
                      {z.typ === 'position' ? euro(parseZahl(z.mengeText) * parseZahl(z.epText)) : ''}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => setVorschau(vorschau.filter((_, idx) => idx !== i))}
                        className="text-schrift-zart hover:text-red-500"
                        title={t('lv.zeileEntfernen')}
                      >
                        <Icon name="x" className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="flex items-center gap-2 text-sm text-schrift">
            <input type="checkbox" checked={ersetzen} onChange={(e) => setErsetzen(e.target.checked)} className="w-4 h-4" />
            {t('lvImp.vorherLoeschen')}
            {vorhandene.length > 0 && <span className="text-schrift-zart">{t('lvImp.vorhanden', { n: vorhandene.length })}</span>}
            <InfoHinweis text={HINWEIS.importErsetzen} />
          </label>
          {ersetzen && vorhandene.length > 0 && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-feld px-3 py-2">
              {t('lvImp.ersetzenWarnung')}
              {vorhandene.filter((p) => (p.abgerechnetMenge || 0) > 0).length > 0
                ? ` ${t('lvImp.bereitsAbgerechnet', { n: vorhandene.filter((p) => (p.abgerechnetMenge || 0) > 0).length })}`
                : ''}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-schrift-leise">
              {t('lvImp.zahlenHinweis')}<br />
              {t('lv.summe')}: <strong className="text-schrift-stark">{euro(summe)}</strong>
            </p>
            <button
              onClick={uebernehmen}
              disabled={laeuft || vorschau.length === 0}
              className="shrink-0 bg-praxis-600 hover:bg-praxis-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-feld"
            >
              {laeuft ? t('lv.uebernimmt') : t('lvImp.zeilenUebernehmen', { n: vorschau.length })}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
