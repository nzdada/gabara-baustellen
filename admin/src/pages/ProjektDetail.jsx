import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCollection, useWhere, withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { PROJEKT_STATUS, statusInfo } from '@shared/projektstatus.js'
import LvEditor from '../components/LvEditor.jsx'
import LvImport from '../components/LvImport.jsx'
import Modal from '../components/Modal.jsx'

// Projekt-Detailseite (#/projekte/:id): Dreispalter im HERO-Stil –
// links Bereichs-Navigation, Mitte Inhalt, rechts Projektdaten-Panel.

const BERICHT_STATUS = {
  entwurf: { label: 'Entwurf', klasse: 'bg-slate-100 text-slate-500' },
  eingereicht: { label: 'Eingereicht', klasse: 'bg-sky-100 text-sky-700' },
  freigegeben: { label: 'Freigegeben', klasse: 'bg-emerald-100 text-emerald-700' },
  abgerechnet: { label: 'Abgerechnet', klasse: 'bg-slate-200 text-slate-600' },
}

const TYP_LABEL = { regie: 'Regiebericht', reklamation: 'Reklamation', abnahme: 'Abnahme' }

const KATEGORIE_LABEL = {
  umsetzung: 'Umsetzung',
  fertigstellung: 'Fertigstellung',
  reklamation: 'Reklamation',
  krank: 'Krank',
  privat: 'Privat',
}

const SPESEN_TYP = { hotel: 'Hotel', fahrt: 'Fahrt', sonstig: 'Sonstig' }

const PHASE_BADGE = {
  vorher: 'bg-slate-700 text-white',
  nachher: 'bg-emerald-600 text-white',
  beleg: 'bg-amber-500 text-white',
  sonstig: 'bg-slate-400 text-white',
}

function datumDe(iso) {
  return iso ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE') : '–'
}

function StatusBadge({ status }) {
  const s = BERICHT_STATUS[status] || { label: status || '–', klasse: 'bg-slate-100 text-slate-500' }
  return <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${s.klasse}`}>{s.label}</span>
}

// Debounce-Eingabefeld (SummaryEditor-Muster): lokaler Draft + 600 ms + Blur-Flush
function FeldInput({ wert, onWert, typ = 'text', className = '', platzhalter = '' }) {
  const [draft, setDraft] = useState(wert === undefined || wert === null ? '' : String(wert))
  const fokus = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
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
      step={typ === 'number' ? '0.01' : undefined}
      value={draft}
      placeholder={platzhalter}
      onChange={(e) => aendern(e.target.value)}
      onFocus={() => { fokus.current = true }}
      onBlur={(e) => { fokus.current = false; clearTimeout(timer.current); speichern(e.target.value) }}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500 ${className}`}
    />
  )
}

function FeldTextarea({ wert, onWert, rows = 4, platzhalter = '' }) {
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
      rows={rows}
      placeholder={platzhalter}
      onChange={(e) => aendern(e.target.value)}
      onFocus={() => { fokus.current = true }}
      onBlur={(e) => { fokus.current = false; clearTimeout(timer.current); onWert(e.target.value) }}
      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-praxis-500"
    />
  )
}

export default function ProjektDetail() {
  const { id } = useParams()
  const projekte = useCollection('projekte')
  const kunden = useCollection('patients')
  const users = useCollection('users')
  const lv = useWhere('lvpositionen', 'projektId', id)
  const fotos = useWhere('photos', 'projektId', id)
  const berichte = useWhere('berichte', 'projektId', id)
  const termine = useWhere('appointments', 'projektId', id)
  const spesen = useWhere('spesen', 'projektId', id)
  const rechnungen = useWhere('rechnungen', 'projektId', id)

  const projekt = projekte.find((p) => p.id === id)
  const kunde = kunden.find((k) => k.id === projekt?.kundeId)

  const [bereich, setBereich] = useState('uebersicht')
  const [zeigeImport, setZeigeImport] = useState(false)
  const [vollbildFoto, setVollbildFoto] = useState(null)
  const [berichtId, setBerichtId] = useState(null)

  // LV-Summe = Σ Menge × EP aller echten Positionen (ohne Bedarf/NEP)
  const lvSumme = lv
    .filter((p) => p.typ === 'position' && !p.flags?.bedarf && !p.flags?.nep)
    .reduce((s, p) => s + (p.menge || 0) * (p.einheitspreis || 0), 0)
  const hatLv = lv.some((p) => p.typ === 'position')

  const anzahl = {
    lv: lv.filter((p) => p.typ === 'position').length,
    bilder: fotos.length,
    regie: berichte.filter((b) => b.typ === 'regie').length,
    reklamation: berichte.filter((b) => b.typ === 'reklamation').length,
    abnahme: berichte.filter((b) => b.typ === 'abnahme').length,
    rechnungen: rechnungen.length,
    termine: termine.length,
    spesen: spesen.length,
  }

  const BEREICHE = [
    { id: 'uebersicht', label: 'Übersicht', icon: 'home' },
    { id: 'lv', label: 'Leistungsverzeichnis', icon: 'list', zahl: anzahl.lv },
    { id: 'bilder', label: 'Bilder', icon: 'foto', zahl: anzahl.bilder },
    { id: 'regie', label: 'Regieberichte', icon: 'bericht', zahl: anzahl.regie },
    { id: 'reklamation', label: 'Reklamationen', icon: 'alert', zahl: anzahl.reklamation },
    { id: 'abnahme', label: 'Abnahmen', icon: 'check', zahl: anzahl.abnahme },
    { id: 'rechnungen', label: 'Rechnungen', icon: 'euro', zahl: anzahl.rechnungen },
    { id: 'termine', label: 'Termine', icon: 'calendar', zahl: anzahl.termine },
    { id: 'spesen', label: 'Spesen', icon: 'truck', zahl: anzahl.spesen },
  ]

  // Logbuch: Termine + eingereichte/freigegebene Berichte gemischt, neueste oben
  const logbuch = useMemo(() => {
    const eintraege = []
    for (const t of termine) {
      eintraege.push({
        id: `t-${t.id}`,
        datum: t.datum,
        zeit: t.start || '',
        icon: 'calendar',
        titel: t.titel || t.behandlung || 'Termin',
        sub: `Termin · ${KATEGORIE_LABEL[t.kategorie] || t.kategorie || '–'}${t.erledigt ? ' · erledigt' : ''}`,
      })
    }
    for (const b of berichte) {
      if (b.status === 'entwurf') continue
      eintraege.push({
        id: `b-${b.id}`,
        datum: b.datum,
        zeit: '',
        icon: b.typ === 'reklamation' ? 'alert' : 'bericht',
        titel: `${TYP_LABEL[b.typ] || 'Bericht'} – ${b.mitarbeiterName || '–'}`,
        sub: `${(BERICHT_STATUS[b.status] || {}).label || b.status}${b.beschreibung ? ` · ${b.beschreibung}` : ''}`,
      })
    }
    return eintraege.sort((a, b) => `${b.datum} ${b.zeit}`.localeCompare(`${a.datum} ${a.zeit}`))
  }, [termine, berichte])

  const gewaehlterBericht = berichte.find((b) => b.id === berichtId)

  function patchProjekt(felder) {
    withStore((s) => s.update('projekte', id, felder))
  }

  if (!projekt) {
    return (
      <div className="p-6">
        <Link to="/projekte" className="inline-flex items-center gap-1.5 text-sm font-semibold text-praxis-700 hover:underline">
          <Icon name="arrowLeft" className="w-4 h-4" /> Zurück zu den Projekten
        </Link>
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          {projekte.length === 0 ? 'Projekt wird geladen …' : 'Projekt nicht gefunden.'}
        </div>
      </div>
    )
  }

  const status = statusInfo(projekt.status)

  return (
    <div className="p-4 lg:p-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Link
          to="/projekte"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-praxis-700"
        >
          <Icon name="arrowLeft" className="w-4 h-4" /> Projekte
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-bold text-slate-900">{projekt.name}</h1>
        <span className="text-xs font-mono text-slate-400 bg-white border border-slate-200 rounded-full px-2.5 py-1">{projekt.nummer}</span>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5"
          style={{ backgroundColor: `${status.farbe}1a`, color: status.farbe }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.farbe }} />
          {status.label}
        </span>
      </div>

      {/* Mobil: Bereichs-Auswahl */}
      <select
        value={bereich}
        onChange={(e) => setBereich(e.target.value)}
        className="lg:hidden w-full mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-praxis-500"
      >
        {BEREICHE.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}{b.zahl !== undefined ? ` (${b.zahl})` : ''}
          </option>
        ))}
      </select>

      <div className="lg:flex lg:items-start gap-5 space-y-4 lg:space-y-0">
        {/* LINKS: Bereichs-Navigation */}
        <nav className="hidden lg:block w-56 shrink-0 bg-white rounded-2xl border border-slate-200 p-2">
          {BEREICHE.map((b) => (
            <button
              key={b.id}
              onClick={() => setBereich(b.id)}
              className={`w-full flex items-center gap-2.5 text-left text-sm font-semibold rounded-xl px-3 py-2.5 transition ${
                bereich === b.id ? 'bg-praxis-600 text-white' : 'text-slate-600 hover:bg-praxis-50/60'
              }`}
            >
              <Icon name={b.icon} className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{b.label}</span>
              {b.zahl !== undefined && b.zahl > 0 && (
                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                  bereich === b.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {b.zahl}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* MITTE: Inhalt des gewählten Bereichs */}
        <div className="flex-1 min-w-0 space-y-4">
          {bereich === 'uebersicht' && (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 text-sm mb-2">Beschreibung</h2>
                <FeldTextarea
                  wert={projekt.beschreibung}
                  onWert={(v) => patchProjekt({ beschreibung: v })}
                  platzhalter="Projektbeschreibung, Vertragsdetails, Besonderheiten …"
                />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 text-sm mb-3">Logbuch</h2>
                {logbuch.length === 0 ? (
                  <p className="text-sm text-slate-400">Noch keine Termine oder Berichte.</p>
                ) : (
                  <div className="space-y-2">
                    {logbuch.map((e) => (
                      <div key={e.id} className="flex items-start gap-3 border border-slate-100 rounded-xl px-4 py-3">
                        <Icon name={e.icon} className="w-4 h-4 text-praxis-700 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">
                            {datumDe(e.datum)}{e.zeit ? ` · ${e.zeit} Uhr` : ''} — {e.titel}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{e.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {bereich === 'lv' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-800">Leistungsverzeichnis</h2>
                <button
                  onClick={() => setZeigeImport(true)}
                  className="inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2 rounded-full"
                >
                  <Icon name="upload" className="w-4 h-4" /> LV importieren
                </button>
              </div>
              <LvEditor projektId={id} />
            </>
          )}

          {bereich === 'bilder' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-bold text-slate-800 text-sm mb-3">Bilder ({fotos.length})</h2>
              {fotos.length === 0 ? (
                <p className="text-sm text-slate-400">Noch keine Fotos. Fotos entstehen über Berichte und Termine der Monteure.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[...fotos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setVollbildFoto(f)}
                      className="relative rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100 group"
                    >
                      <img src={f.dataUrl} alt={f.name || 'Foto'} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      <span className={`absolute top-2 left-2 text-[10px] font-bold rounded-full px-2 py-0.5 ${PHASE_BADGE[f.phase] || PHASE_BADGE.sonstig}`}>
                        {f.phase || 'sonstig'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(bereich === 'regie' || bereich === 'reklamation' || bereich === 'abnahme') && (
            <div className="space-y-2.5">
              <h2 className="font-bold text-slate-800">
                {bereich === 'regie' ? 'Regieberichte' : bereich === 'reklamation' ? 'Reklamationen' : 'Abnahmen'}
              </h2>
              {berichte.filter((b) => b.typ === bereich).length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
                  Noch keine Einträge. Berichte werden von den Monteuren auf der Baustelle erstellt.
                </div>
              )}
              {berichte
                .filter((b) => b.typ === bereich)
                .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))
                .map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBerichtId(b.id)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-praxis-400 px-5 py-4 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {datumDe(b.datum)} · {b.mitarbeiterName || '–'}
                      </p>
                      <StatusBadge status={b.status} />
                    </div>
                    {b.beschreibung && <p className="mt-1 text-sm text-slate-500 line-clamp-2">{b.beschreibung}</p>}
                  </button>
                ))}
            </div>
          )}

          {bereich === 'rechnungen' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <h2 className="font-bold text-slate-800 text-sm px-5 pt-4 pb-2">Rechnungen</h2>
              {rechnungen.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-slate-400">Noch keine Rechnungen zu diesem Projekt.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-2">Nummer</th>
                        <th className="px-3 py-2 text-right">Netto</th>
                        <th className="px-5 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rechnungen.map((r) => (
                        <tr key={r.id} className="border-b border-slate-50">
                          <td className="px-5 py-2.5 font-mono text-xs text-slate-600">{r.nummer || r.fastbillInvoiceId || r.id}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{euro(r.netto)}</td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-slate-100 text-slate-600">{r.status || '–'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {bereich === 'termine' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <h2 className="font-bold text-slate-800 text-sm px-5 pt-4 pb-2">Termine</h2>
              {termine.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-slate-400">Noch keine Termine zu diesem Projekt.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-2">Datum</th>
                        <th className="px-3 py-2">Titel</th>
                        <th className="px-3 py-2">Kategorie</th>
                        <th className="px-5 py-2 text-right">Erledigt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...termine]
                        .sort((a, b) => `${b.datum}${b.start}`.localeCompare(`${a.datum}${a.start}`))
                        .map((t) => (
                          <tr key={t.id} className="border-b border-slate-50">
                            <td className="px-5 py-2.5 whitespace-nowrap text-slate-600">{datumDe(t.datum)} · {t.start}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-800">{t.titel || t.behandlung}</td>
                            <td className="px-3 py-2.5 text-slate-500">{KATEGORIE_LABEL[t.kategorie] || t.kategorie || '–'}</td>
                            <td className="px-5 py-2.5 text-right">
                              {t.erledigt ? <Icon name="check" className="w-4 h-4 text-emerald-600 inline" /> : <span className="text-slate-300">–</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {bereich === 'spesen' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <h2 className="font-bold text-slate-800 text-sm px-5 pt-4 pb-2">Spesen</h2>
              {spesen.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-slate-400">Noch keine Spesen zu diesem Projekt.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-2">Datum</th>
                        <th className="px-3 py-2">Typ</th>
                        <th className="px-3 py-2">Mitarbeiter</th>
                        <th className="px-3 py-2 text-right">Betrag</th>
                        <th className="px-5 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...spesen]
                        .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))
                        .map((s) => (
                          <tr key={s.id} className="border-b border-slate-50">
                            <td className="px-5 py-2.5 whitespace-nowrap text-slate-600">{datumDe(s.datum)}</td>
                            <td className="px-3 py-2.5 text-slate-500">{SPESEN_TYP[s.typ] || s.typ}</td>
                            <td className="px-3 py-2.5 text-slate-500">{users.find((u) => u.id === s.mitarbeiterId)?.name || '–'}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{euro(s.betrag)}</td>
                            <td className="px-5 py-2.5 text-right"><StatusBadge status={s.status} /></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RECHTS: Projektdaten-Panel */}
        <aside className="lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Status</p>
              <select
                value={statusInfo(projekt.status).id}
                onChange={(e) => patchProjekt({ status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-praxis-500"
              >
                {PROJEKT_STATUS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Kunde</p>
              <p className="text-sm font-semibold text-slate-800">
                {kunde ? (kunde.firma || `${kunde.vorname} ${kunde.nachname}`.trim()) : '–'}
              </p>
              {kunde?.telefon && (
                <p className="text-sm text-slate-500 mt-0.5">
                  <Icon name="phone" className="w-3.5 h-3.5 inline mr-1" />{kunde.telefon}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Nummer</p>
                <p className="text-sm font-mono text-slate-700">{projekt.nummer || '–'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Gewerk</p>
                <p className="text-sm text-slate-700">{projekt.gewerk || '–'}</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Zeitraum</p>
              <div className="space-y-2">
                <input
                  type="date"
                  value={projekt.startDatum || ''}
                  onChange={(e) => patchProjekt({ startDatum: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
                />
                <input
                  type="date"
                  value={projekt.endeDatum || ''}
                  onChange={(e) => patchProjekt({ endeDatum: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Anschrift</p>
              <div className="space-y-2">
                <FeldInput
                  wert={projekt.anschrift?.strasse}
                  onWert={(v) => patchProjekt({ anschrift: { ...(projekt.anschrift || {}), strasse: v } })}
                  platzhalter="Straße Nr."
                />
                <FeldInput
                  wert={projekt.anschrift?.plzOrt}
                  onWert={(v) => patchProjekt({ anschrift: { ...(projekt.anschrift || {}), plzOrt: v } })}
                  platzhalter="PLZ Ort"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Projektvolumen</p>
              {hatLv ? (
                <>
                  <p className="text-xl font-bold text-slate-900">{euro(lvSumme)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">aus LV (Σ Menge × EP, ohne Bedarf/NEP)</p>
                </>
              ) : (
                <>
                  <FeldInput
                    typ="number"
                    wert={projekt.projektvolumen}
                    onWert={(v) => patchProjekt({ projektvolumen: v })}
                    platzhalter="0"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">manuell – sobald LV-Positionen vorhanden sind, gilt die LV-Summe</p>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* LV-Import-Modal */}
      {zeigeImport && <LvImport projektId={id} onClose={() => setZeigeImport(false)} />}

      {/* Foto-Vollbild-Overlay */}
      {vollbildFoto && (
        <div
          className="fixed inset-0 z-[90] bg-slate-900/90 flex flex-col items-center justify-center p-4"
          onClick={() => setVollbildFoto(null)}
        >
          <img
            src={vollbildFoto.dataUrl}
            alt={vollbildFoto.name || 'Foto'}
            className="max-w-[92vw] max-h-[82vh] object-contain rounded-xl"
          />
          <p className="mt-3 text-sm text-white/80">
            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 mr-2 ${PHASE_BADGE[vollbildFoto.phase] || PHASE_BADGE.sonstig}`}>
              {vollbildFoto.phase || 'sonstig'}
            </span>
            {vollbildFoto.name || ''}{vollbildFoto.von ? ` · ${vollbildFoto.von}` : ''}
          </p>
          <button className="mt-2 text-xs font-semibold text-white/60 hover:text-white">Schließen</button>
        </div>
      )}

      {/* Bericht-Detail-Modal */}
      {gewaehlterBericht && (
        <BerichtDetail bericht={gewaehlterBericht} onClose={() => setBerichtId(null)} onFoto={setVollbildFoto} />
      )}
    </div>
  )
}

// Detail-Ansicht eines Berichts: alle Felder, Vorher/Nachher-Fotos, Unterschrift, Freigabe
function BerichtDetail({ bericht, onClose, onFoto }) {
  const fotos = useWhere('photos', 'berichtId', bericht.id)
  const vorher = fotos.filter((f) => f.phase === 'vorher')
  const nachher = fotos.filter((f) => f.phase === 'nachher')
  const weitere = fotos.filter((f) => f.phase !== 'vorher' && f.phase !== 'nachher')

  const stundenSumme = (bericht.stunden || []).reduce((s, z) => s + (z.anzahl || 0) * (z.satz || 0), 0)
  const materialSumme = (bericht.material || []).reduce((s, m) => s + (m.menge || 0) * (m.preis || 0), 0)

  function setzeStatus(status) {
    withStore((s) => s.update('berichte', bericht.id, status === 'freigegeben'
      ? { status, freigegebenAm: Date.now() }
      : { status }))
  }

  const fotoKachel = (f) => (
    <button key={f.id} onClick={() => onFoto(f)} className="rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100">
      <img src={f.dataUrl} alt={f.name || 'Foto'} className="w-full h-full object-cover" />
    </button>
  )

  return (
    <Modal titel={`${TYP_LABEL[bericht.typ] || 'Bericht'} vom ${datumDe(bericht.datum)}`} onClose={onClose} breite="max-w-2xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={bericht.status} />
          <span className="text-sm text-slate-500">
            <Icon name="users" className="w-3.5 h-3.5 inline mr-1" />{bericht.mitarbeiterName || '–'}
          </span>
          {bericht.terminId && <span className="text-xs text-slate-400">· aus Termin</span>}
        </div>

        {bericht.beschreibung && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Beschreibung</p>
            <p className="text-sm text-slate-700 leading-relaxed">{bericht.beschreibung}</p>
          </div>
        )}

        {/* Reklamation: Ursache + Maßnahme */}
        {bericht.ursache && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Ursache</p>
            <p className="text-sm text-slate-700">{bericht.ursache}</p>
          </div>
        )}
        {bericht.massnahme && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Maßnahme</p>
            <p className="text-sm text-slate-700">{bericht.massnahme}</p>
          </div>
        )}

        {/* Abnahme: Ergebnis + Mängelliste ({text, frist}-Objekte!) */}
        {bericht.typ === 'abnahme' && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Ergebnis der Abnahme</p>
            {bericht.ohneMaengel ? (
              <p className="text-sm font-semibold text-emerald-700">Abnahme ohne Mängel</p>
            ) : (bericht.maengel || []).length > 0 ? (
              <div className="space-y-1">
                {bericht.maengel.map((m, i) => (
                  <p key={i} className="text-sm text-slate-700">
                    • {m.text || '–'}
                    {m.frist && <span className="text-slate-400"> · Frist: {new Date(m.frist + 'T12:00:00').toLocaleDateString('de-DE')}</span>}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Abnahme mit Mängeln (keine Einzelmängel erfasst)</p>
            )}
          </div>
        )}
        {bericht.ergebnis && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Ergebnis</p>
            <p className="text-sm text-slate-700">{bericht.ergebnis}</p>
          </div>
        )}

        {/* Regie: Stunden */}
        {(bericht.stunden || []).length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Stunden</p>
            <div className="space-y-1.5">
              {bericht.stunden.map((z, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2">
                  <span className="text-slate-700">
                    {z.art === 'facharbeiter' ? 'Facharbeiter' : z.art === 'helfer' ? 'Helfer' : z.art} · {z.anzahl} Std. × {euro(z.satz)}
                  </span>
                  <span className="font-semibold text-slate-800">{euro((z.anzahl || 0) * (z.satz || 0))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-bold text-praxis-900 bg-praxis-50 rounded-xl px-3.5 py-2">
                <span>Summe Stunden</span><span>{euro(stundenSumme)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Regie: Material */}
        {(bericht.material || []).length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Material</p>
            <div className="space-y-1.5">
              {bericht.material.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2">
                  <span className="text-slate-700">{m.name} · {m.menge} {m.einheit} × {euro(m.preis)}</span>
                  <span className="font-semibold text-slate-800">{euro((m.menge || 0) * (m.preis || 0))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-bold text-praxis-900 bg-praxis-50 rounded-xl px-3.5 py-2">
                <span>Summe Material</span><span>{euro(materialSumme)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Fotos: Vorher/Nachher-Gegenüberstellung */}
        {(vorher.length > 0 || nachher.length > 0) && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Fotos</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1.5">Vorher</p>
                <div className="space-y-2">
                  {vorher.length > 0 ? vorher.map(fotoKachel) : <p className="text-xs text-slate-400">–</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-600 mb-1.5">Nachher</p>
                <div className="space-y-2">
                  {nachher.length > 0 ? nachher.map(fotoKachel) : <p className="text-xs text-slate-400">–</p>}
                </div>
              </div>
            </div>
          </div>
        )}
        {weitere.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Weitere Fotos / Belege</p>
            <div className="grid grid-cols-3 gap-2">{weitere.map(fotoKachel)}</div>
          </div>
        )}

        {/* Unterschrift */}
        {bericht.unterschriftKunde && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
              <Icon name="signatur" className="w-3.5 h-3.5 inline mr-1" />Unterschrift
            </p>
            <div className="bg-white border border-slate-200 rounded-xl p-3 w-fit">
              <img src={bericht.unterschriftKunde} alt="Unterschrift" className="h-20" />
            </div>
            {bericht.unterschriftName && <p className="text-xs text-slate-500 mt-1">{bericht.unterschriftName}</p>}
          </div>
        )}

        {/* Freigabe-Workflow */}
        {bericht.status === 'eingereicht' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setzeStatus('freigegeben')}
              className="flex-1 bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3 rounded-xl"
            >
              Freigeben
            </button>
            <button
              onClick={() => setzeStatus('entwurf')}
              className="flex-1 bg-white border border-slate-200 hover:border-red-300 text-slate-600 hover:text-red-600 font-semibold py-3 rounded-xl"
            >
              Zurückweisen
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
