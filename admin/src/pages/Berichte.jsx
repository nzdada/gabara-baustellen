import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { useCollection, useEinstellungen, withStore } from '../hooks.js'
import BerichtForm from '../components/BerichtForm.jsx'
import SpesenForm from '../components/SpesenForm.jsx'
import { druckeRegiebericht, druckeAbnahme } from '../drucken.js'

// Berichte-Eingang: alle Regieberichte/Reklamationen/Abnahmen + Spesen.
// Manuelle Erfassung im Büro (Übergang bis zur Flutter-App), Freigabe, PDF-Druck.

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
  erstattet: { label: 'Erstattet', farbe: 'bg-violet-100 text-violet-700' },
}

const SPESEN_TYP = { fahrt: 'Fahrt', hotel: 'Hotel', sonstig: 'Sonstig' }

export default function Berichte({ user }) {
  const berichte = useCollection('berichte')
  const spesen = useCollection('spesen')
  const photos = useCollection('photos')
  const projekte = useCollection('projekte')
  const patients = useCollection('patients')
  const einst = useEinstellungen()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('eingereicht')
  const [neuTyp, setNeuTyp] = useState(null)       // 'regie'|'reklamation'|'abnahme'
  const [bearbeite, setBearbeite] = useState(null) // bericht-Objekt
  const [spesenModal, setSpesenModal] = useState(false)
  const [bearbeiteSpesen, setBearbeiteSpesen] = useState(null)

  const projektVon = (id) => projekte.find((p) => p.id === id)
  const kundeVon = (projekt) => patients.find((k) => k.id === projekt?.kundeId)

  function drucken(b) {
    const projekt = projektVon(b.projektId)
    const kunde = kundeVon(projekt)
    const fotos = photos.filter((p) => p.berichtId === b.id)
    if (b.typ === 'abnahme') druckeAbnahme({ bericht: b, projekt, kunde, fotos, einst })
    else druckeRegiebericht({ bericht: b, projekt, kunde, fotos, einst })
  }

  async function freigeben(b) {
    // Zeitstempel + Person dokumentieren (Beweiswert auf dem Ausdruck)
    await withStore((s) => s.update('berichte', b.id, {
      status: 'freigegeben', freigegebenAm: Date.now(), freigegebenVon: user?.name || '',
    }))
  }

  const gefiltert = filter === 'spesen'
    ? []
    : berichte
        .filter((b) => (filter === 'alle' ? true : b.status === filter))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const spesenListe = [...spesen].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Berichte</h1>
          <p className="text-sm text-slate-500">Regieberichte, Reklamationen, Abnahmen und Spesen von den Baustellen</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setNeuTyp('regie')} className="px-3 py-2 rounded-xl bg-praxis-600 text-white text-sm font-medium hover:bg-praxis-700">+ Regiebericht</button>
          <button onClick={() => setNeuTyp('reklamation')} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium hover:bg-slate-50">+ Reklamation</button>
          <button onClick={() => setNeuTyp('abnahme')} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium hover:bg-slate-50">+ Abnahme</button>
          <button onClick={() => setSpesenModal(true)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium hover:bg-slate-50">+ Spesen</button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-5">
        {[['eingereicht', 'Eingereicht'], ['entwurf', 'Entwürfe'], ['freigegeben', 'Freigegeben'], ['abgerechnet', 'Abgerechnet'], ['alle', 'Alle Berichte'], ['spesen', 'Spesen']].map(([wert, label]) => (
          <button
            key={wert}
            onClick={() => setFilter(wert)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filter === wert ? 'bg-praxis-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
            <span className="ml-1.5 opacity-70">
              {wert === 'alle' ? berichte.length : wert === 'spesen' ? spesen.length : berichte.filter((b) => b.status === wert).length}
            </span>
          </button>
        ))}
      </div>

      {filter === 'spesen' ? (
        spesenListe.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
            <Icon name="truck" className="w-8 h-8 mx-auto mb-2" /> Keine Spesen erfasst.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3">Datum</th><th className="px-4 py-3">Projekt</th><th className="px-4 py-3">Mitarbeiter</th>
                  <th className="px-4 py-3">Typ</th><th className="px-4 py-3">Details</th><th className="px-4 py-3 text-right">Betrag</th><th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {spesenListe.map((s) => (
                  <tr key={s.id} onClick={() => setBearbeiteSpesen(s)} className="border-b border-slate-50 hover:bg-praxis-50/40 cursor-pointer">
                    <td className="px-4 py-3">{new Date((s.datum || '') + 'T12:00:00').toLocaleDateString('de-DE')}</td>
                    <td className="px-4 py-3">{projektVon(s.projektId)?.name || '–'}</td>
                    <td className="px-4 py-3">{s.mitarbeiterName || '–'}</td>
                    <td className="px-4 py-3">{SPESEN_TYP[s.typ] || s.typ}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.typ === 'fahrt' && s.fahrt ? `${s.fahrt.km} km × ${euro(s.fahrt.kmSatz)}${s.fahrt.automatisch ? ' (auto)' : ''}` : (s.kommentar || '–')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{euro(s.betrag)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS[s.status]?.farbe || 'bg-slate-100'}`}>{STATUS[s.status]?.label || s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : gefiltert.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
          <Icon name="bericht" className="w-8 h-8 mx-auto mb-2" /> Keine Berichte in dieser Ansicht.
        </div>
      ) : (
        <div className="space-y-2.5">
          {gefiltert.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${TYP[b.typ]?.farbe || 'bg-slate-100'}`}>
                {TYP[b.typ]?.label || b.typ}
              </span>
              <button
                onClick={() => navigate(`/projekte/${b.projektId}`)}
                className="flex-1 min-w-[200px] text-left"
              >
                <p className="font-semibold text-slate-900 truncate">{projektVon(b.projektId)?.name || '–'}</p>
                <p className="text-sm text-slate-500 truncate">
                  {new Date((b.datum || '') + 'T12:00:00').toLocaleDateString('de-DE')} · {b.mitarbeiterName || '–'}
                  {b.beschreibung ? ` · ${b.beschreibung}` : ''}
                </p>
              </button>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS[b.status]?.farbe || 'bg-slate-100'}`}>
                {STATUS[b.status]?.label || b.status}
              </span>
              <div className="flex gap-1.5">
                {b.status === 'eingereicht' && (
                  <button onClick={() => freigeben(b)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">Freigeben</button>
                )}
                {['entwurf', 'eingereicht'].includes(b.status) ? (
                  <button onClick={() => setBearbeite(b)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200">Bearbeiten</button>
                ) : (
                  <button onClick={() => setBearbeite(b)} className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-400 text-xs font-medium" title="Freigegeben – nur Ansicht (Beweissicherung)">Ansehen</button>
                )}
                <button onClick={() => drucken(b)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 flex items-center gap-1">
                  <Icon name="doc" className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {neuTyp && <BerichtForm typ={neuTyp} user={user} onClose={() => setNeuTyp(null)} />}
      {bearbeite && <BerichtForm typ={bearbeite.typ} bericht={bearbeite} user={user} onClose={() => setBearbeite(null)} />}
      {spesenModal && <SpesenForm user={user} onClose={() => setSpesenModal(false)} />}
      {bearbeiteSpesen && <SpesenForm spesen={bearbeiteSpesen} user={user} onClose={() => setBearbeiteSpesen(null)} />}
    </div>
  )
}
