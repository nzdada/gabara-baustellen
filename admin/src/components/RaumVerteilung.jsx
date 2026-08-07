import { useMemo, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, t } from '@shared/i18n.js'
import { euro } from '@shared/format.js'
import { BEZUG, verteile, baueSoll, offenJeRaum, meldezeilenFuerRaum } from '@shared/raumsoll.js'
import { fortschrittAufgaben } from '@shared/raumaufgaben.js'
import { heuteISO } from '@shared/slots.js'
import { useWhere, withStore } from '../hooks.js'

// Die Brücke: LV-Position -> Bezugsfläche -> Sollmenge je Raum.
//
// "Die Quadratmeter ergeben sich aus den Räumen, der Preis aus dem LV."
// Hier wird nur die MENGE bestimmt; der Einheitspreis bleibt am LV, und die
// Rechnung entsteht weiterhin im Rechnungs-Assistenten. Damit ändert sich am
// Abrechnungsweg nichts – er bekommt nur eine bessere Mengenherkunft.

export default function RaumVerteilung({ projektId, user }) {
  useLang()
  const positionen = useWhere('lvpositionen', 'projektId', projektId)
  const raeume = useWhere('raeume', 'projektId', projektId)
  const soll = useWhere('raumsoll', 'projektId', projektId)
  const meldungen = useWhere('leistungen', 'projektId', projektId)
  const [bezugWahl, setBezugWahl] = useState({})   // positionId -> bezug
  const [laeuft, setLaeuft] = useState('')
  const [meldung, setMeldung] = useState('')

  const aktiveRaeume = useMemo(() => raeume.filter((r) => r.aktiv !== false), [raeume])
  const arbeitsPositionen = useMemo(
    () => positionen.filter((p) => p.typ === 'position' && !p.flags?.bedarf && !p.flags?.nep)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    [positionen]
  )

  // Bereits verteilte Positionen: die gespeicherte Bezugsart gewinnt
  const gespeicherterBezug = useMemo(() => {
    const m = {}
    for (const s of soll) if (s.bezug) m[s.positionId] = s.bezug
    return m
  }, [soll])

  const fertigeRaeume = useMemo(
    () => aktiveRaeume.filter((r) => fortschrittAufgaben(r).alleFertig),
    [aktiveRaeume]
  )

  async function verteilen(position) {
    const bezug = bezugWahl[position.id] || gespeicherterBezug[position.id]
    if (!bezug || bezug === 'stueck') return
    setLaeuft(position.id)
    setMeldung('')
    try {
      const erg = verteile(position, aktiveRaeume, bezug)
      // Feste Dokument-IDs (rs-<position>-<raum>): erneutes Verteilen ERSETZT
      // die alten Zeilen, statt sie zu verdoppeln.
      const zeilen = erg.zeilen.map((z) => baueSoll({
        projektId, position, raumId: z.raumId, raumName: z.raumName, menge: z.sollMenge, bezug,
      }))
      // Räume, die diesmal nichts abbekommen, müssen ihre alte Zeile verlieren –
      // sonst bleibt eine Sollmenge stehen, die es nicht mehr gibt.
      const behalten = new Set(zeilen.map((z) => z.id))
      const weg = soll.filter((s) => s.positionId === position.id && !behalten.has(s.id)).map((s) => s.id)
      await withStore(async (s2) => {
        if (weg.length) await s2.removeMany('raumsoll', weg)
        if (zeilen.length) await s2.addMany('raumsoll', zeilen)
      })
      setMeldung(t('vert.verteilt', { anzahl: zeilen.length, summe: erg.summe, einheit: position.einheit || '' }))
    } catch (e) {
      setMeldung(e?.message || String(e))
    } finally {
      setLaeuft('')
    }
  }

  // Aus einem fertigen Raum die offenen Sollmengen als Meldung übernehmen.
  // Ausdrücklicher Schritt: Der Monteur hakt ab, das Büro übernimmt.
  async function raumUebernehmen(raum) {
    setLaeuft(raum.id)
    setMeldung('')
    try {
      const zeilen = meldezeilenFuerRaum({
        raum, soll, meldungen, positionen: arbeitsPositionen,
        projektId, user, datum: heuteISO(),
      })
      if (!zeilen.length) { setMeldung(t('vert.nichtsOffen')); return }
      let fehler = null
      await withStore((s) => s.meldeLeistungen(zeilen, {
        istFelder: { istVon: user?.name || '', istAm: heuteISO(), istQuelle: 'summe', istAktualisiertAm: Date.now() },
        onFehler: (e) => { fehler = e },
      }))
      if (fehler) throw fehler
      setMeldung(t('vert.uebernommen', { anzahl: zeilen.length, raum: raum.nummer || raum.name || '' }))
    } catch (e) {
      setMeldung(e?.message || String(e))
    } finally {
      setLaeuft('')
    }
  }

  if (!aktiveRaeume.length) {
    return <p className="text-sm text-schrift-leise">{t('vert.ohneRaeume')}</p>
  }
  if (!arbeitsPositionen.length) {
    return <p className="text-sm text-schrift-leise">{t('vert.ohneLv')}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-schrift-leise">{t('vert.hinweis')}</p>
      {meldung && (
        <p className="text-sm text-schrift bg-gedeckt border border-rahmen rounded-feld px-3 py-2">{meldung}</p>
      )}

      <div className="overflow-x-auto rounded-karte border border-rahmen">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="border-b border-rahmen text-left">
              {['lv.oz', 'lv.kurztext', 'allg.menge', 'vert.bezug', 'vert.verteiltSumme', ''].map((k, i) => (
                <th key={i} className="px-2 py-2 text-[12px] font-bold uppercase tracking-wide text-schrift-zart">
                  {k ? t(k) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {arbeitsPositionen.map((p) => {
              const bezug = bezugWahl[p.id] ?? gespeicherterBezug[p.id] ?? ''
              const eigene = soll.filter((s) => s.positionId === p.id)
              const summe = Math.round(eigene.reduce((s, x) => s + (Number(x.sollMenge) || 0), 0) * 100) / 100
              const vorschau = bezug && bezug !== 'stueck' ? verteile(p, aktiveRaeume, bezug) : null
              const zuViel = vorschau?.ueberVertrag
              return (
                <tr key={p.id} className="border-b border-rahmen last:border-0 align-top">
                  <td className="px-2 py-2 text-schrift-zart whitespace-nowrap">{p.oz}</td>
                  <td className="px-2 py-2">
                    <p className="text-schrift-stark">{p.kurztext}</p>
                    {eigene.length > 0 && (
                      <p className="text-[12px] text-schrift-zart mt-0.5">
                        {t('vert.aufRaeume', { anzahl: eigene.length })}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {(p.menge || 0).toLocaleString('de-DE')} {p.einheit}
                    <span className="block text-[12px] text-schrift-zart">{euro(p.einheitspreis)}/{p.einheit}</span>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={bezug}
                      onChange={(e) => setBezugWahl((b) => ({ ...b, [p.id]: e.target.value }))}
                      className="w-44 rounded-feld border border-rahmen px-2 py-2 text-sm"
                    >
                      <option value="">{t('vert.bezugWaehlen')}</option>
                      {BEZUG.map((b) => <option key={b.id} value={b.id}>{t(b.schluessel)}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {vorschau ? (
                      <>
                        <span className={zuViel ? 'font-bold text-amber-700' : 'font-bold text-schrift-stark'}>
                          {vorschau.summe.toLocaleString('de-DE')} {p.einheit}
                        </span>
                        {vorschau.geschaetzt && (
                          <span className="ml-1 text-[11px] font-bold text-amber-700">{t('raum.geschaetzt')}</span>
                        )}
                        <span className="block text-[12px] text-schrift-zart">
                          {t('vert.gegenLv', { differenz: vorschau.abweichung })}
                        </span>
                      </>
                    ) : summe > 0 ? (
                      <span className="font-bold text-schrift-stark">{summe.toLocaleString('de-DE')} {p.einheit}</span>
                    ) : <span className="text-schrift-zart">–</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => verteilen(p)}
                      disabled={!bezug || bezug === 'stueck' || laeuft === p.id}
                      className="px-3 min-h-11 rounded-feld bg-praxis-600 text-white text-xs font-bold disabled:opacity-40"
                    >
                      {laeuft === p.id ? '…' : t('vert.verteilen')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Fertige Räume in Mengen umwandeln */}
      {fertigeRaeume.length > 0 && (
        <div className="rounded-karte border border-emerald-300 bg-emerald-50 p-4">
          <p className="font-bold text-emerald-900 mb-1">
            {t('vert.fertigeRaeume', { anzahl: fertigeRaeume.length })}
          </p>
          <p className="text-[12px] text-emerald-800 mb-3">{t('vert.fertigeHinweis')}</p>
          <div className="space-y-2">
            {fertigeRaeume.map((r) => {
              const offen = offenJeRaum(soll.filter((s) => s.raumId === r.id), meldungen)
              const summeOffen = Math.round(offen.reduce((s, x) => s + x.offen, 0) * 100) / 100
              return (
                <div key={r.id} className="flex items-center gap-3 bg-karte border border-rahmen rounded-feld px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-schrift-stark">
                      {r.nummer ? `${r.nummer} · ` : ''}{r.name || t('raum.ohneName')}
                    </p>
                    <p className="text-[12px] text-schrift-leise">
                      {summeOffen > 0
                        ? t('vert.offenMenge', { menge: summeOffen })
                        : t('vert.nichtsOffen')}
                    </p>
                  </div>
                  <button
                    onClick={() => raumUebernehmen(r)}
                    disabled={summeOffen <= 0 || laeuft === r.id}
                    className="px-3 min-h-11 rounded-feld bg-emerald-600 text-white text-xs font-bold disabled:opacity-40 shrink-0"
                  >
                    {laeuft === r.id ? '…' : t('vert.uebernehmen')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
