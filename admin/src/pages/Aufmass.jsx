import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLang, t } from '@shared/i18n.js'
import * as S from '../stil.js'
import { Seitenkopf, ChipReihe, Leer, Meldung } from '../components/Seite.jsx'
import Modal from '../components/Modal.jsx'
import { Icon } from '@shared/ui.jsx'
import { useCollection, useWhere, useEinstellungen, withStore } from '../hooks.js'
import { istOffen } from '@shared/projektstatus.js'
import { euro, parseZahl } from '@shared/format.js'
import { heuteISO } from '@shared/slots.js'
import { regelwerkVon, zahlText } from '@shared/aufmass.js'
import {
  positionsUebersicht, alleBestaetigenBauen, zeileNachmessenBauen,
  zeilenFuerRechnung, rechnungslaufAnlegen, naechsteEtappe, rechnungAusLauf,
  steuerSchnappschuss, einbehaltBauen, aufgabenOhneAnkuendigung, ankuendigungBauen,
} from '@shared/abrechnung.js'
import { druckeAufmassblatt, druckeNachtragsankuendigung } from '../drucken.js'

// Aufmaß-Ansicht des Büros (Plan 3.2 + Kapitel 8): je LV-Position
// Vertrag / Aufmaß / Abgerechnet + Abweichung in %, aufklappbar bis zur
// einzelnen Zeile mit Formeltext. Geschätzte Zeilen sind ROT und für die
// Rechnung GESPERRT; „Alle bestätigen“ erfasst nur gemessene Zeilen unter
// 10 % Abweichung. Von hier starten Aufmaßblatt-PDF (§ 14 Abs. 1),
// Nachtragsankündigung (§ 2 Abs. 6) und der wiederaufnehmbare Rechnungslauf.

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const STAND_BADGE = {
  geschaetzt: 'bg-red-100 text-red-700',
  gemessen: 'bg-sky-100 text-sky-700',
  bestaetigt: 'bg-emerald-100 text-emerald-700',
  abgerechnet: 'bg-gedeckt-tief text-schrift-leise',
}

function zeilenStand(z) {
  if (z.abgerechnetIn) return 'abgerechnet'
  if (z.geschaetzt) return 'geschaetzt'
  if (z.bestaetigtAm) return 'bestaetigt'
  return 'gemessen'
}

// ---------- Modal: geschätzte Zeile nachmessen (verlangt WER und WANN) ----------
function NachmessenModal({ zeile, user, onClose, onMeldung }) {
  const [menge, setMenge] = useState(String(zeile.menge ?? ''))
  const [ansatz, setAnsatz] = useState(zeile.ansatz || '')
  const [gemessenVon, setGemessenVon] = useState(user?.name || '')
  const [gemessenAm, setGemessenAm] = useState(heuteISO())
  const [fehler, setFehler] = useState('')

  async function speichern() {
    try {
      const patch = zeileNachmessenBauen(zeile, {
        menge: parseZahl(menge), ansatz, gemessenVon, gemessenAm,
        userId: user?.userId || user?.id || '',
      })
      await withStore((s) => s.schreibeVorgang({ patches: [patch] }))
      onMeldung({ art: 'ok', text: t('am.nachgemessenOk') })
      onClose()
    } catch (e) {
      setFehler(e.message)
    }
  }

  return (
    <Modal titel={t('am.nachmessen')} icon="lv" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-schrift-leise">{zeile.bauteil || zeile.raumName} · {zeile.kurztext}</p>
        <div>
          <p className={S.LABEL}>{t('am.menge')} ({zeile.einheit || 'm²'})</p>
          <input type="text" inputMode="decimal" dir="ltr" className={S.FELD} value={menge} onChange={(e) => setMenge(e.target.value)} />
        </div>
        <div>
          <p className={S.LABEL}>{t('am.ansatz')}</p>
          <input type="text" dir="ltr" className={S.FELD} value={ansatz} onChange={(e) => setAnsatz(e.target.value)} placeholder="18,20 × 2,62" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={S.LABEL}>{t('am.gemessenVon')}</p>
            <input type="text" className={S.FELD} value={gemessenVon} onChange={(e) => setGemessenVon(e.target.value)} />
          </div>
          <div>
            <p className={S.LABEL}>{t('am.gemessenAm')}</p>
            <input type="date" className={S.FELD} value={gemessenAm} onChange={(e) => setGemessenAm(e.target.value)} />
          </div>
        </div>
        <p className="text-[12px] text-schrift-zart">{t('am.nachmessenPflicht')}</p>
        {fehler && <Meldung art="gefahr">{fehler}</Meldung>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={S.BTN_STILL}>{t('allg.abbrechen')}</button>
          <button onClick={speichern} className={S.BTN_PRIMAER}>{t('allg.speichern')}</button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- Modal: Rechnungslauf (Plan 8.7 – wiederaufnehmbar) ----------
function RechnungslaufModal({ projekt, kunde, zeilen, positionen, lauf, text13b, user, onClose, onMeldung }) {
  const { frei, gesperrt } = useMemo(() => zeilenFuerRechnung(zeilen), [zeilen])
  const [einbehaltProzent, setEinbehaltProzent] = useState(kunde?.sicherheitseinbehaltProzent ?? 0)
  const [laeuft, setLaeuft] = useState(false)
  const [stand, setStand] = useState('')
  const [fehler, setFehler] = useState('')

  // Vorschau: Summe je Position aus den freien Zeilen (bei Wiederaufnahme
  // aus den bereits markierten des Laufs – die Menge steht ja schon fest).
  const basis = lauf ? zeilen.filter((z) => z.abgerechnetIn === lauf.rechnungId && !z.storniert) : frei
  const vorschau = useMemo(() => positionsUebersicht({ zeilen: basis, positionen })
    .filter((g) => g.positionId), [basis, positionen])
  const netto = Math.round(vorschau.reduce((s, g) => s + g.aufmass * g.einheitspreis, 0) * 100) / 100
  // Ohne Kunden/ustModus wird NICHT geraten (steuerSchnappschuss wirft) –
  // der Lauf ist gesperrt, bis der Kunde am Projekt gepflegt ist.
  const kundeFehlt = kunde?.ustModus !== '13b' && kunde?.ustModus !== 'ust19'
  const steuer = kundeFehlt
    ? { ustModus: '', ustSatz: 0, ustBetrag: 0, brutto: netto, rechtstext13b: '' }
    : steuerSchnappschuss({ kunde, netto, text13b })
  const einbehalt = Math.round(steuer.brutto * (parseZahl(einbehaltProzent) / 100) * 100) / 100

  async function ausfuehren() {
    setLaeuft(true)
    setFehler('')
    try {
      let aktuellerLauf = lauf
      if (!aktuellerLauf) {
        aktuellerLauf = rechnungslaufAnlegen({
          projektId: projekt.id, zeilen: frei, laufId: `lauf-${uuid()}`, rechnungId: uuid(),
        })
        // Schritt 1: ERST der Lauf – bricht danach etwas ab, ist er wiederaufnehmbar.
        await withStore((s) => s.schreibeVorgang({ sets: [{ coll: 'rechnungslaeufe', daten: aktuellerLauf }] }))
      }
      // Schritt 2: Etappen zu je 400 – idempotent, markierte Zeilen werden übersprungen.
      let aktuelleZeilen = await withStore((s) => s.listWhere('aufmasszeilen', 'projektId', projekt.id))
      let fertig = false
      let schutz = 0
      while (!fertig && schutz < 200) {
        schutz += 1
        const etappe = naechsteEtappe(aktuellerLauf, aktuelleZeilen)
        if (etappe.patches.length) {
          await withStore((s) => s.schreibeVorgang({
            patches: [...etappe.patches, { coll: 'rechnungslaeufe', id: aktuellerLauf.id, patch: etappe.laufPatch }],
          }))
          const markiert = new Set(etappe.patches.map((p) => p.id))
          aktuelleZeilen = aktuelleZeilen.map((z) => (markiert.has(z.id)
            ? { ...z, abgerechnetIn: aktuellerLauf.rechnungId, abgerechnetAm: Date.now() } : z))
          setStand(t('rl.laeuftStand', {
            fertig: aktuellerLauf.zeilenIds.length - etappe.offenDanach.length,
            gesamt: aktuellerLauf.zeilenIds.length,
          }))
        }
        fertig = etappe.fertig
      }
      // Schritt 3: ERST wenn offen == 0 entsteht die Rechnung – mit Steuer-
      // Schnappschuss, Einbehalt (inkl. Fälligkeit) und Kennzahl in EINEM Vorgang.
      const { rechnung, kennzahlen } = rechnungAusLauf({
        lauf: aktuellerLauf,
        zeilen: aktuelleZeilen,
        positionen,
        projekt,
        kunde,
        einbehaltProzent: parseZahl(einbehaltProzent),
        text13b,
        regelwerk: regelwerkVon(projekt?.abrechnungsregel),
      })
      const einbehaltDoc = einbehaltBauen({ rechnung, kunde })
      await withStore((s) => s.schreibeVorgang({
        sets: [
          { coll: 'rechnungen', daten: rechnung },
          ...(einbehaltDoc ? [{ coll: 'einbehalte', daten: einbehaltDoc }] : []),
        ],
        patches: [{ coll: 'rechnungslaeufe', id: aktuellerLauf.id, patch: { status: 'fertig', beendetAm: Date.now() } }],
        kennzahlen,
      }))
      onMeldung({
        art: 'ok',
        text: t('rl.fertigOk', { n: rechnung.zeilenAnzahl, betrag: euro(rechnung.zahlbetrag) })
          + (einbehaltDoc ? ` ${t('rl.einbehaltOk', { betrag: euro(einbehaltDoc.betrag), datum: einbehaltDoc.faelligAm })}` : ''),
      })
      onClose()
    } catch (e) {
      setFehler(t('rl.fehlerFortsetzbar', { text: e.message }))
      setLaeuft(false)
    }
  }

  const keineZeilen = !lauf && frei.length === 0

  return (
    <Modal titel={lauf ? t('rl.titelFortsetzen') : t('rl.titel')} icon="euro" onClose={laeuft ? undefined : onClose} breite="max-w-2xl">
      <div className="space-y-4">
        {lauf && <Meldung art="warnung">{t('rl.laufOffenHinweis', { n: (lauf.offen || []).length })}</Meldung>}

        <div className="text-sm space-y-1">
          <p><strong>{t('rl.bereit', { n: lauf ? basis.length : frei.length })}</strong></p>
          {(gesperrt.geschaetzt > 0 || gesperrt.unbestaetigt > 0 || gesperrt.ohnePosition > 0) && (
            <p className="text-schrift-leise">
              {gesperrt.geschaetzt > 0 && <span className="text-red-600 me-3">{t('rl.gesperrtGeschaetzt', { n: gesperrt.geschaetzt })}</span>}
              {gesperrt.unbestaetigt > 0 && <span className="me-3">{t('rl.gesperrtUnbestaetigt', { n: gesperrt.unbestaetigt })}</span>}
              {gesperrt.ohnePosition > 0 && <span className="text-amber-700">{t('rl.gesperrtOhnePosition', { n: gesperrt.ohnePosition })}</span>}
            </p>
          )}
        </div>

        {vorschau.length > 0 && (
          <div className={S.TAB_HUELLE}>
            <div className={S.TAB_SCROLL}>
              <table className={S.TAB}>
                <thead><tr>
                  <th className={S.TH}>{t('lv.oz')}</th><th className={S.TH}>{t('einst.text')}</th>
                  <th className={`${S.TH} text-right`}>{t('allg.menge')}</th>
                  <th className={`${S.TH} text-right`}>EP</th><th className={`${S.TH} text-right`}>{t('allg.betrag')}</th>
                </tr></thead>
                <tbody>
                  {vorschau.map((g) => (
                    <tr key={g.positionId} className="border-b border-rahmen last:border-0">
                      <td className={S.TD}>{g.oz}</td>
                      <td className={S.TD}>{g.kurztext}</td>
                      <td className={`${S.TD} text-right`} dir="ltr">{zahlText(g.aufmass)} {g.einheit}</td>
                      <td className={`${S.TD} text-right`}>{euro(g.einheitspreis)}</td>
                      <td className={`${S.TD} text-right font-medium`}>{euro(g.aufmass * g.einheitspreis)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-gedeckt rounded-karte p-4 text-sm space-y-1.5">
          <div className="flex justify-between"><span>{t('rw.netto')}</span><strong>{euro(netto)}</strong></div>
          {steuer.ustModus === '13b' ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-feld px-2.5 py-1.5">{steuer.rechtstext13b}</p>
          ) : (
            <>
              <div className="flex justify-between"><span>{t('rw.zzglUst')} ({steuer.ustSatz} %)</span><span>{euro(steuer.ustBetrag)}</span></div>
              <div className="flex justify-between font-bold"><span>{t('rw.brutto')}</span><span>{euro(steuer.brutto)}</span></div>
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-2">{t('rw.einbehalt')}
              <input type="number" step="1" min="0" max="20" className={`${S.FELD_S} !w-16 text-right`} value={einbehaltProzent}
                onChange={(e) => setEinbehaltProzent(e.target.value)} /> %
            </span>
            <span>− {euro(einbehalt)}</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t border-rahmen pt-1.5">
            <span>{t('rw.zahlbetrag')}</span><span>{euro(steuer.brutto - einbehalt)}</span>
          </div>
        </div>

        {parseZahl(einbehaltProzent) > 0 && (
          <p className="text-[12px] text-schrift-leise">{t('rl.buergschaftHinweis')}</p>
        )}

        {stand && <Meldung art="info">{stand}</Meldung>}
        {fehler && <Meldung art="gefahr">{fehler}</Meldung>}
        {keineZeilen && <Meldung art="warnung">{t('rl.keineZeilen')}</Meldung>}
        {kundeFehlt && <Meldung art="gefahr">{t('rl.kundeFehlt')}</Meldung>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} disabled={laeuft} className={S.BTN_STILL}>{t('allg.abbrechen')}</button>
          <button onClick={ausfuehren} disabled={laeuft || keineZeilen || kundeFehlt} className={S.BTN_PRIMAER}>
            {laeuft ? t('rl.laeuft') : lauf ? t('rl.fortsetzen') : t('rl.starten')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- Seite ----------
export default function Aufmass({ user }) {
  useLang()
  const [params, setParams] = useSearchParams()
  const projekte = useCollection('projekte')
  const patients = useCollection('patients')
  const lvAlle = useCollection('lvpositionen')
  const bausteine = useCollection('bausteine')
  const einst = useEinstellungen()
  const offene = useMemo(() => projekte.filter((p) => istOffen(p.status)), [projekte])
  const [projektId, setProjektId] = useState(params.get('projekt') || '')
  const [auf, setAuf] = useState(() => new Set())
  const [meldung, setMeldung] = useState(null)
  const [nachmessen, setNachmessen] = useState(null)
  const [rechnungslauf, setRechnungslauf] = useState(false)

  useEffect(() => {
    if (!projektId && offene.length) setProjektId(offene[0].id)
  }, [offene, projektId])

  const projekt = projekte.find((p) => p.id === projektId)
  const kunde = patients.find((k) => k.id === projekt?.kundeId)
  const zeilen = useWhere('aufmasszeilen', 'projektId', projektId)
  const aufgaben = useWhere('aufgaben', 'projektId', projektId)
  const laeufe = useWhere('rechnungslaeufe', 'projektId', projektId)
  const offenerLauf = laeufe.find((l) => l.status === 'laeuft') || null
  const positionen = useMemo(() => lvAlle.filter((p) => p.projektId === projektId && p.typ === 'position'), [lvAlle, projektId])
  const text13b = bausteine.find((b) => b.id === 'bs-13b')?.text || ''

  const rw = regelwerkVon(projekt?.abrechnungsregel)
  const uebersicht = useMemo(() => positionsUebersicht({ zeilen, positionen }), [zeilen, positionen])
  const ohneAnkuendigung = useMemo(() => aufgabenOhneAnkuendigung(aufgaben), [aufgaben])
  const geschaetztGesamt = zeilen.filter((z) => !z.storniert && z.geschaetzt).length
  const aktiveZeilen = zeilen.filter((z) => !z.storniert).length
  const { frei } = useMemo(() => zeilenFuerRechnung(zeilen), [zeilen])

  function klappe(id) {
    setAuf((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })
  }

  async function alleBestaetigen() {
    try {
      const erg = alleBestaetigenBauen({ zeilen, positionen, userId: user?.userId || user?.id || '' })
      if (!erg.patches.length) {
        setMeldung({ art: 'warnung', text: t('am.nichtsZuBestaetigen') })
        return
      }
      // In Etappen unter der Batch-Grenze – wie der Rechnungslauf.
      for (let i = 0; i < erg.patches.length; i += 400) {
        await withStore((s) => s.schreibeVorgang({ patches: erg.patches.slice(i, i + 400) }))
      }
      setMeldung({
        art: 'ok',
        text: t('am.bestaetigtOk', { n: erg.bestaetigt })
          + (erg.uebersprungenGeschaetzt ? ` ${t('am.uebersprungenGeschaetzt', { n: erg.uebersprungenGeschaetzt })}` : '')
          + (erg.uebersprungenAbweichung ? ` ${t('am.uebersprungenAbweichung', { n: erg.uebersprungenAbweichung })}` : ''),
      })
    } catch (e) {
      setMeldung({ art: 'gefahr', text: e.message })
    }
  }

  async function ankuendigungErzeugen() {
    try {
      const vorgang = ankuendigungBauen(aufgaben, { projektId, userId: user?.userId || user?.id || '' })
      druckeNachtragsankuendigung({ projekt, kunde, aufgaben: vorgang.betroffen, einst })
      await withStore((s) => s.schreibeVorgang({ patches: vorgang.patches, kennzahlen: vorgang.kennzahlen }))
      setMeldung({ art: 'ok', text: t('am.angekuendigtOk', { n: vorgang.betroffen.length }) })
    } catch (e) {
      setMeldung({ art: 'gefahr', text: e.message })
    }
  }

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="lv" titel={t('nav.aufmass')} sub={t('am.sub')}>
        <button onClick={() => druckeAufmassblatt({ projekt, kunde, gruppen: uebersicht, regelwerk: rw, einst })}
          disabled={!uebersicht.length} className={S.BTN_ZWEIT}>
          <Icon name="drucken" groesse="s" /> {t('am.pdf')}
        </button>
        <button onClick={() => setRechnungslauf(true)} disabled={!projekt} className={S.BTN_PRIMAER}>
          <Icon name="euro" groesse="s" /> {offenerLauf ? t('rl.fortsetzen') : t('am.abrechnen', { n: frei.length })}
        </button>
      </Seitenkopf>

      <div className="mb-4">
        <ChipReihe
          chips={offene.map((p) => ({ id: p.id, label: p.name }))}
          aktiv={projektId}
          onWahl={(id) => { setProjektId(id); setAuf(new Set()); setMeldung(null); setParams({ projekt: id }, { replace: true }) }}
        />
      </div>

      {meldung && <div className="mb-4"><Meldung art={meldung.art}>{meldung.text}</Meldung></div>}

      {projekt && !rw && (
        <div className="mb-4"><Meldung art="gefahr">{t('am.regelwerkFehlt')}</Meldung></div>
      )}
      {rw && (
        <p className="mb-4 text-[12px] text-schrift-leise">
          <strong>{t('am.regelwerk')}:</strong> {rw.name} · {rw.klartext}
        </p>
      )}

      {offenerLauf && (
        <div className="mb-4"><Meldung art="warnung">{t('rl.laufOffenHinweis', { n: (offenerLauf.offen || []).length })}</Meldung></div>
      )}

      {ohneAnkuendigung.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-karte border border-red-200 bg-red-50 px-4 py-3">
          <Icon name="alert" className="w-5 h-5 text-red-600 shrink-0" />
          <p className="flex-1 min-w-[220px] text-sm text-red-700">{t('am.ohnePosition', { n: ohneAnkuendigung.length })}</p>
          <button onClick={ankuendigungErzeugen} className={S.BTN_GEFAHR}>{t('am.ankuendigungErzeugen')}</button>
        </div>
      )}

      {aktiveZeilen > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-schrift-leise">
            {t('am.alleBestaetigenHinweis', { alle: aktiveZeilen, geschaetzt: geschaetztGesamt })}
          </p>
          <button onClick={alleBestaetigen} className={S.BTN_ZWEIT_S}>{t('am.alleBestaetigen')}</button>
        </div>
      )}

      {uebersicht.length === 0 ? (
        <div className={S.KARTE}>
          <Leer icon="lv" titel={t('am.keineZeilen')} text={t('am.keineZeilenText')} />
        </div>
      ) : (
        <div className={S.TAB_HUELLE}>
          <div className={S.TAB_SCROLL}>
            <table className={S.TAB}>
              <thead>
                <tr>
                  <th className={S.TH}></th>
                  <th className={S.TH}>{t('lv.oz')}</th>
                  <th className={S.TH}>{t('lv.kurztext')}</th>
                  <th className={`${S.TH} text-right`}>{t('am.vertrag')}</th>
                  <th className={`${S.TH} text-right`}>{t('am.aufmassSp')}</th>
                  <th className={`${S.TH} text-right`}>{t('am.abgerechnet')}</th>
                  <th className={`${S.TH} text-right`}>{t('am.abweichung')}</th>
                </tr>
              </thead>
              <tbody>
                {uebersicht.map((g) => {
                  const key = g.positionId || 'ohne'
                  const offen = auf.has(key)
                  return [
                    <tr key={key} onClick={() => klappe(key)} className="border-b border-rahmen cursor-pointer hover:bg-praxis-50/60">
                      <td className={S.TD}><Icon name={offen ? 'chevronUnten' : 'chevronRechts'} className="w-4 h-4 text-schrift-zart" /></td>
                      <td className={S.TD}>{g.oz || <span className="text-red-600 font-bold">{t('am.ohneOz')}</span>}</td>
                      <td className={S.TD_STARK}>
                        {g.kurztext}
                        {g.geschaetztAnzahl > 0 && (
                          <span className="ms-2 text-[11px] font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-700">
                            {t('am.geschaetztBadge', { n: g.geschaetztAnzahl })}
                          </span>
                        )}
                      </td>
                      <td className={`${S.TD} text-right`} dir="ltr">{g.vertrag > 0 ? `${zahlText(g.vertrag)} ${g.einheit}` : '–'}</td>
                      <td className={`${S.TD} text-right font-medium`} dir="ltr">{zahlText(g.aufmass)} {g.einheit}</td>
                      <td className={`${S.TD} text-right`} dir="ltr">{g.abgerechnet > 0 ? `${zahlText(g.abgerechnet)} ${g.einheit}` : '–'}</td>
                      <td className={`${S.TD} text-right ${g.abweichung.ueberSchwelle ? 'text-red-600 font-bold' : ''}`} dir="ltr">
                        {g.vertrag > 0 ? `${g.abweichung.prozent > 0 ? '+' : ''}${zahlText(g.abweichung.prozent)} %` : '–'}
                      </td>
                    </tr>,
                    offen && (
                      <tr key={`${key}-detail`} className="border-b border-rahmen bg-gedeckt/60">
                        <td></td>
                        <td colSpan={6} className="px-3 py-2">
                          {g.abweichung.ueberSchwelle && (
                            <p className="mb-2 text-[12px] text-red-700">{g.abweichung.hinweis}</p>
                          )}
                          <table className="w-full text-[13px]">
                            <thead>
                              <tr className="text-left text-[11px] uppercase text-schrift-zart">
                                <th className="py-1 pe-2">{t('am.ort')}</th>
                                <th className="py-1 pe-2">{t('am.ansatz')}</th>
                                <th className="py-1 pe-2 text-right">{t('am.faktor')}</th>
                                <th className="py-1 pe-2 text-right">{t('am.menge')}</th>
                                <th className="py-1 pe-2">{t('am.stand')}</th>
                                <th className="py-1"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.zeilen.map((z) => {
                                const stand = zeilenStand(z)
                                return (
                                  <tr key={z.id} className={`border-t border-rahmen ${z.geschaetzt ? 'text-red-700' : ''}`}>
                                    <td className="py-1.5 pe-2">{z.bauteil || z.raumName}</td>
                                    <td className="py-1.5 pe-2" dir="ltr">{z.ansatz}</td>
                                    <td className="py-1.5 pe-2 text-right" dir="ltr">{z.faktor ?? 1}</td>
                                    <td className="py-1.5 pe-2 text-right" dir="ltr">{zahlText(z.menge)} {z.einheit}</td>
                                    <td className="py-1.5 pe-2">
                                      <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${STAND_BADGE[stand]}`}>
                                        {t(`am.stand_${stand}`)}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {z.geschaetzt && !z.abgerechnetIn && (
                                        <button onClick={() => setNachmessen(z)} className={S.BTN_ZWEIT_S}>{t('am.nachmessen')}</button>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {nachmessen && (
        <NachmessenModal zeile={nachmessen} user={user} onClose={() => setNachmessen(null)} onMeldung={setMeldung} />
      )}
      {rechnungslauf && projekt && (
        <RechnungslaufModal
          projekt={projekt} kunde={kunde} zeilen={zeilen} positionen={positionen}
          lauf={offenerLauf} text13b={text13b} user={user}
          onClose={() => setRechnungslauf(false)} onMeldung={setMeldung}
        />
      )}
    </div>
  )
}
