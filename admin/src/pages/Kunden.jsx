import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useEinstellungen, withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { statusInfo } from '@shared/projektstatus.js'
import Modal from '../components/Modal.jsx'

// Kunden-Spiegel: FastBill ist das führende System, diese Liste ist der Arbeits-Spiegel.
// Collection heißt aus Vorlagen-Gründen weiterhin 'patients'.

const LEER = {
  firma: '',
  vorname: '',
  nachname: '',
  ansprechpartner: '',
  telefon: '',
  email: '',
  strasse: '',
  plzOrt: '',
  typ: 'gu',
  ustModus: '13b',
  zahlungszielTage: 16,
  sicherheitseinbehaltProzent: 10,
  notizen: '',
  fastbillCustomerId: null,
}

function kundenName(k) {
  return k.firma?.trim() || `${k.vorname || ''} ${k.nachname || ''}`.trim() || '(ohne Name)'
}

function datumDe(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

export default function Kunden() {
  const kunden = useCollection('patients')
  const projekte = useCollection('projekte')
  const [suche, setSuche] = useState('')
  const [bearbeite, setBearbeite] = useState(null) // null | 'neu' | kunde
  const [syncHinweis, setSyncHinweis] = useState(false)

  const projekteJeKunde = useMemo(() => {
    const map = {}
    for (const p of projekte) {
      if (!p.kundeId) continue
      if (!map[p.kundeId]) map[p.kundeId] = []
      map[p.kundeId].push(p)
    }
    return map
  }, [projekte])

  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return kunden
      .filter(
        (k) =>
          !q ||
          (k.firma || '').toLowerCase().includes(q) ||
          (k.ansprechpartner || '').toLowerCase().includes(q) ||
          `${k.vorname || ''} ${k.nachname || ''}`.toLowerCase().includes(q) ||
          (k.telefon || '').toLowerCase().includes(q) ||
          (k.email || '').toLowerCase().includes(q) ||
          (k.plzOrt || '').toLowerCase().includes(q)
      )
      .sort((a, b) => kundenName(a).localeCompare(kundenName(b), 'de'))
  }, [kunden, suche])

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Kopf */}
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-slate-900">Kunden</h1>
          <p className="text-sm text-slate-500 mt-0.5">FastBill ist führend – hier liegt der Arbeits-Spiegel</p>
        </div>
        <button
          onClick={() => setSyncHinweis(true)}
          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-praxis-400 text-slate-600 text-sm font-semibold px-4 py-2 rounded-full"
        >
          <Icon name="inbox" className="w-4 h-4" /> Aus FastBill laden
        </button>
        <button
          onClick={() => setBearbeite('neu')}
          className="inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2 rounded-full"
        >
          <Icon name="plus" className="w-4 h-4" /> Neuer Kunde
        </button>
      </div>

      {syncHinweis && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 text-sm">
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="flex-1">
            FastBill-Sync wird mit der Abrechnung (AP2) aktiviert – Zugang unter Einstellungen → Integrationen.
          </p>
          <button onClick={() => setSyncHinweis(false)} className="text-amber-500 hover:text-amber-800 shrink-0">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Suche */}
      <input
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Suchen: Firma, Ansprechpartner, Telefon, E-Mail, Ort …"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-praxis-500"
      />

      {/* Tabelle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <th className="px-4 py-3 font-semibold">Kunde</th>
              <th className="px-4 py-3 font-semibold">Telefon</th>
              <th className="px-4 py-3 font-semibold">E-Mail</th>
              <th className="px-4 py-3 font-semibold">Ort</th>
              <th className="px-4 py-3 font-semibold">Typ</th>
              <th className="px-4 py-3 font-semibold">USt</th>
              <th className="px-4 py-3 font-semibold">FastBill</th>
              <th className="px-4 py-3 font-semibold text-right">Projekte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {liste.map((k) => {
              const anzahl = (projekteJeKunde[k.id] || []).length
              return (
                <tr
                  key={k.id}
                  onClick={() => setBearbeite(k)}
                  className="cursor-pointer hover:bg-praxis-50/60 transition"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{kundenName(k)}</p>
                    {k.firma && k.ansprechpartner && (
                      <p className="text-xs text-slate-400 mt-0.5">{k.ansprechpartner}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{k.telefon || '–'}</td>
                  <td className="px-4 py-3 text-slate-600">{k.email || '–'}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{k.plzOrt || '–'}</td>
                  <td className="px-4 py-3">
                    {k.typ === 'privat' ? (
                      <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-sky-100 text-sky-700">Privat</span>
                    ) : (
                      <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-slate-100 text-slate-600">GU</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {k.ustModus === 'ust19' ? (
                      <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-emerald-100 text-emerald-700">19 % USt</span>
                    ) : (
                      <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-amber-100 text-amber-700">§13b netto</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {k.fastbillCustomerId ? (
                      <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                        <Icon name="check" className="w-3 h-3" /> verknüpft
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${anzahl > 0 ? 'bg-praxis-100 text-praxis-800' : 'bg-slate-100 text-slate-400'}`}>
                      {anzahl}
                    </span>
                  </td>
                </tr>
              )
            })}
            {liste.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  {kunden.length === 0 ? 'Noch keine Kunden angelegt.' : 'Keine Treffer.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {bearbeite && (
        <KundenForm
          kunde={bearbeite === 'neu' ? null : bearbeite}
          projekteDesKunden={bearbeite === 'neu' ? [] : projekteJeKunde[bearbeite.id] || []}
          onClose={() => setBearbeite(null)}
        />
      )}
    </div>
  )
}

// Typ-abhängige Vorbelegung (nur beim Neu-Anlegen), GU-Werte aus den Einstellungen
function typVorgaben(typ, einstellungen) {
  if (typ === 'privat') {
    return { ustModus: 'ust19', zahlungszielTage: 14, sicherheitseinbehaltProzent: 0 }
  }
  return {
    ustModus: einstellungen.ustModusStandard || '13b',
    zahlungszielTage: einstellungen.zahlungszielTage ?? 16,
    sicherheitseinbehaltProzent: einstellungen.sicherheitseinbehaltProzent ?? 10,
  }
}

function KundenForm({ kunde, projekteDesKunden, onClose }) {
  const einstellungen = useEinstellungen()
  const [form, setForm] = useState(() =>
    kunde ? { ...LEER, ...kunde } : { ...LEER, typ: 'gu', ...typVorgaben('gu', einstellungen) }
  )
  const [fehler, setFehler] = useState('')

  const feldKlasse =
    'mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'

  function setzeFeld(key, wert) {
    setForm((f) => ({ ...f, [key]: wert }))
  }

  function setzeTyp(typ) {
    setForm((f) => ({
      ...f,
      typ,
      // Nur beim Neu-Anlegen die Abrechnungs-Defaults mitziehen
      ...(kunde ? {} : typVorgaben(typ, einstellungen)),
    }))
  }

  async function speichern(e) {
    e.preventDefault()
    const ansprechpartner = (form.ansprechpartner || '').trim()
    if (!form.firma.trim() && !ansprechpartner) {
      setFehler('Bitte Firma oder Ansprechpartner angeben.')
      return
    }
    // Ansprechpartner intern in vorname/nachname spiegeln (erstes Wort / Rest)
    const [vorname, ...rest] = ansprechpartner.split(/\s+/).filter(Boolean)
    const daten = {
      ...form,
      firma: form.firma.trim(),
      ansprechpartner,
      vorname: vorname || '',
      nachname: rest.join(' '),
      zahlungszielTage: Number(form.zahlungszielTage) || 0,
      sicherheitseinbehaltProzent: Number(form.sicherheitseinbehaltProzent) || 0,
    }
    await withStore(async (s) => {
      if (kunde) await s.update('patients', kunde.id, daten)
      else await s.add('patients', { ...daten, createdAt: Date.now() })
    })
    onClose()
  }

  async function loeschen() {
    if (projekteDesKunden.length > 0) {
      setFehler('Löschen nicht möglich: Der Kunde hat noch verknüpfte Projekte. Erst die Projekte umhängen oder archivieren.')
      return
    }
    if (!confirm(`Kunde "${kundenName(form)}" wirklich löschen?`)) return
    await withStore((s) => s.remove('patients', kunde.id))
    onClose()
  }

  return (
    <Modal titel={kunde ? `Kunde bearbeiten – ${kundenName(kunde)}` : 'Neuer Kunde'} onClose={onClose} breite="max-w-2xl">
      <form onSubmit={speichern} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Firma (leer bei Privatkunde)</span>
            <input value={form.firma || ''} onChange={(e) => setzeFeld('firma', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Ansprechpartner / Name</span>
            <input value={form.ansprechpartner || ''} onChange={(e) => setzeFeld('ansprechpartner', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Telefon</span>
            <input type="tel" value={form.telefon || ''} onChange={(e) => setzeFeld('telefon', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">E-Mail</span>
            <input type="email" value={form.email || ''} onChange={(e) => setzeFeld('email', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Straße</span>
            <input value={form.strasse || ''} onChange={(e) => setzeFeld('strasse', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">PLZ / Ort</span>
            <input value={form.plzOrt || ''} onChange={(e) => setzeFeld('plzOrt', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Typ</span>
            <select value={form.typ || 'gu'} onChange={(e) => setzeTyp(e.target.value)} className={feldKlasse}>
              <option value="gu">Generalunternehmer (GU)</option>
              <option value="privat">Privatkunde</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">USt-Modus</span>
            <select value={form.ustModus || '13b'} onChange={(e) => setzeFeld('ustModus', e.target.value)} className={feldKlasse}>
              <option value="13b">§13b netto (Reverse-Charge)</option>
              <option value="ust19">19 % USt</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Zahlungsziel (Tage)</span>
            <input
              type="number"
              min="0"
              value={form.zahlungszielTage ?? ''}
              onChange={(e) => setzeFeld('zahlungszielTage', e.target.value)}
              className={feldKlasse}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Sicherheitseinbehalt (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.sicherheitseinbehaltProzent ?? ''}
              onChange={(e) => setzeFeld('sicherheitseinbehaltProzent', e.target.value)}
              className={feldKlasse}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Notizen (Vertragskonditionen, Besonderheiten …)</span>
          <textarea
            value={form.notizen || ''}
            onChange={(e) => setzeFeld('notizen', e.target.value)}
            rows={3}
            className={feldKlasse}
          />
        </label>

        {kunde && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 space-y-3">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Icon name="doc" className="w-3.5 h-3.5 shrink-0" />
              FastBill-Kundennr.:{' '}
              {kunde.fastbillCustomerId ? (
                <span className="font-mono font-semibold text-emerald-700">{kunde.fastbillCustomerId}</span>
              ) : (
                <span className="text-slate-400">noch nicht verknüpft (Sync folgt mit AP2)</span>
              )}
            </p>
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                Projekte ({projekteDesKunden.length})
              </p>
              {projekteDesKunden.length === 0 ? (
                <p className="text-xs text-slate-400">Keine Projekte verknüpft.</p>
              ) : (
                <div className="space-y-1.5">
                  {[...projekteDesKunden]
                    .sort((a, b) => (b.startDatum || '').localeCompare(a.startDatum || ''))
                    .map((p) => {
                      const st = statusInfo(p.status)
                      return (
                        <Link
                          key={p.id}
                          to={`/projekte/${p.id}`}
                          className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2 text-sm hover:border-praxis-400 transition"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.farbe }} />
                          <span className="font-mono text-xs text-slate-400 shrink-0">{p.nummer}</span>
                          <span className="flex-1 min-w-0 truncate font-medium text-slate-800">{p.name}</span>
                          <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
                            {st.label} · ab {datumDe(p.startDatum)}
                          </span>
                          {p.projektvolumen > 0 && (
                            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">{euro(p.projektvolumen)}</span>
                          )}
                          <Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        </Link>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>}

        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3 rounded-xl">
            Speichern
          </button>
          {kunde && (
            <button
              type="button"
              onClick={loeschen}
              title="Kunde löschen"
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold px-4 rounded-xl text-sm"
            >
              Löschen
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
