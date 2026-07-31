import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { useCollection, useEinstellungen, withStore } from '../hooks.js'
import RechnungWizard from '../components/RechnungWizard.jsx'
import { druckeRechnung } from '../drucken.js'
import {
  syncKunde, erstelleFastbillRechnung, schliesseRechnungAb,
  sendeRechnungPerMail, holeRechnungStatus,
} from '@shared/fastbill.js'

// Abrechnung: Rechnungs-Spiegel + FastBill-Aktionen.
// FastBill übernimmt Nummernvergabe, E-Rechnung, Versand und Mahnwesen –
// hier entstehen die Rechnungen aus LV-Mengen/Regie und werden übertragen.
// Artikel + Textbausteine werden in den Einstellungen gepflegt (Stammdaten).

const STATUS = {
  vorbereitet: { label: 'Vorbereitet', farbe: 'bg-slate-100 text-slate-600' },
  uebertragen: { label: 'In FastBill (Entwurf)', farbe: 'bg-sky-100 text-sky-700' },
  gestellt: { label: 'Gestellt', farbe: 'bg-amber-100 text-amber-700' },
  bezahlt: { label: 'Bezahlt', farbe: 'bg-emerald-100 text-emerald-700' },
  storniert: { label: 'Storniert', farbe: 'bg-red-100 text-red-700' },
}

export default function Abrechnung() {
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
      const ist13b = (kunde.ustModus || '13b') === '13b'
      const erg = await erstelleFastbillRechnung(r, kunde, ist13b ? text13b : '')
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
      setMeldung({ art: 'ok', text: `Status aus FastBill: ${STATUS[erg.status]?.label || erg.status}${erg.nummer ? ` · Nr. ${erg.nummer}` : ''}` })
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

  async function loeschen(r) {
    if (!confirm('Diese vorbereitete Rechnung löschen? (Abgerechnete Mengen/Berichte werden NICHT zurückgesetzt.)')) return
    await withStore((s) => s.remove('rechnungen', r.id))
  }

  const knopf = 'px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40'

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Abrechnung</h1>
          <p className="text-sm text-slate-500">
            Rechnungen entstehen als Entwurf in FastBill – dort laufen Nummernvergabe, E-Rechnung, Versand und Mahnwesen.
          </p>
        </div>
        <button onClick={() => setWizard(true)} className="px-4 py-2.5 rounded-xl bg-praxis-600 text-white text-sm font-bold hover:bg-praxis-700">
          + Rechnung erstellen
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-5">
        {[['alle', 'Alle'], ['vorbereitet', 'Vorbereitet'], ['uebertragen', 'In FastBill'], ['gestellt', 'Gestellt'], ['bezahlt', 'Bezahlt'], ['storniert', 'Storniert']].map(([wert, label]) => (
          <button key={wert} onClick={() => setFilter(wert)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === wert ? 'bg-praxis-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {label}
            <span className="ml-1.5 opacity-70">{wert === 'alle' ? rechnungen.length : rechnungen.filter((r) => r.status === wert).length}</span>
          </button>
        ))}
      </div>

      {meldung && (
        <p className={`mb-4 text-sm rounded-xl px-3.5 py-2.5 border ${
          meldung.art === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : meldung.art === 'fehler' ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>{meldung.text}</p>
      )}

      {gefiltert.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
          <Icon name="euro" className="w-8 h-8 mx-auto mb-2" />
          Keine Rechnungen in dieser Ansicht. Über „+ Rechnung erstellen" werden LV-Mengen und Regieberichte abgerechnet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {gefiltert.map((r) => {
            const projekt = projektVon(r.projektId)
            const kunde = kundeVon(r.kundeId)
            const busy = laeuft === r.id
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <p className="font-semibold text-slate-900">
                      {r.fastbillNummer ? `Rechnung ${r.fastbillNummer}` : (r.titel || 'Rechnung (Entwurf)')}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString('de-DE')} ·{' '}
                      {projekt ? <Link to={`/projekte/${projekt.id}`} className="text-praxis-600 hover:underline">{projekt.nummer} {projekt.name}</Link> : '–'} ·{' '}
                      {kunde?.firma || `${kunde?.vorname || ''} ${kunde?.nachname || ''}`} · {r.positionen?.length || 0} Positionen
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{euro(r.zahlbetrag ?? r.netto)}</p>
                    {r.einbehaltBetrag > 0 && <p className="text-xs text-slate-400">Einbehalt − {euro(r.einbehaltBetrag)}</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS[r.status]?.farbe || 'bg-slate-100'}`}>
                    {STATUS[r.status]?.label || r.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.status === 'vorbereitet' && (
                    <button onClick={() => uebertragen(r)} disabled={busy} className={`${knopf} bg-praxis-600 text-white hover:bg-praxis-700`}>
                      {busy ? 'Übertrage …' : 'An FastBill übertragen'}
                    </button>
                  )}
                  {r.status === 'uebertragen' && r.fastbillInvoiceId && (
                    <button onClick={() => abschliessen(r)} disabled={busy} className={`${knopf} bg-amber-500 text-white hover:bg-amber-600`}>
                      Abschließen + Nummer
                    </button>
                  )}
                  {r.fastbillInvoiceId && ['gestellt', 'uebertragen'].includes(r.status) && (
                    <button onClick={() => senden(r)} disabled={busy || !r.fastbillNummer} title={!r.fastbillNummer ? 'Erst abschließen (Nummer vergeben)' : ''}
                      className={`${knopf} bg-sky-600 text-white hover:bg-sky-700`}>
                      Per Mail senden
                    </button>
                  )}
                  {r.fastbillInvoiceId && (
                    <button onClick={() => abgleichen(r)} disabled={busy} className={`${knopf} bg-slate-100 text-slate-600 hover:bg-slate-200`}>
                      Status abgleichen
                    </button>
                  )}
                  {r.dokumentUrl && (
                    <a href={r.dokumentUrl} target="_blank" rel="noreferrer" className={`${knopf} bg-slate-100 text-slate-600 hover:bg-slate-200`}>
                      PDF (FastBill)
                    </a>
                  )}
                  <button onClick={() => druckeRechnung({ rechnung: r, projekt, kunde, einst })} className={`${knopf} bg-slate-100 text-slate-600 hover:bg-slate-200`}>
                    Eigendruck
                  </button>
                  {r.status === 'vorbereitet' && (
                    <button onClick={() => loeschen(r)} className={`${knopf} text-red-500 hover:bg-red-50`}>Löschen</button>
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
