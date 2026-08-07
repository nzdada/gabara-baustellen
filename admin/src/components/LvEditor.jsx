import { useEffect, useMemo, useRef, useState } from 'react'
import { useWhere, withStore } from '../hooks.js'
import { euro } from '@shared/format.js'
import { Icon } from '@shared/ui.jsx'
import { heuteISO } from '@shared/slots.js'
import { parseZahl } from '../csv.js'
import { pruefeAlle } from '@shared/leistungen.js'
import { FeldLabel } from './InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'
import { useLang, t, datumLok } from '@shared/i18n.js'

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
    // parseZahl versteht auch deutsche Eingaben wie "2.582,421" – Number() macht daraus 0
    onWert(typ === 'number' ? parseZahl(v) : v)
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
      className={`w-full bg-transparent rounded-feld border border-transparent hover:border-rahmen focus:border-praxis-500 focus:bg-karte px-2 py-1.5 focus:outline-none ${fett ? 'font-bold text-schrift-stark' : ''} ${className}`}
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
      placeholder={t('lv.langtextPlatz')}
      onChange={(e) => aendern(e.target.value)}
      onFocus={() => { fokus.current = true }}
      onBlur={(e) => { fokus.current = false; clearTimeout(timer.current); onWert(e.target.value) }}
      className="w-full text-xs text-schrift-leise leading-relaxed rounded-feld border border-rahmen bg-karte px-3 py-2 focus:outline-none focus:ring-2 focus:ring-praxis-500"
    />
  )
}

export default function LvEditor({ projektId, kompakt = false }) {
  useLang()
  const roh = useWhere('lvpositionen', 'projektId', projektId)
  const meldungen = useWhere('leistungen', 'projektId', projektId)
  const positionen = useMemo(() => [...roh].sort((a, b) => (a.sort || 0) - (b.sort || 0)), [roh])
  const [offen, setOffen] = useState({}) // id -> true = Langtext aufgeklappt

  // Bedarfs-/NEP-Positionen zählen nicht in Summen
  const zaehltMit = (p) => p.typ === 'position' && !p.flags?.bedarf && !p.flags?.nep
  const gesamt = positionen.filter(zaehltMit).reduce((s, p) => s + (p.menge || 0) * (p.einheitspreis || 0), 0)

  // Ist-Menge im Büro ändern.
  //
  // Zwei Fälle: Positionen aus dem Altbestand (kein istQuelle) werden weiter
  // direkt gesetzt – dort gibt es keine Meldungen, die auseinanderlaufen könnten.
  // Sobald eine Position über Meldungen läuft, wird stattdessen eine Korrektur-
  // ZEILE mit der Differenz geschrieben. Damit bleibt nachvollziehbar, wer wann
  // was geändert hat, und die Summe stimmt weiterhin mit istMenge überein.
  async function istKorrektur(p, neuerWert) {
    const ziel = Number(neuerWert) || 0
    const alt = Number(p.istMenge) || 0
    const diff = Math.round((ziel - alt) * 1000) / 1000
    if (p.istQuelle !== 'summe') {
      patch(p.id, { istMenge: ziel, istVon: t('lv.buero'), istAm: heuteISO() })
      return
    }
    if (Math.abs(diff) < 0.001) return
    await withStore((s) => s.meldeLeistungen([{
      projektId: p.projektId,
      positionId: p.id,
      oz: p.oz || '',
      einheit: p.einheit || '',
      raumId: '', raumName: '',
      menge: diff,
      datum: heuteISO(),
      mitarbeiterId: '',
      mitarbeiterName: t('lv.buero'),
      terminId: '', notiz: t('lv.korrekturBuero'),
      storniert: false, storniertAm: 0, storniertVon: '',
      quelle: 'buero',
      erfasstAm: Date.now(),
    }], {
      istFelder: { istVon: t('lv.buero'), istAm: heuteISO(), istQuelle: 'summe', istAktualisiertAm: Date.now() },
    }))
  }

  // ZWEITE VERTEIDIGUNGSLINIE.
  //
  // istMenge wird inkrementell fortgeschrieben – schnell, offline-fähig, atomar.
  // Die Wahrheit sind aber die Meldezeilen. Laufen beide auseinander (abgebrochener
  // Vorgang, doppelt ausgeführte Migration, Altdaten), dann steht in der Rechnung
  // eine Menge, für die es keinen Nachweis gibt. Genau das darf gegenüber einem
  // Generalunternehmer nicht passieren, deshalb wird es hier sichtbar gemacht
  // statt still hingenommen.
  const abweichungen = useMemo(
    () => pruefeAlle(positionen.filter((x) => x.istQuelle === 'summe'), meldungen),
    [positionen, meldungen]
  )

  // Reparatur: istMenge auf die Summe der Meldungen zurücksetzen. Bewusst
  // einzeln und sichtbar, nicht automatisch im Hintergrund.
  async function neuBerechnen() {
    for (const a of abweichungen) {
      await withStore((s) => s.update('lvpositionen', a.position.id, {
        istMenge: a.gemeldet, istAktualisiertAm: Date.now(),
      }))
    }
  }

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
      kurztext: t(typ === 'titel' ? 'lv.neuerTitel' : 'lv.neuePosition'),
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
  const th = 'px-2 py-2 text-[12px] font-bold uppercase tracking-wide text-schrift-zart'

  return (
    <div className="bg-karte rounded-karte border border-rahmen">
      {abweichungen.length > 0 && (
        <div className="m-3 rounded-feld border border-red-300 bg-red-50 p-3">
          <p className="text-sm font-bold text-red-800">
            {t('lv.abweichungTitel', { anzahl: abweichungen.length })}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {abweichungen.slice(0, 6).map((a) => (
              <li key={a.position.id} className="text-xs text-red-700">
                {a.position.oz} · {t('lv.abweichung', { gespeichert: a.gespeichert, gemeldet: a.gemeldet })}
              </li>
            ))}
          </ul>
          <button
            onClick={neuBerechnen}
            className="mt-2 px-3 py-2 rounded-feld bg-red-600 text-white text-xs font-bold"
          >
            {t('lv.neuBerechnen')}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-rahmen text-left">
              <th className={`${th} w-28`}>OZ</th>
              <th className={th}>{t('lv.kurztext')}</th>
              <th className={`${th} w-24 text-right`}><FeldLabel info={HINWEIS.lvMenge}>{t('allg.menge')}</FeldLabel></th>
              <th className={`${th} w-16`}>{t('lv.me')}</th>
              <th className={`${th} w-24 text-right`}><FeldLabel info={HINWEIS.lvEp}>EP (€)</FeldLabel></th>
              <th className={`${th} w-28 text-right`}>{t('lv.gesamt')}</th>
              {!kompakt && <th className={`${th} w-24 text-right`}><FeldLabel info={HINWEIS.lvIst}>{t('lv.ist')}</FeldLabel></th>}
              {!kompakt && <th className={`${th} w-14 text-right`}><FeldLabel info={HINWEIS.lvProzent}>%</FeldLabel></th>}
              {!kompakt && <th className={`${th} w-20 text-right`}></th>}
            </tr>
          </thead>
          <tbody>
            {positionen.length === 0 && (
              <tr>
                <td colSpan={spalten} className="px-4 py-10 text-center text-sm text-schrift-zart">
                  {t('lv.leer')}
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
                  <tr key={p.id} className="bg-gedeckt border-t border-rahmen">
                    <td className="px-2 py-1.5 font-mono text-xs text-schrift-leise whitespace-nowrap align-middle">{p.oz}</td>
                    <td className="px-0 py-0.5">
                      <div style={einrueckung}>
                        <ZellenFeld wert={p.kurztext} onWert={(v) => patch(p.id, { kurztext: v })} fett />
                      </div>
                    </td>
                    <td colSpan={3}></td>
                    <td className="px-2 py-1.5 text-right font-bold text-schrift whitespace-nowrap">{euro(zwischensumme(p))}</td>
                    {!kompakt && <td colSpan={2}></td>}
                    {!kompakt && (
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setOffen({ ...offen, [p.id]: !offen[p.id] })}
                          className={`p-1 rounded-feld ${offen[p.id] ? 'text-praxis-700 bg-praxis-50' : 'text-schrift-zart hover:text-schrift-leise'}`}
                          title={t('lv.langtextZeigen')}
                        >
                          <Icon name="doc" className="w-4 h-4" />
                        </button>
                        <button onClick={() => loeschen(p)} className="p-1 rounded-feld text-schrift-zart hover:text-red-500" title={t('allg.loeschen')}>
                          <Icon name="x" className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              } else {
                zeilen.push(
                  <tr key={p.id} className="border-t border-rahmen hover:bg-praxis-50/30">
                    <td className="px-2 py-1.5 font-mono text-xs text-schrift-leise whitespace-nowrap align-middle">{p.oz}</td>
                    <td className="px-0 py-0.5">
                      <div className="flex items-center gap-1.5" style={einrueckung}>
                        <ZellenFeld wert={p.kurztext} onWert={(v) => patch(p.id, { kurztext: v })} platzhalter={t('lv.kurztext')} />
                      </div>
                    </td>
                    <td className="px-0 py-0.5">
                      <ZellenFeld typ="number" wert={p.menge} onWert={(v) => patch(p.id, { menge: v })} className="text-right" />
                    </td>
                    <td className="px-0 py-0.5">
                      <ZellenFeld wert={p.einheit} onWert={(v) => patch(p.id, { einheit: v })} platzhalter={t('lv.me')} />
                    </td>
                    <td className="px-0 py-0.5">
                      <ZellenFeld typ="number" wert={p.einheitspreis} onWert={(v) => patch(p.id, { einheitspreis: v })} className="text-right" />
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {p.flags?.bedarf ? (
                        <span className="text-[11px] font-bold bg-amber-100 text-amber-700 rounded-full px-2.5 py-1">{t('lv.bedarf')}</span>
                      ) : p.flags?.nep ? (
                        <span className="text-[11px] font-bold bg-violet-100 text-violet-700 rounded-full px-2.5 py-1">NEP</span>
                      ) : (
                        <span className="font-semibold text-schrift-stark">{euro((p.menge || 0) * (p.einheitspreis || 0))}</span>
                      )}
                    </td>
                    {!kompakt && (
                      <td className="px-0 py-0.5">
                        {/* Korrektur durch das Büro.
                            Läuft die Position über Meldungen (istQuelle==='summe'),
                            wird istMenge NICHT direkt überschrieben, sondern eine
                            Meldezeile mit der DIFFERENZ geschrieben. Sonst gäbe es
                            zwei Schreibwege auf dasselbe Feld: die Summe der
                            Meldungen und der gespeicherte Wert liefen auseinander,
                            und in der Rechnung stünde eine Menge ohne Nachweis. */}
                        <ZellenFeld typ="number" wert={p.istMenge} onWert={(v) => istKorrektur(p, v)} className="text-right" />
                      </td>
                    )}
                    {!kompakt && (
                      <td className={`px-2 py-1.5 text-right text-xs font-bold whitespace-nowrap ${proz >= 100 ? 'text-emerald-600' : 'text-schrift-zart'}`}>
                        {p.menge > 0 ? `${proz}%` : '–'}
                      </td>
                    )}
                    {!kompakt && (
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setOffen({ ...offen, [p.id]: !offen[p.id] })}
                          className={`p-1 rounded-feld ${offen[p.id] ? 'text-praxis-700 bg-praxis-50' : 'text-schrift-zart hover:text-schrift-leise'}`}
                          title={t('lv.langtextZeigen')}
                        >
                          <Icon name="doc" className="w-4 h-4" />
                        </button>
                        <button onClick={() => loeschen(p)} className="p-1 rounded-feld text-schrift-zart hover:text-red-500" title={t('allg.loeschen')}>
                          <Icon name="x" className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              }

              if (!kompakt && offen[p.id]) {
                zeilen.push(
                  <tr key={`${p.id}-langtext`} className="bg-gedeckt/60">
                    <td></td>
                    <td colSpan={spalten - 1} className="px-2 py-2">
                      <LangtextFeld wert={p.langtext} onWert={(v) => patch(p.id, { langtext: v })} />
                      {(p.istVon || p.istAm) && (
                        <p className="mt-1.5 text-[12px] text-schrift-zart">
                          {t('lv.istMeldung')}: {p.istVon || '–'}{p.istAm ? ` · ${datumLok(p.istAm, { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
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
      <div className="flex flex-wrap items-center gap-2 border-t border-rahmen px-4 py-3">
        <button
          onClick={() => neueZeile('position')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-praxis-700 bg-praxis-50 hover:bg-praxis-100 rounded-full px-3.5 py-2"
        >
          <Icon name="plus" className="w-3.5 h-3.5" /> {t('lv.position')}
        </button>
        <button
          onClick={() => neueZeile('titel')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-schrift bg-gedeckt-tief hover:bg-gedeckt-tief rounded-full px-3.5 py-2"
        >
          <Icon name="plus" className="w-3.5 h-3.5" /> {t('lv.titelzeile')}
        </button>
        <p className="ml-auto text-sm text-schrift-leise">
          {t('lv.summe')}: <span className="font-bold text-schrift-stark">{euro(gesamt)}</span>
        </p>
      </div>
    </div>
  )
}
