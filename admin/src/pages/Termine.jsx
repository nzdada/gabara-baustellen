import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import TerminModal, { KATEGORIE_INFO } from '../components/TerminModal.jsx'
import NeuerTermin, { KATEGORIEN } from '../components/NeuerTermin.jsx'

function fmtDatum(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

// "Erstellt/Erledigt am"-Text einer Zeile (createdAt gibt es nur bei neueren Terminen)
function erstelltText(a) {
  if (a.erledigt && a.erledigtAm) return `Erledigt ${fmtDatum(a.erledigtAm)}`
  if (a.erledigt) return 'Erledigt'
  if (a.createdAt) return `Erstellt ${new Date(a.createdAt).toLocaleDateString('de-DE')}`
  return '–'
}

const FILTER_LEER = { start: '', ende: '', titel: '', kategorie: '', projekt: '', anschrift: '', mitarbeiter: '', erledigt: '' }

const SPALTEN = ['Start', 'Ende', 'Titel', 'Kategorie', 'Projekt', 'Anschrift', 'Mitarbeiter', 'Erstellt/Erledigt']

export default function Termine({ user }) {
  const appointments = useCollection('appointments')
  const patients = useCollection('patients')
  const projekte = useCollection('projekte')
  const users = useCollection('users')

  const [tab, setTab] = useState(user?.rolle === 'admin' ? 'alle' : 'meine')
  const [filter, setFilter] = useState(FILTER_LEER)
  const [gewaehlt, setGewaehlt] = useState(null)
  const [neu, setNeu] = useState(false)

  function setzeFilter(key, wert) {
    setFilter((f) => ({ ...f, [key]: wert }))
  }

  // Zeilen mit aufgelöstem Projekt + Mitarbeitern, Datum absteigend
  const zeilen = useMemo(() => {
    return appointments
      .map((a) => {
        const projekt = projekte.find((p) => p.id === a.projektId) || null
        const mitarbeiter = (a.mitarbeiterIds || [])
          .map((id) => users.find((u) => u.id === id))
          .filter(Boolean)
        return { a, projekt, mitarbeiter }
      })
      .sort((x, y) => `${y.a.datum} ${y.a.start}`.localeCompare(`${x.a.datum} ${x.a.start}`))
  }, [appointments, projekte, users])

  const gefiltert = useMemo(() => {
    const c = (wert, q) => !q || (wert || '').toLowerCase().includes(q.trim().toLowerCase())
    return zeilen.filter(({ a, projekt, mitarbeiter }) => {
      // Tab "Meine Termine": zugewiesen über mitarbeiterIds oder Altfeld arzt
      if (tab === 'meine') {
        const meiner =
          (user?.userId && (a.mitarbeiterIds || []).includes(user.userId)) ||
          (user?.name && a.arzt === user.name)
        if (!meiner) return false
      }
      const namen = mitarbeiter.length > 0 ? mitarbeiter.map((u) => u.name).join(' ') : a.arzt || ''
      if (!c(`${fmtDatum(a.datum)} ${a.start}`, filter.start)) return false
      if (!c(a.ende, filter.ende)) return false
      if (!c(a.titel || a.behandlung, filter.titel)) return false
      if (filter.kategorie && a.kategorie !== filter.kategorie) return false
      if (!c(projekt ? `${projekt.nummer} ${projekt.name}` : '', filter.projekt)) return false
      if (!c(projekt ? `${projekt.anschrift?.strasse || ''} ${projekt.anschrift?.plzOrt || ''}` : '', filter.anschrift)) return false
      if (!c(namen, filter.mitarbeiter)) return false
      if (!c(erstelltText(a), filter.erledigt)) return false
      return true
    })
  }, [zeilen, tab, filter, user])

  const filterInput = (key, platzhalter = 'Filtern …') => (
    <input
      value={filter[key]}
      onChange={(e) => setzeFilter(key, e.target.value)}
      placeholder={platzhalter}
      className="w-full min-w-[70px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-normal focus:outline-none focus:ring-2 focus:ring-praxis-500"
    />
  )

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-slate-900">Termine</h1>
        <div className="flex items-center gap-1 bg-white rounded-full border border-slate-200 p-1">
          {[['meine', 'Meine Termine'], ['alle', 'Alle Termine']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition ${
                tab === key ? 'bg-praxis-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 bg-white border border-slate-200 rounded-full px-2.5 py-1">
          {gefiltert.length}
        </span>
        <button
          onClick={() => setNeu(true)}
          className="ml-auto inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2.5 rounded-full"
        >
          <Icon name="plus" className="w-4 h-4" /> Termin
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
              {SPALTEN.map((s) => (
                <th key={s} className="px-3 py-3 font-semibold whitespace-nowrap first:pl-4 last:pr-4">{s}</th>
              ))}
            </tr>
            {/* Filterzeile: Textsuche je Spalte + Kategorie-Auswahl */}
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-3 py-2 pl-4">{filterInput('start', 'Datum/Zeit …')}</th>
              <th className="px-3 py-2">{filterInput('ende', 'Ende …')}</th>
              <th className="px-3 py-2">{filterInput('titel', 'Titel …')}</th>
              <th className="px-3 py-2">
                <select
                  value={filter.kategorie}
                  onChange={(e) => setzeFilter('kategorie', e.target.value)}
                  className="w-full min-w-[110px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-normal bg-white focus:outline-none focus:ring-2 focus:ring-praxis-500"
                >
                  <option value="">Alle</option>
                  {KATEGORIEN.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </th>
              <th className="px-3 py-2">{filterInput('projekt', 'Nummer/Name …')}</th>
              <th className="px-3 py-2">{filterInput('anschrift', 'Ort …')}</th>
              <th className="px-3 py-2">{filterInput('mitarbeiter', 'Name …')}</th>
              <th className="px-3 py-2 pr-4">{filterInput('erledigt', 'Erledigt …')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {gefiltert.map(({ a, projekt, mitarbeiter }) => {
              const kat = KATEGORIE_INFO[a.kategorie]
              return (
                <tr
                  key={a.id}
                  onClick={() => setGewaehlt(a)}
                  className={`cursor-pointer hover:bg-praxis-50/50 transition ${a.erledigt ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-3 pl-4 whitespace-nowrap font-semibold text-slate-900">
                    {fmtDatum(a.datum)} <span className="text-slate-400 font-normal">·</span> {a.start}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">{a.ende}</td>
                  <td className="px-3 py-3 max-w-[240px]">
                    <p className="font-medium text-slate-800 truncate">{a.titel || a.behandlung || '–'}</p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {kat ? (
                      <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${kat.farbe}`}>{kat.label}</span>
                    ) : (
                      <span className="text-slate-400">–</span>
                    )}
                  </td>
                  <td className="px-3 py-3 max-w-[240px]">
                    {projekt ? (
                      <Link
                        to={`/projekte/${projekt.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-praxis-700 font-medium hover:underline block truncate"
                      >
                        {projekt.nummer} · {projekt.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400">–</span>
                    )}
                  </td>
                  <td className="px-3 py-3 max-w-[200px] text-slate-600">
                    <p className="truncate">
                      {projekt?.anschrift
                        ? [projekt.anschrift.strasse, projekt.anschrift.plzOrt].filter(Boolean).join(', ') || '–'
                        : '–'}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {mitarbeiter.length > 0 ? (
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        {mitarbeiter.map((u) => (
                          <span key={u.id} className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-700">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: u.farbe || '#94a3b8' }} />
                            {u.name}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-slate-500">{a.arzt || '–'}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 pr-4 whitespace-nowrap text-xs text-slate-500">{erstelltText(a)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {gefiltert.length === 0 && (
          <p className="text-sm text-slate-400 text-center px-4 py-10">
            {tab === 'meine' ? 'Keine Termine, die dir zugewiesen sind.' : 'Keine Termine gefunden – Filter prüfen oder neuen Termin anlegen.'}
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Klick auf eine Zeile öffnet die Termin-Details (erledigt markieren, kopieren, absagen).
      </p>

      {gewaehlt && (
        <TerminModal
          termin={gewaehlt}
          patient={patients.find((p) => p.id === gewaehlt.patientId)}
          user={user}
          onClose={() => setGewaehlt(null)}
        />
      )}
      {neu && (
        <NeuerTermin
          patients={patients}
          appointments={appointments}
          vorbelegt={{}}
          bearbeiten={null}
          onClose={() => setNeu(false)}
        />
      )}
    </div>
  )
}
