import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { useCollection, useEinstellungen, withStore } from '../hooks.js'
import RechnungWizard from '../components/RechnungWizard.jsx'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'
import {
  syncKunde, erstelleFastbillRechnung, schliesseRechnungAb,
  sendeRechnungPerMail, holeRechnungStatus,
} from '@shared/fastbill.js'
import { stornoBauen } from '@shared/abrechnung.js'

// Abrechnung: Rechnungs-Spiegel + FastBill-Aktionen.
// FastBill übernimmt Nummernvergabe, E-Rechnung, Versand und Mahnwesen –
// hier entstehen die Rechnungen aus LV-Mengen/Regie und werden übertragen.
// Artikel + Textbausteine werden in den Einstellungen gepflegt (Stammdaten).

const STATUS = {
  vorbereitet: { schluessel: 'abr.vorbereitet', farbe: 'bg-gedeckt-tief text-schrift' },
  uebertragen: { schluessel: 'abr.uebertragen', farbe: 'bg-sky-100 text-sky-700' },
  gestellt: { schluessel: 'abr.gestellt', farbe: 'bg-amber-100 text-amber-700' },
  bezahlt: { schluessel: 'abr.bezahlt', farbe: 'bg-emerald-100 text-emerald-700' },
  storniert: { schluessel: 'abr.storniert', farbe: 'bg-red-100 text-red-700' },
}

export default function Abrechnung() {
  useLang()
  const rechnungen = useCollection('rechnungen')
  const projekte = useCollection('projekte')
  const patients = useCollection('patients')
  const bausteine = useCollection('bausteine')
  const einst = useEinstellungen()
  const [filter, setFilter] = useState('alle')
  const [wizard, setWizard] = useState(false)
  const [laeuft, setLaeuft] = useState('')   // rechnungId der laufenden Aktion
  const [meldung, setMeldung] = useState(null) // {art:'ok'|'fehler'|'info', text}

  const projektVon = (id) => projekte.find((p) => p.id === id)
  const kundeVon = (id) => patients.find((k) => k.id === id)
  const text13b = bausteine.find((b) => b.id === 'bs-13b')?.text || ''

  const gefiltert = rechnungen
    .filter((r) => (filter === 'alle' ? true : r.status === filter))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  async function aktion(r, fn) {
    setLaeuft(r.id)
    setMeldung(null)
    try {
      await fn()
    } catch (e) {
      setMeldung({ art: 'fehler', text: e.message })
    } finally {
      setLaeuft('')
    }
  }

  async function uebertragen(r) {
    await aktion(r, async () => {
      let kunde = kundeVon(r.kundeId)
      if (!kunde) throw new Error('Kunde nicht gefunden.')
      if (!kunde.fastbillCustomerId) {
        const erg = await syncKunde(kunde)
        if (erg.simuliert) { setMeldung({ art: 'info', text: 'Simuliert – FastBill-Zugang fehlt (Einstellungen → FastBill).' }); return }
        kunde = { ...kunde, fastbillCustomerId: String(erg.customerId) }
      }
      // Steuer-SCHNAPPSCHUSS (Plan 8.8): V2-Aufmaßrechnungen tragen den beim
      // Rechnungslauf EINGEFRORENEN USt-Modus samt 13b-Text – die Übergabe
      // nutzt ausschließlich ihn, nie den Live-Stand des Kunden (der könnte
      // seit dem Lauf umgestellt worden sein). V1-Rechnungen wie bisher live.
      const hatSchnappschuss = r.ustModus === '13b' || r.ustModus === 'ust19'
      const ist13b = hatSchnappschuss
        ? r.ustModus === '13b'
        : (kunde.ustModus || '13b') === '13b'
      const intro = ist13b ? ((hatSchnappschuss && r.rechtstext13b) || text13b) : ''
      const erg = await erstelleFastbillRechnung(r, kunde, intro)
      if (erg.simuliert) { setMeldung({ art: 'info', text: 'Simuliert – FastBill-Zugang fehlt (Einstellungen → FastBill).' }); return }
      await withStore((s) => s.update('rechnungen', r.id, { fastbillInvoiceId: erg.invoiceId, status: 'uebertragen', uebertragenAm: Date.now() }))
      setMeldung({ art: 'ok', text: 'Rechnung liegt als Entwurf in FastBill.' })
    })
  }

  async function abgleichen(r) {
    await aktion(r, async () => {
      const erg = await holeRechnungStatus(r.fastbillInvoiceId)
      if (erg.simuliert) { setMeldung({ art: 'info', text: 'Simuliert – kein FastBill-Zugang.' }); return }
      if (erg.fehler) throw new Error(erg.fehler)
      await withStore((s) => s.update('rechnungen', r.id, {
        status: erg.status, fastbillNummer: erg.nummer || r.fastbillNummer, dokumentUrl: erg.dokumentUrl || r.dokumentUrl,
      }))
      setMeldung({ art: 'ok', text: `Status aus FastBill: ${STATUS[erg.status] ? t(STATUS[erg.status].schluessel) : erg.status}${erg.nummer ? ` · Nr. ${erg.nummer}` : ''}` })
    })
  }

  async function abschliessen(r) {
    if (!confirm('Rechnung in FastBill abschließen? Dabei vergibt FastBill die offizielle Rechnungsnummer.')) return
    await aktion(r, async () => {
      const erg = await schliesseRechnungAb(r.fastbillInvoiceId)
      if (erg.simuliert) { setMeldung({ art: 'info', text: 'Simuliert – kein FastBill-Zugang.' }); return }
      const st = await holeRechnungStatus(r.fastbillInvoiceId)
      await withStore((s) => s.update('rechnungen', r.id, {
        status: st.status || 'gestellt', fastbillNummer: st.nummer || erg.nummer || '', dokumentUrl: st.dokumentUrl || '',
      }))
      setMeldung({ art: 'ok', text: `Abgeschlossen – Rechnungsnummer ${st.nummer || erg.nummer || '(siehe FastBill)'}.` })
    })
  }

  async function senden(r) {
    const kunde = kundeVon(r.kundeId)
    const empfaenger = prompt('Rechnung per E-Mail senden an:', kunde?.email || '')
    if (!empfaenger) return
    await aktion(r, async () => {
      const erg = await sendeRechnungPerMail(r.fastbillInvoiceId, empfaenger, `Rechnung ${r.fastbillNummer || ''} – ${einst.praxisName}`, 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere Rechnung.\n\nMit freundlichen Grüßen\nGabara Service GmbH')
      if (erg.simuliert) { setMeldung({ art: 'info', text: 'Simuliert – kein FastBill-Zugang.' }); return }
      setMeldung({ art: 'ok', text: `Versand über FastBill angestoßen an ${empfaenger}.` })
    })
  }

  // V2-Rechnungen aus dem Aufmaß (art 'aufmass'): STORNO statt Löschen –
  // SPIEGELBILDLICH zum Hinweg (Plan 8.7): (1) ERST die Rechnung auf
  // 'storniert' (ein einzelner Vorgang – sperrt die Wieder-Fakturierung,
  // selbst wenn danach alles abbricht), (2) dann abgerechnetIn in Etappen
  // leeren, (3) zuletzt Abschluss-Vermerk + Einbehalt + Kennzahl. Bricht es
  // zwischendrin ab, zeigt der fehlende Abschluss-Vermerk den halben Storno
  // an und der Knopf bietet FORTSETZEN – nichts wird doppelt gebucht.
  async function stornieren(r) {
    const fortsetzung = r.status === 'storniert'
    if (!fortsetzung && !confirm(t('rl.stornoFrage'))) return
    await aktion(r, async () => {
      const onFehler = (e) => setMeldung({ art: 'fehler', text: e?.message || String(e) })
      await withStore(async (s) => {
        const zeilen = await s.listWhere('aufmasszeilen', 'abgerechnetIn', r.id)
        const st = stornoBauen({ rechnung: r, zeilen, userId: '' })
        if (!fortsetzung) {
          await s.schreibeVorgang({ patches: st.start.patches }, { onFehler })
        }
        for (const etappe of st.etappen) {
          await s.schreibeVorgang({ patches: etappe }, { onFehler })
        }
        const einbehalt = await s.get('einbehalte', `eb-${r.id}`)
        await s.schreibeVorgang({
          patches: [
            ...st.abschluss.patches,
            ...(einbehalt ? [st.abschluss.einbehaltPatch] : []),
          ],
          kennzahlen: st.abschluss.kennzahlen,
        }, { onFehler })
      })
      setMeldung({ art: 'ok', text: t('rl.stornoOk') })
    })
  }

  async function loeschen(r) {
    if (!confirm('Diese vorbereitete Rechnung löschen? Die enthaltenen Leistungen (LV-Mengen, Regieberichte, Spesen) werden wieder abrechenbar.')) return
    // Quellen ZURÜCKBUCHEN – sonst wären die Leistungen für immer "abgerechnet"
    // markiert und würden nie fakturiert (Review-Finding: bares Geld).
    await withStore(async (s) => {
      const lv = await s.list('lvpositionen')
      for (const p of r.positionen || []) {
        if (p.quelle === 'lv' && p.quelleId) {
          const pos = lv.find((x) => x.id === p.quelleId)
          if (pos) await s.update('lvpositionen', pos.id, { abgerechnetMenge: Math.max(0, Math.round(((pos.abgerechnetMenge || 0) - (p.menge || 0)) * 1000) / 1000) })
        }
      }
      const regieIds = [...new Set((r.positionen || []).filter((p) => ['regie', 'material'].includes(p.quelle)).map((p) => p.quelleId).filter(Boolean))]
      for (const bid of regieIds) await s.update('berichte', bid, { status: 'freigegeben' })
      const spesenIds = [...new Set((r.positionen || []).filter((p) => p.quelle === 'spesen').map((p) => p.quelleId).filter(Boolean))]
      for (const sid of spesenIds) await s.update('spesen', sid, { status: 'eingereicht' })
      await s.remove('rechnungen', r.id)
    })
  }

  const knopf = 'px-2.5 py-1.5 rounded-feld text-xs font-medium disabled:opacity-40'

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="euro" titel={t('nav.abrechnung')} sub={t('abr.sub')}>
        <button onClick={() => setWizard(true)} className={S.BTN_PRIMAER}>
          <Icon name="plus" groesse="s" /> {t('abr.neu')}
        </button>
      </Seitenkopf>

      <ChipReihe
        aktiv={filter}
        onWahl={setFilter}
        chips={[
          { id: 'alle', label: t('allg.alle'), icon: 'list', anzahl: rechnungen.length },
          { id: 'vorbereitet', label: t('abr.vorbereitet'), icon: 'stift', anzahl: rechnungen.filter((r) => r.status === 'vorbereitet').length },
          { id: 'uebertragen', label: t('abr.uebertragenKurz'), icon: 'arrowRight', anzahl: rechnungen.filter((r) => r.status === 'uebertragen').length },
          { id: 'gestellt', label: t('abr.gestellt'), icon: 'mail', anzahl: rechnungen.filter((r) => r.status === 'gestellt').length },
          { id: 'bezahlt', label: t('abr.bezahlt'), icon: 'erfolg', anzahl: rechnungen.filter((r) => r.status === 'bezahlt').length },
          { id: 'storniert', label: t('abr.storniert'), icon: 'x', anzahl: rechnungen.filter((r) => r.status === 'storniert').length },
        ]}
      />

      {meldung && (
        <p className={`mb-4 text-sm rounded-feld px-3.5 py-2.5 border ${
          meldung.art === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : meldung.art === 'fehler' ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>{meldung.text}</p>
      )}

      {gefiltert.length === 0 ? (
        <div className={S.KARTE}>
          <Leer icon="rechnung" titel={t('abr.leerTitel')} text={t('abr.leerText')} />
        </div>
      ) : (
        <div className="space-y-2.5">
          {gefiltert.map((r) => {
            const projekt = projektVon(r.projektId)
            const kunde = kundeVon(r.kundeId)
            const busy = laeuft === r.id
            return (
              <div key={r.id} className="bg-karte rounded-karte border border-rahmen shadow-karte p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <p className="font-semibold text-schrift-stark">
                      {r.fastbillNummer ? t('abr.rechnungNr', { nr: r.fastbillNummer }) : (r.titel || t('abr.entwurf'))}
                    </p>
                    <p className="text-sm text-schrift-leise">
                      {new Date(r.createdAt).toLocaleDateString(document.documentElement.lang === 'ar' ? 'ar' : 'de-DE')} ·{' '}
                      {projekt ? <Link to={`/projekte/${projekt.id}`} className="text-praxis-600 hover:underline">{projekt.nummer} {projekt.name}</Link> : '–'} ·{' '}
                      {kunde?.firma || `${kunde?.vorname || ''} ${kunde?.nachname || ''}`} · {t('abr.positionen', { n: r.positionen?.length || 0 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{euro(r.zahlbetrag ?? r.netto)}</p>
                    {r.einbehaltBetrag > 0 && <p className="text-xs text-schrift-zart">{t('abr.einbehalt')} − {euro(r.einbehaltBetrag)}</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS[r.status]?.farbe || 'bg-gedeckt-tief'}`}>
                    {STATUS[r.status] ? t(STATUS[r.status].schluessel) : r.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.status === 'vorbereitet' && (
                    <button onClick={() => uebertragen(r)} disabled={busy} className={`${knopf} bg-praxis-600 text-white hover:bg-praxis-700`}>
                      {busy ? t('abr.uebertraegt') : t('abr.anFastbill')}
                    </button>
                  )}
                  {r.status === 'uebertragen' && r.fastbillInvoiceId && (
                    <button onClick={() => abschliessen(r)} disabled={busy} className={`${knopf} bg-amber-500 text-white hover:bg-amber-600`}>
                      {t('abr.abschliessen')}
                    </button>
                  )}
                  {r.fastbillInvoiceId && ['gestellt', 'uebertragen'].includes(r.status) && (
                    <button onClick={() => senden(r)} disabled={busy || !r.fastbillNummer} title={!r.fastbillNummer ? 'Erst abschließen (Nummer vergeben)' : ''}
                      className={`${knopf} bg-sky-600 text-white hover:bg-sky-700`}>
                      {t('abr.perMail')}
                    </button>
                  )}
                  {r.fastbillInvoiceId && (
                    <button onClick={() => abgleichen(r)} disabled={busy} className={`${knopf} bg-gedeckt-tief text-schrift hover:bg-gedeckt-tief`}>
                      {t('abr.abgleichen')}
                    </button>
                  )}
                  {/* Rechnungs-PDF kommt ausschließlich aus FastBill (dort liegen
                      Nummer, E-Rechnung und Versand) – keinen Eigendruck anbieten. */}
                  {r.dokumentUrl ? (
                    <a href={r.dokumentUrl} target="_blank" rel="noreferrer" className={`${knopf} bg-gedeckt-tief text-schrift hover:bg-gedeckt-tief`}>
                      {t('abr.pdfFastbill')}
                    </a>
                  ) : (
                    <span className={`${knopf} text-schrift-zart`} title={t('abr.pdfFolgtHinweis')}>
                      {t('abr.pdfFolgt')}
                    </span>
                  )}
                  {r.art === 'aufmass' && ['vorbereitet', 'uebertragen', 'gestellt'].includes(r.status) && (
                    <button onClick={() => stornieren(r)} disabled={busy} className={`${knopf} text-red-500 hover:bg-red-50`}>{t('rl.stornieren')}</button>
                  )}
                  {/* Halber Storno (Rechnung storniert, Zeilen noch markiert):
                      stornoAbgeschlossenAm === 0 setzt NUR der neue Start-
                      Vorgang – Alt-Stornos (Feld fehlt) sind fertig und
                      bekommen keinen Fortsetzen-Knopf (sonst würde die
                      Kennzahl doppelt zurückgezogen). */}
                  {r.art === 'aufmass' && r.status === 'storniert' && r.stornoAbgeschlossenAm === 0 && (
                    <button onClick={() => stornieren(r)} disabled={busy} className={`${knopf} text-red-500 hover:bg-red-50`}>{t('rl.stornoFortsetzen')}</button>
                  )}
                  {r.art !== 'aufmass' && r.status === 'vorbereitet' && (
                    <button onClick={() => loeschen(r)} className={`${knopf} text-red-500 hover:bg-red-50`}>{t('allg.loeschen')}</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {wizard && <RechnungWizard onClose={() => setWizard(false)} />}
    </div>
  )
}
