import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { euro } from '@shared/format.js'
import { heuteISO } from '@shared/slots.js'
import InfoHinweis, { FeldLabel } from './InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'
import { useCollection, withStore } from '../hooks.js'
import { syncKunde, erstelleFastbillRechnung } from '@shared/fastbill.js'

// Rechnungs-Assistent: sammelt LV-Restmengen (istMenge − abgerechnetMenge),
// freigegebene Regieberichte und eingereichte Spesen eines Projekts,
// erzeugt daraus den Rechnungs-Spiegel und überträgt ihn optional direkt
// als ENTWURF nach FastBill (dort: Nummer, E-Rechnung, Versand, Mahnwesen).

function rund(n) { return Math.round(n * 100) / 100 }

export default function RechnungWizard({ onClose, projektIdVorbelegt = '' }) {
  const projekte = useCollection('projekte')
  const patients = useCollection('patients')
  const lvAlle = useCollection('lvpositionen')
  const berichteAlle = useCollection('berichte')
  const spesenAlle = useCollection('spesen')
  const bausteine = useCollection('bausteine')

  const [schritt, setSchritt] = useState(projektIdVorbelegt ? 2 : 1)
  const [projektId, setProjektId] = useState(projektIdVorbelegt)
  const [gewaehltLv, setGewaehltLv] = useState(null)     // {posId: menge}
  const [gewaehltRegie, setGewaehltRegie] = useState({}) // {berichtId: true}
  const [gewaehltSpesen, setGewaehltSpesen] = useState({})
  const [positionen, setPositionen] = useState([])
  const [titel, setTitel] = useState('')
  const [zeitraum, setZeitraum] = useState({ von: '', bis: '' })
  const [einbehaltProzent, setEinbehaltProzent] = useState(null)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')

  const projekt = projekte.find((p) => p.id === projektId)
  const kunde = patients.find((k) => k.id === projekt?.kundeId)

  // ALLE noch nicht vollständig abgerechneten LV-Positionen anbieten – nicht nur die,
  // zu denen ein Monteur schon eine Ist-Menge gemeldet hat. Sonst stünde das Büro vor
  // einer leeren Liste, obwohl es abrechnen darf (Wunsch des Auftraggebers).
  const lvOffen = useMemo(() => lvAlle
    .filter((p) => p.projektId === projektId && p.typ === 'position')
    .filter((p) => !p.flags?.bedarf && !p.flags?.nep)
    .filter((p) => rund(Math.max(p.menge || 0, p.istMenge || 0) - (p.abgerechnetMenge || 0)) > 0)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0)), [lvAlle, projektId])
  const regieFrei = useMemo(() => berichteAlle
    .filter((b) => b.projektId === projektId && b.typ === 'regie' && b.status === 'freigegeben'), [berichteAlle, projektId])
  const spesenOffen = useMemo(() => spesenAlle
    .filter((s) => s.projektId === projektId && s.status === 'eingereicht'), [spesenAlle, projektId])

  // Vom Monteur gemeldet und noch nicht fakturiert
  const istOffenVon = (p) => rund(Math.max(0, (p.istMenge || 0) - (p.abgerechnetMenge || 0)))
  // Vertraglich noch offen (Obergrenze der Abrechnung)
  const sollOffenVon = (p) => rund(Math.max(0, (p.menge || 0) - (p.abgerechnetMenge || 0)))
  const grenzeVon = (p) => Math.max(istOffenVon(p), sollOffenVon(p))

  function projektWaehlen(id) {
    setProjektId(id)
    setGewaehltLv(null)
    setGewaehltRegie({})
    setGewaehltSpesen({})
  }

  // Vorbelegung: das, was der Monteur gemeldet hat. Positionen ohne Meldung
  // starten bei 0 – das Büro kann die Menge jederzeit selbst eintragen.
  const lvAuswahl = gewaehltLv ?? Object.fromEntries(lvOffen.map((p) => [p.id, istOffenVon(p)]))

  function zuSchritt3() {
    const pos = []
    for (const p of lvOffen) {
      const menge = Number(lvAuswahl[p.id]) || 0
      if (menge <= 0) continue
      pos.push({ quelle: 'lv', quelleId: p.id, oz: p.oz, text: p.kurztext, menge, einheit: p.einheit, ep: p.einheitspreis })
    }
    for (const b of regieFrei) {
      if (!gewaehltRegie[b.id]) continue
      const ref = b.nummer ? `lt. Regiebericht ${b.nummer}` : `lt. Regiebericht vom ${b.datum ? new Date(b.datum + 'T12:00:00').toLocaleDateString('de-DE') : ''}`
      for (const z of b.stunden || []) {
        if (!z.anzahl) continue
        // Zitierfähige Position: Berichtsnummer + Name + Tag (Beweiskette Rechnung -> Nachweis)
        pos.push({ quelle: 'regie', quelleId: b.id, oz: b.nummer || 'Regie', text: `Regiestunden ${z.art === 'helfer' ? 'Helfer' : 'Facharbeiter'}${z.name ? ` (${z.name}` : ''}${z.datum ? `${z.name ? ', ' : ' ('}${new Date(z.datum + 'T12:00:00').toLocaleDateString('de-DE')})` : (z.name ? ')' : '')} ${ref}`, menge: z.anzahl, einheit: 'Std.', ep: z.satz })
      }
      for (const m of b.material || []) {
        if (!m.menge) continue
        pos.push({ quelle: 'material', quelleId: b.id, oz: b.nummer || 'Material', text: `${m.name} ${ref}`, menge: m.menge, einheit: m.einheit || '', ep: m.preis })
      }
    }
    for (const s of spesenOffen) {
      if (!gewaehltSpesen[s.id]) continue
      pos.push({ quelle: 'spesen', quelleId: s.id, oz: 'Spesen', text: `${s.typ === 'fahrt' ? 'Fahrtkosten' : s.typ === 'hotel' ? 'Übernachtung' : 'Spesen'}${s.kommentar ? ` – ${s.kommentar}` : ''} (${new Date((s.datum || '') + 'T12:00:00').toLocaleDateString('de-DE')})`, menge: 1, einheit: 'psch', ep: s.betrag })
    }
    // Bewusst KEINE Blockade bei leerer Auswahl: im nächsten Schritt lassen sich
    // freie Positionen ergänzen – eine Rechnung ist also immer möglich.
    setFehler('')
    setPositionen(pos)
    setTitel(`Abschlagsrechnung ${projekt?.name || ''}`)
    setZeitraum({ von: projekt?.startDatum || '', bis: heuteISO() })
    if (einbehaltProzent === null) setEinbehaltProzent(kunde?.sicherheitseinbehaltProzent ?? 0)
    setSchritt(3)
  }

  const netto = positionen.reduce((s, p) => s + (Number(p.menge) || 0) * (Number(p.ep) || 0), 0)
  const ist13b = (kunde?.ustModus || '13b') === '13b'
  const ust = ist13b ? 0 : netto * 0.19
  const brutto = netto + ust
  const einbehalt = brutto * ((Number(einbehaltProzent) || 0) / 100)
  const zahlbetrag = brutto - einbehalt
  const text13b = bausteine.find((b) => b.id === 'bs-13b')?.text
    || 'Der Rechnungsbetrag versteht sich netto. Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.'

  async function speichern(uebertragen) {
    if (!positionen.length) return
    setLaeuft(true)
    setFehler('')
    try {
      const id = crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}`
      const rechnung = {
        id, projektId, kundeId: kunde?.id || '', titel,
        leistungszeitraum: zeitraum,
        positionen: positionen.map((p) => ({ ...p, menge: Number(p.menge) || 0, ep: Number(p.ep) || 0, gesamt: rund((Number(p.menge) || 0) * (Number(p.ep) || 0)) })),
        netto: rund(netto), einbehaltProzent: Number(einbehaltProzent) || 0,
        einbehaltBetrag: rund(einbehalt), zahlbetrag: rund(zahlbetrag),
        fastbillInvoiceId: '', fastbillNummer: '', dokumentUrl: '',
        status: 'vorbereitet', createdAt: Date.now(), uebertragenAm: 0,
      }
      await withStore(async (s) => {
        await s.add('rechnungen', rechnung)
        // Quellen fortschreiben
        for (const p of rechnung.positionen) {
          if (p.quelle === 'lv') {
            const lv = lvAlle.find((x) => x.id === p.quelleId)
            if (lv) await s.update('lvpositionen', lv.id, { abgerechnetMenge: rund((lv.abgerechnetMenge || 0) + p.menge) })
          }
        }
        const regieIds = [...new Set(rechnung.positionen.filter((p) => p.quelle === 'regie' || p.quelle === 'material').map((p) => p.quelleId))]
        for (const bid of regieIds) await s.update('berichte', bid, { status: 'abgerechnet' })
        const spesenIds = [...new Set(rechnung.positionen.filter((p) => p.quelle === 'spesen').map((p) => p.quelleId))]
        for (const sid of spesenIds) await s.update('spesen', sid, { status: 'erstattet' })
      })

      if (uebertragen) {
        let aktKunde = kunde
        // Ohne Kunde kann FastBill keine Rechnung anlegen – Entwurf bleibt erhalten.
        if (!aktKunde) {
          setFehler('Dem Projekt ist kein Kunde zugeordnet – die Rechnung wurde lokal als „vorbereitet" gespeichert. Kunde im Projekt hinterlegen, dann in der Abrechnung übertragen.')
          setLaeuft(false)
          return
        }
        if (!aktKunde.fastbillCustomerId) {
          const r = await syncKunde(aktKunde)
          if (r.simuliert) {
            setFehler('Simuliert – kein FastBill-Zugang hinterlegt (Einstellungen → FastBill). Rechnung wurde lokal als "vorbereitet" gespeichert.')
            setLaeuft(false)
            return
          }
          aktKunde = { ...aktKunde, fastbillCustomerId: String(r.customerId) }
        }
        const erg = await erstelleFastbillRechnung(rechnung, aktKunde, ist13b ? text13b : '')
        if (erg.simuliert) {
          setFehler('Simuliert – kein FastBill-Zugang hinterlegt. Rechnung wurde lokal gespeichert.')
          setLaeuft(false)
          return
        }
        await withStore((s) => s.update('rechnungen', id, {
          fastbillInvoiceId: erg.invoiceId, status: 'uebertragen', uebertragenAm: Date.now(),
        }))
      }
      onClose()
    } catch (e) {
      setFehler(`${e.message} – Rechnung wurde lokal gespeichert (Status "vorbereitet"), Übertragung kann in der Abrechnung wiederholt werden.`)
      setLaeuft(false)
    }
  }

  const feld = 'rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'

  return (
    <Modal titel={`Rechnung erstellen ${schritt}/3`} onClose={onClose} breite="max-w-4xl">
      {schritt === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Für welches Projekt soll abgerechnet werden?</p>
          {projekte.map((p) => {
            const k = patients.find((x) => x.id === p.kundeId)
            return (
              <button key={p.id} onClick={() => { projektWaehlen(p.id); setSchritt(2) }}
                className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-praxis-500 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold">{p.nummer} · {p.name}</p>
                  <p className="text-sm text-slate-500">{k?.firma || `${k?.vorname || ''} ${k?.nachname || ''}`}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${k?.ustModus === 'ust19' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {k?.ustModus === 'ust19' ? '19 % USt' : '§13b netto'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {schritt === 2 && (
        <div className="space-y-5">
          <p className="text-sm text-slate-500">
            <strong>{projekt?.nummer} · {projekt?.name}</strong> — Quellen auswählen:
          </p>

          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-slate-700">Leistungen aus dem Leistungsverzeichnis ({lvOffen.length})</p>
              {lvOffen.length > 0 && (
                <button
                  onClick={() => setGewaehltLv(Object.fromEntries(lvOffen.map((p) => [p.id, sollOffenVon(p)])))}
                  className="text-xs font-semibold text-praxis-700 hover:underline"
                >
                  Alles offene übernehmen (Soll)
                </button>
              )}
            </div>
            {lvOffen.length === 0 ? (
              <p className="text-sm text-slate-400">
                Für dieses Projekt ist im Leistungsverzeichnis nichts mehr offen – oder es wurde noch kein LV erfasst.
                Regieberichte und Spesen unten lassen sich trotzdem abrechnen, ebenso freie Positionen im nächsten Schritt.
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-2">
                  Vorbelegt ist die vom Monteur gemeldete Menge. Ohne Meldung steht 0 – die Menge kann hier
                  jederzeit selbst eingetragen werden (bis zur vertraglichen Restmenge).
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[680px]">
                    <thead><tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                      <th className="py-2 pr-2"></th><th className="py-2 pr-2">OZ</th><th className="py-2 pr-2">Kurztext</th>
                      <th className="py-2 pr-2 text-right"><FeldLabel info={HINWEIS.rechnungMonteur}>Monteur</FeldLabel></th>
                      <th className="py-2 pr-2 text-right"><FeldLabel info={HINWEIS.rechnungRest}>Rest lt. LV</FeldLabel></th>
                      <th className="py-2 pr-2 text-right"><FeldLabel info={HINWEIS.rechnungAbrechnen}>Abrechnen</FeldLabel></th><th className="py-2 pr-2">ME</th>
                      <th className="py-2 pr-2 text-right">EP</th><th className="py-2 text-right">Betrag</th>
                    </tr></thead>
                    <tbody>
                      {lvOffen.map((p) => {
                        const istOffen = istOffenVon(p)
                        const sollOffen = sollOffenVon(p)
                        const grenze = grenzeVon(p)
                        const menge = lvAuswahl[p.id] ?? istOffen
                        const ueberIst = Number(menge) > istOffen
                        return (
                          <tr key={p.id} className="border-b border-slate-50">
                            <td className="py-1.5 pr-2">
                              <input type="checkbox" checked={Number(menge) > 0}
                                onChange={(e) => setGewaehltLv({ ...lvAuswahl, [p.id]: e.target.checked ? (istOffen || sollOffen) : 0 })} />
                            </td>
                            <td className="py-1.5 pr-2 text-slate-400 whitespace-nowrap">{p.oz}</td>
                            <td className="py-1.5 pr-2">{p.kurztext}</td>
                            <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                              {istOffen > 0 ? (
                                <span className="text-emerald-700 font-medium" title={`Vom Monteur gemeldet${p.istVon ? ` (${p.istVon})` : ''}`}>
                                  {istOffen}
                                </span>
                              ) : (
                                <span className="text-slate-300" title="Noch keine Ist-Meldung vom Monteur">–</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-2 text-right text-slate-500 whitespace-nowrap">{sollOffen}</td>
                            <td className="py-1.5 pr-2 text-right">
                              <input type="number" step="0.001" min="0" max={grenze} value={menge}
                                onChange={(e) => setGewaehltLv({ ...lvAuswahl, [p.id]: Math.min(Number(e.target.value) || 0, grenze) })}
                                className={`${feld} !w-24 text-right ${ueberIst ? 'border-amber-300 bg-amber-50' : ''}`}
                                title={ueberIst ? 'Mehr als vom Monteur gemeldet' : ''} />
                            </td>
                            <td className="py-1.5 pr-2">{p.einheit}</td>
                            <td className="py-1.5 pr-2 text-right">{euro(p.einheitspreis)}</td>
                            <td className="py-1.5 text-right font-medium">{euro((Number(menge) || 0) * (p.einheitspreis || 0))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {lvOffen.some((p) => Number(lvAuswahl[p.id] ?? istOffenVon(p)) > istOffenVon(p)) && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Gelb markierte Zeilen liegen über der vom Monteur gemeldeten Menge – bitte vor dem Übertragen prüfen.
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">Freigegebene Regieberichte ({regieFrei.length})</p>
            {regieFrei.length === 0 ? <p className="text-sm text-slate-400">Keine freigegebenen Regieberichte. (Berichte müssen erst freigegeben werden.)</p> :
              regieFrei.map((b) => {
                const summe = (b.stunden || []).reduce((s, z) => s + z.anzahl * z.satz, 0) + (b.material || []).reduce((s, m) => s + m.menge * m.preis, 0)
                return (
                  <label key={b.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 mb-2 cursor-pointer">
                    <input type="checkbox" checked={Boolean(gewaehltRegie[b.id])}
                      onChange={(e) => setGewaehltRegie({ ...gewaehltRegie, [b.id]: e.target.checked })} />
                    <span className="flex-1 text-sm">{new Date((b.datum || '') + 'T12:00:00').toLocaleDateString('de-DE')} · {b.mitarbeiterName} · {b.beschreibung?.slice(0, 60)}</span>
                    <span className="text-sm font-bold">{euro(summe)}</span>
                  </label>
                )
              })}
          </div>

          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">Eingereichte Spesen ({spesenOffen.length})</p>
            {spesenOffen.length === 0 ? <p className="text-sm text-slate-400">Keine offenen Spesen.</p> :
              spesenOffen.map((s) => (
                <label key={s.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 mb-2 cursor-pointer">
                  <input type="checkbox" checked={Boolean(gewaehltSpesen[s.id])}
                    onChange={(e) => setGewaehltSpesen({ ...gewaehltSpesen, [s.id]: e.target.checked })} />
                  <span className="flex-1 text-sm">{s.typ === 'fahrt' ? 'Fahrt' : s.typ === 'hotel' ? 'Hotel' : 'Spesen'} · {s.mitarbeiterName || ''} {s.kommentar ? `· ${s.kommentar}` : ''}</span>
                  <span className="text-sm font-bold">{euro(s.betrag)}</span>
                </label>
              ))}
          </div>

          {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          <div className="flex justify-between pt-2 border-t border-slate-100">
            {!projektIdVorbelegt ? (
              <button onClick={() => setSchritt(1)} className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100">← Projekt</button>
            ) : <span />}
            <button onClick={zuSchritt3} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-praxis-600 text-white hover:bg-praxis-700">Weiter zur Vorschau →</button>
          </div>
        </div>
      )}

      {schritt === 3 && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1"><FeldLabel info={HINWEIS.rechnungTitel}>Titel</FeldLabel></label>
              <input type="text" className={`${feld} w-full`} value={titel} onChange={(e) => setTitel(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1"><FeldLabel info={HINWEIS.rechnungZeitraum}>Leistungszeitraum von</FeldLabel></label>
              <input type="date" className={`${feld} w-full`} value={zeitraum.von} onChange={(e) => setZeitraum((z) => ({ ...z, von: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">bis</label>
              <input type="date" className={`${feld} w-full`} value={zeitraum.bis} onChange={(e) => setZeitraum((z) => ({ ...z, bis: e.target.value }))} />
            </div>
          </div>

          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
              <th className="py-2 pr-2">OZ</th><th className="py-2 pr-2">Text</th><th className="py-2 pr-2 text-right">Menge</th>
              <th className="py-2 pr-2">ME</th><th className="py-2 pr-2 text-right">EP</th><th className="py-2 pr-2 text-right">Betrag</th><th></th>
            </tr></thead>
            <tbody>
              {positionen.map((p, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1.5 pr-2 text-slate-400 text-xs">{p.oz}</td>
                  <td className="py-1.5 pr-2">
                    <input type="text" className={`${feld} w-full`} value={p.text}
                      onChange={(e) => setPositionen((ps) => ps.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <input type="number" step="0.001" className={`${feld} !w-24 text-right`} value={p.menge}
                      onChange={(e) => setPositionen((ps) => ps.map((x, j) => j === i ? { ...x, menge: e.target.value } : x))} />
                  </td>
                  <td className="py-1.5 pr-2">{p.einheit}</td>
                  <td className="py-1.5 pr-2 text-right">
                    <input type="number" step="0.01" className={`${feld} !w-24 text-right`} value={p.ep}
                      onChange={(e) => setPositionen((ps) => ps.map((x, j) => j === i ? { ...x, ep: e.target.value } : x))} />
                  </td>
                  <td className="py-1.5 pr-2 text-right font-medium">{euro((Number(p.menge) || 0) * (Number(p.ep) || 0))}</td>
                  <td className="py-1.5 text-right">
                    <button onClick={() => setPositionen((ps) => ps.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setPositionen((ps) => [...ps, { quelle: 'frei', quelleId: '', oz: '', text: '', menge: 1, einheit: 'psch', ep: 0 }])}
            className="text-sm text-praxis-600 font-medium">+ Freie Position</button>
          <InfoHinweis text={HINWEIS.rechnungFrei} />

          <div className="bg-slate-50 rounded-2xl p-4 text-sm space-y-1.5">
            <div className="flex justify-between"><span>Nettobetrag</span><strong>{euro(netto)}</strong></div>
            {ist13b ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">{text13b}</p>
            ) : (
              <>
                <div className="flex justify-between"><span>zzgl. 19 % USt</span><span>{euro(ust)}</span></div>
                <div className="flex justify-between font-bold"><span>Brutto</span><span>{euro(brutto)}</span></div>
              </>
            )}
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><FeldLabel info={HINWEIS.rechnungEinbehalt}>Sicherheitseinbehalt</FeldLabel>
                <input type="number" step="1" min="0" max="20" className={`${feld} !w-16 text-right`} value={einbehaltProzent ?? 0}
                  onChange={(e) => setEinbehaltProzent(e.target.value)} /> %
              </span>
              <span>− {euro(einbehalt)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-1.5"><span>Zahlbetrag</span><span>{euro(zahlbetrag)}</span></div>
          </div>

          {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{fehler}</p>}

          <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setSchritt(2)} className="px-4 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100">← Quellen</button>
            <div className="flex gap-2">
              <button onClick={() => speichern(false)} disabled={laeuft}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                Als Entwurf speichern
              </button>
              <button onClick={() => speichern(true)} disabled={laeuft}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-praxis-600 text-white hover:bg-praxis-700 disabled:opacity-50">
                {laeuft ? 'Übertrage …' : 'Speichern + an FastBill übertragen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
