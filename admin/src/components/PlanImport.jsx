import { useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { Icon } from '@shared/ui.jsx'
import { useLang, t } from '@shared/i18n.js'
import { planAuswerten } from '@shared/planImport.js'
import { umfangUeberschlag } from '@shared/raumflaeche.js'
import { withStore } from '../hooks.js'

// Räume aus einem Bauplan-PDF übernehmen.
//
// BEWUSST ZWEISTUFIG: erst lesen und ZEIGEN, dann übernehmen. An einem echten
// Plan (24 Räume) kamen Nummern und Flächen zuverlässig, die Namen bei 7 von 24
// nicht – dort steht der Name im Plan weiter weg oder ist umbrochen. Ein
// Automatismus würde diese sieben stillschweigend als "ohne Namen" anlegen und
// jemand müsste sie später mühsam suchen. Hier stehen sie rot in der Tabelle
// und lassen sich vor dem Übernehmen ausfüllen.

const FARBEN = ['#8b1a1a', '#0e7490', '#4d7c0f', '#a16207', '#6d28d9', '#be185d']

export default function PlanImport({ projektId, vorhandene = [], onClose }) {
  useLang()
  const datei = useRef(null)
  const [laedt, setLaedt] = useState('')
  const [fehler, setFehler] = useState('')
  const [ergebnis, setErgebnis] = useState(null)
  const [zeilen, setZeilen] = useState([])

  async function gewaehlt(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/\.pdf$/i.test(f.name)) { setFehler(t('plan.keinPdf')); return }
    setFehler('')
    setLaedt(t('plan.liest'))
    try {
      const erg = await planAuswerten(f, {
        aufFortschritt: ({ seite, gesamt }) => setLaedt(t('plan.seite', { seite, gesamt })),
      })
      setErgebnis({ ...erg, dateiname: f.name })
      setZeilen(erg.raeume.map((r, i) => ({
        ...r,
        uebernehmen: true,
        // Bereits vorhandene Nummer? Dann standardmäßig NICHT übernehmen –
        // sonst entstehen Doppel bei einem neuen Planstand.
        doppelt: vorhandene.some((v) => v.aktiv !== false && v.nummer && v.nummer === r.nummer),
        farbe: FARBEN[i % FARBEN.length],
      })).map((r) => ({ ...r, uebernehmen: !r.doppelt })))
    } catch (err) {
      setFehler(err?.message || String(err))
    } finally {
      setLaedt('')
    }
  }

  function aendern(i, felder) {
    setZeilen((z) => z.map((r, j) => (j === i ? { ...r, ...felder } : r)))
  }

  async function uebernehmen() {
    const gewaehlt2 = zeilen.filter((r) => r.uebernehmen)
    if (!gewaehlt2.length) return
    setLaedt(t('plan.legtAn'))
    try {
      // ZWEI WEGE, UND DER ERSTE IST DER RICHTIGE
      //
      // 1. Die Zeichnung wurde gelesen: Lage, Breite und Länge stehen fest, die
      //    Räume liegen wie im Bauplan – jeder für sich, keiner im anderen.
      // 2. Keine Wände lesbar: Rückfall auf Reihen. Dann ist es ausdrücklich
      //    eine Ablage und kein Grundriss; das Büro schiebt sie zurecht.
      //
      // Vorher gab es nur Weg 2, und weil die Reihenbreite nichts von schon
      // vorhandenen Räumen wusste, landeten Importe übereinander.
      const versatz = vorhandene.reduce((m, v) => Math.max(m, (Number(v.y) || 0) + (Number(v.laenge) || 0)), 0)
      let x = 1
      let y = versatz + (versatz > 0 ? 2 : 1)
      let reiheHoehe = 0
      const neu = gewaehlt2.map((r, i) => {
        const ausPlan = r.geometrie && r.breite > 0 && r.laenge > 0
        // Aus der Fläche ein plausibles Rechteck: Quadrat als Ausgangsform.
        const seite = Math.max(1, Math.round(Math.sqrt(r.flaeche) * 4) / 4)
        if (!ausPlan && x + seite > 26) { x = 1; y += reiheHoehe + 1; reiheHoehe = 0 }
        const raum = {
          projektId,
          nummer: r.nummer || '',
          name: r.name || '',
          bereich: '',
          x: ausPlan ? r.x : x,
          y: ausPlan ? r.y + versatz : y,
          breite: ausPlan ? r.breite : seite,
          laenge: ausPlan ? r.laenge : seite,
          // Die FLÄCHE aus dem Plan ist die Wahrheit, nicht Breite × Länge.
          // Deshalb wird sie ausdrücklich mitgeschrieben und gewinnt gegen die
          // Ersatzform – sonst stünde in der Rechnung eine gerundete Zahl.
          flaeche: r.flaeche,
          umfang: umfangUeberschlag(r.flaeche).umfang,
          hoehe: 0,
          // Türen aus dem Plan, sonst leer. Eine erfundene Tür an der falschen
          // Wand ist schlechter als gar keine.
          tueren: Array.isArray(r.tueren) ? r.tueren : [],
          fenster: 1,
          farbe: r.farbe,
          sort: (vorhandene.length || 0) + i,
          fertig: false, aktiv: true, notiz: '',
          aufgaben: [],
          status: {},
          herkunft: 'plan',
          formGeschaetzt: Boolean(r.formGeschaetzt),
          planDatei: ergebnis?.dateiname || '',
          planSeite: r.seite,
          erstelltAm: Date.now(),
        }
        if (!ausPlan) {
          x += seite + 0.5
          reiheHoehe = Math.max(reiheHoehe, seite)
        }
        return raum
      })
      await withStore((s) => s.addMany('raeume', neu))
      onClose?.(neu.length)
    } catch (err) {
      setFehler(err?.message || String(err))
      setLaedt('')
    }
  }

  const gewaehltZahl = zeilen.filter((r) => r.uebernehmen).length
  const summeGewaehlt = Math.round(zeilen.filter((r) => r.uebernehmen)
    .reduce((s, r) => s + r.flaeche, 0) * 100) / 100

  return (
    <Modal titel={t('plan.titel')} onClose={() => onClose?.(0)}>
      <input ref={datei} type="file" accept="application/pdf,.pdf" className="hidden" onChange={gewaehlt} />

      {!ergebnis && (
        <div className="text-center py-6">
          <Icon name="upload" className="w-10 h-10 mx-auto text-schrift-zart mb-3" />
          <p className="text-sm text-schrift-leise mb-4 max-w-md mx-auto">{t('plan.hinweis')}</p>
          <button
            onClick={() => datei.current?.click()}
            disabled={Boolean(laedt)}
            className="px-5 min-h-11 rounded-feld bg-praxis-600 text-white text-sm font-bold disabled:opacity-50"
          >
            {laedt || t('plan.waehlen')}
          </button>
        </div>
      )}

      {fehler && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-feld px-3 py-2">{fehler}</p>
      )}

      {ergebnis && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
            <span className="font-bold text-schrift-stark">
              {t('plan.gefunden', { anzahl: ergebnis.raeume.length, seiten: ergebnis.seiten })}
            </span>
            <span className="text-schrift-leise">{t('plan.summe', { summe: ergebnis.summe })}</span>
            {ergebnis.unvollstaendig > 0 && (
              <span className="text-amber-700 font-semibold">
                {t('plan.unvollstaendig', { anzahl: ergebnis.unvollstaendig })}
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-feld border border-rahmen max-h-80 overflow-y-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="sticky top-0 bg-gedeckt">
                <tr className="border-b border-rahmen text-left">
                  <th className="px-2 py-2 w-10"></th>
                  <th className="px-2 py-2 text-[12px] font-bold uppercase text-schrift-zart">{t('raum.nummer')}</th>
                  <th className="px-2 py-2 text-[12px] font-bold uppercase text-schrift-zart">{t('raum.name')}</th>
                  <th className="px-2 py-2 text-[12px] font-bold uppercase text-schrift-zart text-right">{t('raum.flaeche')}</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((r, i) => (
                  <tr key={i} className={`border-b border-rahmen last:border-0 ${r.doppelt ? 'bg-amber-50' : ''}`}>
                    <td className="px-2 py-1.5">
                      <input type="checkbox" checked={r.uebernehmen} className="w-5 h-5 accent-praxis-600"
                        onChange={(e) => aendern(i, { uebernehmen: e.target.checked })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.nummer} onChange={(e) => aendern(i, { nummer: e.target.value })}
                        className={`w-24 rounded-feld border px-2 py-1.5 text-sm ${r.nummer ? 'border-rahmen' : 'border-red-400 bg-red-50'}`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.name} onChange={(e) => aendern(i, { name: e.target.value })}
                        placeholder={t('plan.namePlatz')}
                        className={`w-full min-w-[160px] rounded-feld border px-2 py-1.5 text-sm ${r.name ? 'border-rahmen' : 'border-red-400 bg-red-50'}`}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold whitespace-nowrap">
                      {r.flaeche.toLocaleString('de-DE')} m²
                      {r.doppelt && <span className="block text-[11px] font-normal text-amber-700">{t('plan.schonDa')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[12px] text-schrift-zart">{t('plan.masseHinweis')}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={uebernehmen}
              disabled={!gewaehltZahl || Boolean(laedt)}
              className="px-5 min-h-11 rounded-feld bg-praxis-600 text-white text-sm font-bold disabled:opacity-40"
            >
              {laedt || t('plan.uebernehmen', { anzahl: gewaehltZahl })}
            </button>
            <span className="text-sm text-schrift-leise">{t('plan.summe', { summe: summeGewaehlt })}</span>
          </div>
        </>
      )}
    </Modal>
  )
}
