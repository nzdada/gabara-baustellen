import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { useCollection } from '../hooks.js'

// Berichte-Eingang: alle Regieberichte/Reklamationen/Abnahmen über alle Projekte.
// Detail-Prüfung + Freigabe passiert im Projekt (Bereich Berichte); AP2 ergänzt
// manuelle Erfassung und PDF-Druck.

const TYP = {
  regie: { label: 'Regiebericht', farbe: 'bg-amber-100 text-amber-700' },
  reklamation: { label: 'Reklamation', farbe: 'bg-red-100 text-red-700' },
  abnahme: { label: 'Abnahme', farbe: 'bg-emerald-100 text-emerald-700' },
}

const STATUS = {
  entwurf: { label: 'Entwurf', farbe: 'bg-slate-100 text-slate-600' },
  eingereicht: { label: 'Eingereicht', farbe: 'bg-sky-100 text-sky-700' },
  freigegeben: { label: 'Freigegeben', farbe: 'bg-emerald-100 text-emerald-700' },
  abgerechnet: { label: 'Abgerechnet', farbe: 'bg-violet-100 text-violet-700' },
}

export default function Berichte() {
  const berichte = useCollection('berichte')
  const projekte = useCollection('projekte')
  const navigate = useNavigate()
  const [filter, setFilter] = useState('eingereicht')

  const projektName = (id) => projekte.find((p) => p.id === id)?.name || '–'
  const gefiltert = berichte
    .filter((b) => (filter === 'alle' ? true : b.status === filter))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Berichte</h1>
          <p className="text-sm text-slate-500">Regieberichte, Reklamationen und Abnahmen von den Baustellen</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[['eingereicht', 'Eingereicht'], ['entwurf', 'Entwürfe'], ['freigegeben', 'Freigegeben'], ['abgerechnet', 'Abgerechnet'], ['alle', 'Alle']].map(([wert, label]) => (
            <button
              key={wert}
              onClick={() => setFilter(wert)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filter === wert ? 'bg-praxis-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
              <span className="ml-1.5 opacity-70">
                {wert === 'alle' ? berichte.length : berichte.filter((b) => b.status === wert).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {gefiltert.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
          <Icon name="bericht" className="w-8 h-8 mx-auto mb-2" />
          Keine Berichte in dieser Ansicht.
        </div>
      ) : (
        <div className="space-y-2.5">
          {gefiltert.map((b) => (
            <button
              key={b.id}
              onClick={() => navigate(`/projekte/${b.projektId}?bereich=${b.typ === 'regie' ? 'regie' : b.typ === 'reklamation' ? 'reklamation' : 'abnahme'}`)}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-praxis-500 transition flex flex-wrap items-center gap-3"
            >
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${TYP[b.typ]?.farbe || 'bg-slate-100'}`}>
                {TYP[b.typ]?.label || b.typ}
              </span>
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold text-slate-900 truncate">{projektName(b.projektId)}</p>
                <p className="text-sm text-slate-500 truncate">
                  {new Date((b.datum || '') + 'T12:00:00').toLocaleDateString('de-DE')} · {b.mitarbeiterName || '–'}
                  {b.beschreibung ? ` · ${b.beschreibung}` : ''}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS[b.status]?.farbe || 'bg-slate-100'}`}>
                {STATUS[b.status]?.label || b.status}
              </span>
              <Icon name="arrowRight" className="w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
