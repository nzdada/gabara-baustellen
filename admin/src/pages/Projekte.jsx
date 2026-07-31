import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCollection, withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import Modal from '../components/Modal.jsx'
import { euro } from '@shared/format.js'
import { PROJEKT_STATUS, istOffen, normalisiereStatus, statusInfo, istUeberfaellig } from '@shared/projektstatus.js'

const FARBE_OFFEN = '#8b1a1a'
const FARBE_UEBERFAELLIG = '#dc2626'

const SPALTEN = [
  { key: 'nummer', label: 'Nummer' },
  { key: 'name', label: 'Projektname' },
  { key: 'kunde', label: 'Kunde' },
  { key: 'anschrift', label: 'Anschrift' },
  { key: 'gewerk', label: 'Gewerk' },
  { key: 'status', label: 'Status' },
  { key: 'zeitraum', label: 'Zeitraum' },
  { key: 'volumen', label: 'Volumen' },
]

function fmtDatum(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

function heuteIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function kundenName(kunde) {
  if (!kunde) return '–'
  return kunde.firma || `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim() || '–'
}

// Nächste freie Nummer 'P-<Jahr>-<lfd 3-stellig>' aus der höchsten vorhandenen Nummer
function naechsteNummer(projekte) {
  const jahr = new Date().getFullYear()
  let max = 0
  for (const p of projekte) {
    const m = /^P-(\d{4})-(\d+)$/.exec(p.nummer || '')
    if (m && Number(m[1]) === jahr) max = Math.max(max, Number(m[2]))
  }
  return `P-${jahr}-${String(max + 1).padStart(3, '0')}`
}

export default function Projekte() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const projekte = useCollection('projekte')
  const kunden = useCollection('patients')
  const [neuOffen, setNeuOffen] = useState(false)
  const [filter, setFilter] = useState({})

  const heute = heuteIso()
  const aktiv = searchParams.get('status') || 'offen'

  // Chips: Alle Offenen, Überfällig, dann die Pipeline-Stati
  const chips = useMemo(() => {
    const zaehl = (fn) => projekte.filter(fn).length
    return [
      { id: 'offen', label: 'Alle Offenen', farbe: FARBE_OFFEN, anzahl: zaehl((p) => istOffen(p.status)) },
      { id: 'ueberfaellig', label: 'Überfällig', farbe: FARBE_UEBERFAELLIG, anzahl: zaehl((p) => istUeberfaellig(p, heute)) },
      ...PROJEKT_STATUS.map((s) => ({ id: s.id, label: s.label, farbe: s.farbe, anzahl: zaehl((p) => normalisiereStatus(p.status) === s.id) })),
    ]
  }, [projekte, heute])

  // Zeilen mit Filter-Texten je Spalte
  const zeilen = useMemo(() => {
    const vorgefiltert = projekte.filter((p) => {
      if (aktiv === 'offen') return istOffen(p.status)
      if (aktiv === 'ueberfaellig') return istUeberfaellig(p, heute)
      return normalisiereStatus(p.status) === aktiv
    })
    const mitText = vorgefiltert.map((p) => {
      const kunde = kunden.find((k) => k.id === p.kundeId)
      const texte = {
        nummer: p.nummer || '',
        name: p.name || '',
        kunde: kundenName(kunde),
        anschrift: `${p.anschrift?.strasse || ''} ${p.anschrift?.plzOrt || ''}`.trim(),
        gewerk: p.gewerk || '',
        status: statusInfo(p.status).label,
        zeitraum: `${fmtDatum(p.startDatum)} – ${fmtDatum(p.endeDatum)}`,
        volumen: p.projektvolumen ? euro(p.projektvolumen) : '',
      }
      return { projekt: p, texte }
    })
    return mitText
      .filter((z) =>
        SPALTEN.every((sp) => {
          const q = (filter[sp.key] || '').trim().toLowerCase()
          return !q || z.texte[sp.key].toLowerCase().includes(q)
        })
      )
      .sort((a, b) => (b.texte.nummer || '').localeCompare(a.texte.nummer || ''))
  }, [projekte, kunden, aktiv, heute, filter])

  function chipWaehlen(id) {
    if (id === 'offen') setSearchParams({})
    else setSearchParams({ status: id })
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-slate-900">Projekte</h1>
          <p className="text-sm text-slate-500">Verwaltung der Baustellen</p>
        </div>
        <button
          onClick={() => setNeuOffen(true)}
          className="inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
        >
          <Icon name="plus" className="w-4 h-4" /> Neues Projekt
        </button>
      </div>

      {/* Status-Pipeline */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {chips.map((c) => {
          const istAktiv = aktiv === c.id
          return (
            <button
              key={c.id}
              onClick={() => chipWaehlen(c.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3.5 py-2 border transition ${
                istAktiv ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
              style={istAktiv ? { backgroundColor: c.farbe } : undefined}
            >
              {c.label}
              <span
                className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${istAktiv ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}
              >
                {c.anzahl}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
              {SPALTEN.map((sp) => (
                <th key={sp.key} className="px-4 py-3 font-semibold whitespace-nowrap">{sp.label}</th>
              ))}
            </tr>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {SPALTEN.map((sp) => (
                <th key={sp.key} className="px-2 py-1.5">
                  <input
                    value={filter[sp.key] || ''}
                    onChange={(e) => setFilter({ ...filter, [sp.key]: e.target.value })}
                    placeholder="Filtern …"
                    className="w-full min-w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-normal focus:outline-none focus:ring-2 focus:ring-praxis-500"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {zeilen.map(({ projekt: p, texte }) => {
              const st = statusInfo(p.status)
              return (
                <tr
                  key={p.id}
                  onClick={() => navigate('/projekte/' + p.id)}
                  className="cursor-pointer hover:bg-praxis-50/60 transition"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{texte.nummer || '–'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.farbe || FARBE_OFFEN }} />
                      {texte.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{texte.kunde}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {p.anschrift?.strasse || '–'}
                    {p.anschrift?.plzOrt && <span className="block text-slate-400">{p.anschrift.plzOrt}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{texte.gewerk || '–'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="text-[11px] font-bold rounded-full px-2.5 py-1"
                      style={{ backgroundColor: st.farbe + '1f', color: st.farbe }}
                    >
                      {st.label}
                    </span>
                    {istUeberfaellig(p, heute) && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                        <Icon name="alert" className="w-3.5 h-3.5" /> überfällig
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{texte.zeitraum}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap text-right">{texte.volumen || '–'}</td>
                </tr>
              )
            })}
            {zeilen.length === 0 && (
              <tr>
                <td colSpan={SPALTEN.length} className="px-4 py-12 text-center text-sm text-slate-400">
                  Keine Projekte gefunden. Filter anpassen oder ein neues Projekt anlegen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {neuOffen && (
        <NeuesProjekt
          projekte={projekte}
          kunden={kunden}
          onClose={() => setNeuOffen(false)}
          onAngelegt={(id) => navigate('/projekte/' + id)}
        />
      )}
    </div>
  )
}

function NeuesProjekt({ projekte, kunden, onClose, onAngelegt }) {
  const [form, setForm] = useState({
    name: '', kundeId: '', nummer: naechsteNummer(projekte),
    strasse: '', plzOrt: '', gewerk: 'Malerarbeiten', status: 'neu',
    startDatum: '', endeDatum: '', projektvolumen: '', farbe: '#8b1a1a', beschreibung: '',
  })
  const [fehler, setFehler] = useState('')

  const setze = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const feldKlasse = 'mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'

  async function speichern(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.kundeId) return setFehler('Name und Kunde sind Pflicht.')
    const id = await withStore((s) =>
      s.add('projekte', {
        nummer: form.nummer.trim(),
        name: form.name.trim(),
        kundeId: form.kundeId,
        anschrift: { strasse: form.strasse.trim(), plzOrt: form.plzOrt.trim() },
        gewerk: form.gewerk.trim() || 'Malerarbeiten',
        status: form.status,
        startDatum: form.startDatum,
        endeDatum: form.endeDatum,
        projektvolumen: Number(form.projektvolumen) || 0,
        farbe: form.farbe,
        beschreibung: form.beschreibung.trim(),
        createdAt: Date.now(),
      })
    )
    onAngelegt?.(id)
    onClose()
  }

  return (
    <Modal titel="Neues Projekt" onClose={onClose} breite="max-w-xl">
      <form onSubmit={speichern} className="space-y-3.5">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Projektname *</span>
          <input value={form.name} onChange={setze('name')} className={feldKlasse} placeholder="z. B. EFH Huber – Innenanstrich EG" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Kunde *</span>
            <select value={form.kundeId} onChange={setze('kundeId')} className={feldKlasse}>
              <option value="">– Kunde wählen –</option>
              {[...kunden]
                .sort((a, b) => kundenName(a).localeCompare(kundenName(b)))
                .map((k) => (
                  <option key={k.id} value={k.id}>{kundenName(k)}</option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Nummer</span>
            <input value={form.nummer} onChange={setze('nummer')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Straße</span>
            <input value={form.strasse} onChange={setze('strasse')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">PLZ / Ort</span>
            <input value={form.plzOrt} onChange={setze('plzOrt')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Gewerk</span>
            <input value={form.gewerk} onChange={setze('gewerk')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select value={form.status} onChange={setze('status')} className={feldKlasse}>
              {PROJEKT_STATUS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Start-Datum</span>
            <input type="date" value={form.startDatum} onChange={setze('startDatum')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Ende-Datum</span>
            <input type="date" value={form.endeDatum} onChange={setze('endeDatum')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Projektvolumen (€, netto)</span>
            <input type="number" min="0" step="0.01" value={form.projektvolumen} onChange={setze('projektvolumen')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Farbe</span>
            <input type="color" value={form.farbe} onChange={setze('farbe')} className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 px-1.5 py-1 cursor-pointer" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Beschreibung</span>
          <textarea value={form.beschreibung} onChange={setze('beschreibung')} rows={3} className={feldKlasse} />
        </label>
        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>}
        <button type="submit" className="w-full bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3.5 rounded-xl">
          Projekt anlegen
        </button>
      </form>
    </Modal>
  )
}
