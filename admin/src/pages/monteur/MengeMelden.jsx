import { useMemo, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'
import { baueMeldung, summeJePosition } from '@shared/leistungen.js'
import { parseZahlPruef } from '../../csv.js'
import { withStore } from '../../hooks.js'

// Mengen melden auf dem Handy.
//
// Der Unterschied zur alten Erfassung: Hier steht, was HEUTE geschafft wurde –
// nicht die Gesamtmenge. Vorher musste der Monteur auf der Leiter selbst rechnen
// (820 gestern + 120 heute = 940 eintippen), und jede Eingabe überschrieb still
// den Stand des Kollegen.
//
// ALLES ODER NICHTS: Eine Meldung über mehrere Positionen geht in EINEM Vorgang
// raus (store.meldeLeistungen). Eine Schleife mit einzelnen Schreibvorgängen
// hinterließe bei einem Abbruch nach Position 1 von 3 einen halben Zustand – der
// Monteur sieht einen Fehler, drückt erneut, und Position 1 wird doppelt gebucht.
// Weil dann sowohl istMenge als auch die Meldungssumme doppelt sind, fällt es
// keiner Prüfung auf; fakturiert wird trotzdem zu viel.

// Eine Eingabe lesen. Streng: ein Wert, der zu 0 zerfällt, obwohl etwas
// dasteht ("1,2,3"), gilt als unlesbar statt als Nullmeldung.
function liesMenge(roh) {
  const g = parseZahlPruef(roh ?? '')
  if (g.leer) return { leer: true, ok: true, wert: 0 }
  if (!g.ok || g.wert < 0) return { leer: false, ok: false, wert: 0 }
  const nurNull = /^[\s0.,]*$/.test(String(roh))
  if (g.wert === 0 && !nurNull) return { leer: false, ok: false, wert: 0 }
  return { leer: false, ok: true, wert: g.wert }
}

// Was gilt als "bisher gemeldet"? Für Positionen, die noch nie über eine
// Meldung liefen (istQuelle fehlt), ist der Altbestand aus istMenge die
// Wahrheit – sonst zeigte die Karte 0, obwohl 820 m² erfasst sind, und die
// Warnung "über der Vertragsmenge" schlüge nie an.
function bisherVon(position, summen) {
  if (position.istQuelle === 'summe') return summen[position.id] || 0
  return Number(position.istMenge) || 0
}

export default function MengeMelden({ projektId, positionen, meldungen, user, terminId = '', onFertig }) {
  useLang()
  const [eingaben, setEingaben] = useState({})   // positionId -> Rohtext
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [datum, setDatum] = useState(heuteISO())

  const summen = useMemo(() => summeJePosition(meldungen), [meldungen])

  const fertige = useMemo(() => {
    const raus = []
    for (const p of positionen) {
      const g = liesMenge(eingaben[p.id])
      if (g.leer || !g.ok || g.wert <= 0) continue
      raus.push({ position: p, menge: g.wert })
    }
    return raus
  }, [eingaben, positionen])

  function setze(id, wert) {
    setFehler('')
    setEingaben((e) => ({ ...e, [id]: wert }))
  }

  async function melden() {
    if (!fertige.length || laeuft) return   // schützt zugleich gegen Doppelklick
    setLaeuft(true)
    setFehler('')
    try {
      const zeilen = fertige.map(({ position, menge }) =>
        baueMeldung({ position, projektId, menge, datum, user, terminId }))
      // Erste Meldung auf einer Position aus dem Altbestand: den bereits
      // gespeicherten Wert als eine Protokollzeile nachtragen. Ohne das meldete
      // die Abweichungspruefung sofort eine Luecke in genau dieser Hoehe -
      // istMenge 820, Summe der Meldungen 120.
      const altbestand = fertige
        .filter(({ position }) => position.istQuelle !== 'summe' && (Number(position.istMenge) || 0) > 0)
        .map(({ position }) => ({
          ...baueMeldung({
            position, projektId,
            menge: Number(position.istMenge) || 0,
            datum: position.istAm || datum,
            // mitarbeiterId MUSS die eigene Auth-UID sein: firestore.rules erlaubt
            // einem Monteur nur das Anlegen unter eigenem Namen. Mit leerer Kennung
            // lehnt der Server die Zeile ab – und weil alles in EINEM Batch läuft,
            // scheitert damit die komplette Meldung, auch die richtigen Zeilen.
            // Wer den Altbestand ursprünglich erfasst hat, bleibt im Namen erhalten.
            user: { userId: user?.userId || '', name: position.istVon || user?.name || '' },
            quelle: 'migration',
          }),
          notiz: t('melden.altbestand'),
        }))
      let schreibFehler = null
      const { ids, bestaetigt } = await withStore((s) => s.meldeLeistungen(zeilen, {
        istFelder: {
          istVon: user?.name || '',
          istAm: datum,
          istQuelle: 'summe',
          istAktualisiertAm: Date.now(),
        },
        altbestand,
        onFehler: (e) => { schreibFehler = e },
      }))
      if (schreibFehler) throw schreibFehler
      // NUR die tatsächlich gemeldeten Felder leeren. Vorher wurde der gesamte
      // Eingabezustand geworfen – damit verschwand auch, was jemand gerade erst
      // angetippt und noch nicht abgeschickt hatte.
      setEingaben((e) => {
        const n = { ...e }
        for (const { position } of fertige) delete n[position.id]
        return n
      })
      onFertig?.({ anzahl: ids.length, ids, bestaetigt })
    } catch (e) {
      setFehler(e?.message || String(e))
    } finally {
      setLaeuft(false)
    }
  }

  const feld = 'w-28 rounded-xl border px-3 py-3 text-lg font-bold text-right focus:outline-none focus:ring-2 focus:ring-praxis-500'

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-slate-500">
        <Icon name="calendar" className="w-4 h-4" />
        {t('melden.tag')}
        <input
          type="date" value={datum} max={heuteISO()}
          onChange={(e) => setDatum(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
        />
        {datum !== heuteISO() && (
          <span className="text-amber-700 font-semibold">{t('melden.nachtrag')}</span>
        )}
      </label>

      {positionen.map((p) => {
        const g = liesMenge(eingaben[p.id])
        const unlesbar = !g.leer && !g.ok
        const schon = bisherVon(p, summen)
        const soll = Number(p.menge) || 0
        const zuViel = soll > 0 && schon + (g.ok && !g.leer ? g.wert : 0) > soll
        return (
          <div key={p.id} className="border border-slate-200 rounded-2xl p-3 bg-white">
            <p className="text-xs text-slate-400">{p.oz}</p>
            <p className="text-sm font-semibold text-slate-800 mb-2">{p.kurztext}</p>
            <div className="flex items-end justify-between gap-3">
              <div className="text-[12px] text-slate-500 leading-snug min-w-0">
                <p>{t('melden.bisher', { menge: schon, einheit: p.einheit || '' })}</p>
                <p>{t('melden.vertrag', { menge: soll, einheit: p.einheit || '' })}</p>
              </div>
              <div className="text-right shrink-0">
                <label className="block text-[12px] font-semibold text-slate-500 mb-1">
                  {t('melden.heute')}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text" inputMode="decimal"
                    value={eingaben[p.id] ?? ''}
                    onChange={(e) => setze(p.id, e.target.value)}
                    placeholder="0"
                    className={`${feld} ${unlesbar ? 'border-red-400 bg-red-50' : zuViel ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}
                  />
                  <span className="text-sm text-slate-400 w-8 text-left">{p.einheit || ''}</span>
                </div>
              </div>
            </div>
            {unlesbar && <p className="mt-1.5 text-[12px] font-semibold text-red-600">{t('monteur.zahlUnlesbar')}</p>}
            {zuViel && (
              <p className="mt-1.5 text-[12px] font-semibold text-amber-700">
                {t('melden.ueberVertrag', { menge: soll, einheit: p.einheit || '' })}
              </p>
            )}
          </div>
        )
      })}

      {fehler && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{fehler}</p>
      )}

      <button
        onClick={melden}
        disabled={laeuft || !fertige.length}
        className="w-full py-4 rounded-2xl bg-praxis-600 text-white text-base font-bold disabled:opacity-40"
      >
        {laeuft ? t('allg.laedt') : t('melden.absenden', { anzahl: fertige.length })}
      </button>
    </div>
  )
}

// Liste der eigenen Meldungen mit Zurücknehmen.
//
// Zurücknehmen heißt STORNIEREN: die Zeile bleibt durchgestrichen stehen und
// wird gegengerechnet. Eine Mengenmeldung ist gegenüber dem Auftraggeber
// Nachweis – ein Protokoll, aus dem sich Zeilen entfernen lassen, ist im
// Streitfall wenig wert.
export function MeineMeldungen({ meldungen, user, positionen, aufStorno, laeuftFuer }) {
  useLang()
  const eigene = useMemo(() => {
    // Ohne eigene Kennung wird NICHTS als "meins" ausgegeben. Vorher fiel der
    // Filter bei fehlender userId komplett weg – dann sah (und stornierte) ein
    // Monteur ohne Profil die Meldungen aller Kollegen.
    if (!user?.userId) return []
    // Übernahmezeilen des Altbestands ausblenden: sie tragen zwar die eigene
    // Kennung (die Regel verlangt das), stammen aber nicht aus einer eigenen
    // Meldung. Ein Storno darauf würde den übernommenen Stand vernichten.
    return meldungen
      .filter((m) => m.mitarbeiterId === user.userId && m.quelle !== 'migration')
      .slice(0, 20)
  }, [meldungen, user])

  if (!user?.userId) return <p className="text-sm text-slate-400">{t('melden.keinProfil')}</p>
  if (!eigene.length) return <p className="text-sm text-slate-400">{t('melden.keineMeldungen')}</p>

  return (
    <div className="space-y-2">
      {eigene.map((m) => {
        const p = positionen.find((x) => x.id === m.positionId)
        const beschaeftigt = laeuftFuer === m.id
        return (
          <div
            key={m.id}
            className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 ${
              m.storniert ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold text-slate-800 truncate ${m.storniert ? 'line-through' : ''}`}>
                {m.menge} {m.einheit} · {p?.kurztext || m.oz}
              </p>
              <p className="text-[12px] text-slate-400">
                {datumLok(m.datum)}{m.raumName ? ` · ${m.raumName}` : ''}
                {m.storniert ? ` · ${t('melden.storniert')}` : ''}
              </p>
            </div>
            {!m.storniert && (
              <button
                onClick={() => aufStorno(m)}
                disabled={beschaeftigt}
                // min-h-11: Touchziel. Vorher war der Knopf unter 30 px hoch –
                // auf einem Handy mit Handschuhen kaum sicher zu treffen, und
                // er löst eine Buchung aus.
                className="text-xs font-semibold text-red-600 px-3 min-h-11 shrink-0 disabled:opacity-40"
              >
                {beschaeftigt ? '…' : t('melden.zurueck')}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
