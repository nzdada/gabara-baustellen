import { useEffect, useMemo, useRef, useState } from 'react'
import { useWhere, withStore } from '../hooks.js'
import { euro } from '@shared/format.js'
import { Icon } from '@shared/ui.jsx'
import { FeldLabel } from './InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'

// Hierarchischer LV-Editor: eine Zeile je Position/Titel, Einrückung über die OZ.
// Inline-Edit nach dem SummaryEditor-Muster: lokaler Draft + 600 ms Debounce + Blur-Flush.

// Debounce-Eingabefeld für eine Tabellenzelle (NIE jeden Tastendruck in den Store schreiben)
function ZellenFeld({ wert, onWert, typ = 'text', className = '', platzhalter = '', fett = false }) {
  const [draft, setDraft] = useState(wert === undefined || wert === null ? '' : String(wert))
  const fokus = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    // Externe Änderungen (anderes Gerät) nur übernehmen, wenn hier nicht getippt wird
    if (!fokus.current) setDraft(wert === undefined || wert === null ? '' : String(wert))
  }, [wert])
  useEffect(() => () => clearTimeout(timer.current), [])

  function speichern(v) {
    onWert(typ === 'number' ? (Number(v) || 0) : v)
  }
  function aendern(v) {
    setDraft(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => speichern(v), 600)
  }

  return (
    <input
      type={typ}
      step={typ === 'number' ? '0.001' : undefined}
      value={draft}
      placeholder={platzhalter}
      onChange={(e) => aendern(e.target.value)}
      onFocus={() => { fokus.current = true }}
      onBlur={(e) => { fokus.current = false; clearTimeout(timer.current); speichern(e.target.value) }}
      className={`w-full bg-transparent rounded-lg border border-transparent hover:border-slate-200 focus:border-praxis-500 focus:bg-white px-2 py-1.5 focus:outline-none ${fett ? 'font-bold text-slate-900' : ''} ${className}`}
    />
  )
}

// Debounce-Textarea für den Langtext (aufklappbare Zeile)
function LangtextFeld({ wert, onWert }) {
  const [draft, setDraft] = useState(wert || '')
  const fokus = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!fokus.current) setDraft(wert || '')
  }, [wert])
  useEffect(() => () => clearTimeout(timer.current), [])

  function aendern(v) {
    setDraft(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onWert(v), 600)
  }

  return (
    <textarea
      value={draft}
      rows={3}
      placeholder="Langtext / Beschreibung der Position …"
      onChange={(e) => aendern(e.target.value)}
      onFocus={() => { fokus.current = true }}
      onBlur={(e) => { fokus.current = false; clearTimeout(timer.current); onWert(e.target.value) }}
      className="w-full text-xs text-slate-500 leading-relaxed rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-praxis-500"
    />
  )
}

export default function LvEditor({ projektId, kompakt = false }) {
  const roh = useWhere('lvpositionen', 'projektId', projektId)
  const positionen = useMemo(() => [...roh].sort((a, b) => (a.sort || 0) - (b.sort || 0)), [roh])
  const [offen, setOffen] = useState({}) // id -> true = Langtext aufgeklappt

  // Bedarfs-/NEP-Positionen zählen nicht in Summen
  const zaehltMit = (p) => p.typ === 'position' && !p.flags?.bedarf && !p.flags?.nep
  const gesamt = positionen.filter(zaehltMit).reduce((s, p) => s + (p.menge || 0) * (p.einheitspreis || 0), 0)

  function zwischensumme(titel) {
    return positionen
      .filter((p) => zaehltMit(p) && (p.oz || '').startsWith(titel.oz + '.'))
      .reduce((s, p) => s + (p.menge || 0) * (p.einheitspreis || 0), 0)
  }

  function patch(id, felder) {
    withStore((s) => s.update('lvpositionen', id, felder))
  }

  async function loeschen(p) {
    if (!confirm(`Zeile ${p.oz} „${p.kurztext || ''}" wirklich löschen?`)) return
    await withStore((s) => s.remove('lvpositionen', p.id))
  }

  // OZ-Vorschlag: letzte OZ, letztes Zahlensegment +1 (z. B. 4.1 -> 4.2)
  function naechsteOz() {
    const letzte = positionen[positionen.length - 1]
    if (!letzte?.oz) return '1'
    const teile = letzte.oz.split('.')
    for (let i = teile.length - 1; i >= 0; i--) {
      if (/^\d+$/.test(teile[i])) {
        teile[i] = String(Number(teile[i]) + 1)
        return teile.slice(0, i + 1).join('.')
      }
    }
    return '1'
  }

  async function neueZeile(typ) {
    const maxSort = positionen.reduce((m, p) => Math.max(m, p.sort || 0), 0)
    await withStore((s) => s.add('lvpositionen', {
      projektId,
      oz: naechsteOz(),
      typ,
      kurztext: typ === 'titel' ? 'Neuer Titel' : 'Neue Position',
      langtext: '',
      menge: 0,
      einheit: '',
      einheitspreis: 0,
      flags: {},
      istMenge: 0,
      istVon: '',
      istAm: '',
      abgerechnetMenge: 0,
      sort: maxSort + 1,
    }))
  }

  const spalten = kompakt ? 6 : 9
  const th = 'px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400'

  return (
    <div className="bg-white rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className={`${th} w-28`}>OZ</th>
              <th className={th}>Kurztext</th>
              <th className={`${th} w-24 text-right`}><FeldLabel info={HINWEIS.lvMenge}>Menge</FeldLabel></th>
              <th className={`${th} w-16`}>ME</th>
              <th className={`${th} w-24 text-right`}><FeldLabel info={HINWEIS.lvEp}>EP (€)</FeldLabel></th>
              <th className={`${th} w-28 text-right`}>Gesamt</th>
              {!kompakt && <th className={`${th} w-24 text-right`}><FeldLabel info={HINWEIS.lvIst}>Ist</FeldLabel></th>}
              {!kompakt && <th className={`${th} w-14 text-right`}><FeldLabel info={HINWEIS.lvProzent} ausrichtung="rechts">%</FeldLabel></th>}
              {!kompakt && <th className={`${th} w-20 text-right`}></th>}
            </tr>
          </thead>
          <tbody>
            {positionen.length === 0 && (
              <tr>
                <td colSpan={spalten} className="px-4 py-10 text-center text-sm text-slate-400">
                  Noch keine LV-Positionen. Über „LV importieren" oder „+ Position" anlegen.
                </td>
              </tr>
            )}
            {positionen.map((p) => {
              const tiefe = Math.max(1, (p.oz || '').split('.').filter(Boolean).length)
              const einrueckung = { paddingLeft: `${(tiefe - 1) * 14}px` }
              const istTitel = p.typ === 'titel'
              const proz = p.menge > 0 ? Math.round(((p.istMenge || 0) / p.menge) * 100) : 0
              const zeilen = []

              if (istTitel) {
                zeilen.push(
                  <tr key={p.id} className="bg-slate-50 border-t border-slate-100">
                    <td className="px-2 py-1.5 font-mono text-xs text-slate-500 whitespace-nowrap align-middle">{p.oz}</td>
                    <td className="px-0 py-0.5">
                      <div style={einrueckung}>
                        <ZellenFeld wert={p.kurztext} onWert={(v) => patch(p.id, { kurztext: v })} fett />
                      </div>
                    </td>
                    <td colSpan={3}></td>
                    <td className="px-2 py-1.5 text-right font-bold text-slate-700 whitespace-nowrap">{euro(zwischensumme(p))}</td>
                    {!kompakt && <td colSpan={2}></td>}
                    {!kompakt && (
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setOffen({ ...offen, [p.id]: !offen[p.id] })}
                          className={`p-1 rounded-lg ${offen[p.id] ? 'text-praxis-700 bg-praxis-50' : 'text-slate-300 hover:text-slate-500'}`}
                          title="Langtext anzeigen"
                        >
                          <Icon name="doc" className="w-4 h-4" />
                        </button>
                        <button onClick={() => loeschen(p)} className="p-1 rounded-lg text-slate-300 hover:text-red-500" title="Löschen">
                          <Icon name="x" className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              } else {
                zeilen.push(
                  <tr key={p.id} className="border-t border-slate-50 hover:bg-praxis-50/30">
                    <td className="px-2 py-1.5 font-mono text-xs text-slate-500 whitespace-nowrap align-middle">{p.oz}</td>
                    <td className="px-0 py-0.5">
                      <div className="flex items-center gap-1.5" style={einrueckung}>
                        <ZellenFeld wert={p.kurztext} onWert={(v) => patch(p.id, { kurztext: v })} platzhalter="Kurztext" />
                      </div>
                    </td>
                    <td className="px-0 py-0.5">
                      <ZellenFeld typ="number" wert={p.menge} onWert={(v) => patch(p.id, { menge: v })} className="text-right" />
                    </td>
                    <td className="px-0 py-0.5">
                      <ZellenFeld wert={p.einheit} onWert={(v) => patch(p.id, { einheit: v })} platzhalter="ME" />
                    </td>
                    <td className="px-0 py-0.5">
                      <ZellenFeld typ="number" wert={p.einheitspreis} onWert={(v) => patch(p.id, { einheitspreis: v })} className="text-right" />
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {p.flags?.bedarf ? (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-2.5 py-1">Bedarf</span>
                      ) : p.flags?.nep ? (
                        <span className="text-[10px] font-bold bg-violet-100 text-violet-700 rounded-full px-2.5 py-1">NEP</span>
                      ) : (
                        <span className="font-semibold text-slate-800">{euro((p.menge || 0) * (p.einheitspreis || 0))}</span>
                      )}
                    </td>
                    {!kompakt && (
                      <td className="px-0 py-0.5">
                        <ZellenFeld typ="number" wert={p.istMenge} onWert={(v) => patch(p.id, { istMenge: v })} className="text-right" />
                      </td>
                    )}
                    {!kompakt && (
                      <td className={`px-2 py-1.5 text-right text-xs font-bold whitespace-nowrap ${proz >= 100 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {p.menge > 0 ? `${proz}%` : '–'}
                      </td>
                    )}
                    {!kompakt && (
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setOffen({ ...offen, [p.id]: !offen[p.id] })}
                          className={`p-1 rounded-lg ${offen[p.id] ? 'text-praxis-700 bg-praxis-50' : 'text-slate-300 hover:text-slate-500'}`}
                          title="Langtext anzeigen"
                        >
                          <Icon name="doc" className="w-4 h-4" />
                        </button>
                        <button onClick={() => loeschen(p)} className="p-1 rounded-lg text-slate-300 hover:text-red-500" title="Löschen">
                          <Icon name="x" className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              }

              if (!kompakt && offen[p.id]) {
                zeilen.push(
                  <tr key={`${p.id}-langtext`} className="bg-slate-50/60">
                    <td></td>
                    <td colSpan={spalten - 1} className="px-2 py-2">
                      <LangtextFeld wert={p.langtext} onWert={(v) => patch(p.id, { langtext: v })} />
                      {(p.istVon || p.istAm) && (
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          Ist-Meldung: {p.istVon || '–'}{p.istAm ? ` am ${new Date(p.istAm + 'T12:00:00').toLocaleDateString('de-DE')}` : ''}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              }
              return zeilen
            })}
          </tbody>
        </table>
      </div>

      {/* Fußzeile: neue Zeilen + Gesamtsumme */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
        <button
          onClick={() => neueZeile('position')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-praxis-700 bg-praxis-50 hover:bg-praxis-100 rounded-full px-3.5 py-2"
        >
          <Icon name="plus" className="w-3.5 h-3.5" /> Position
        </button>
        <button
          onClick={() => neueZeile('titel')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full px-3.5 py-2"
        >
          <Icon name="plus" className="w-3.5 h-3.5" /> Titelzeile
        </button>
        <p className="ml-auto text-sm text-slate-500">
          LV-Summe (ohne Bedarf/NEP): <span className="font-bold text-slate-900">{euro(gesamt)}</span>
        </p>
      </div>
    </div>
  )
}
