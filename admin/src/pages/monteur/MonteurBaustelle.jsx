import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { heuteISO } from '@shared/slots.js'
import { useCollection, useWhere, withStore } from '../../hooks.js'
import BerichtForm from '../../components/BerichtForm.jsx'
import SpesenForm from '../../components/SpesenForm.jsx'

// Baustellen-Detail für Monteure: Arbeitsauftrag (LV mit Ist-Mengen-Eingabe),
// große Buttons für Regiebericht / Reklamation / Abnahme / Spesen,
// eigene Berichte mit Status. Große Touch-Ziele für die Baustelle.

const BERICHT_STATUS = {
  entwurf: ['Entwurf', 'bg-slate-100 text-slate-600'],
  eingereicht: ['Eingereicht', 'bg-sky-100 text-sky-700'],
  freigegeben: ['Freigegeben', 'bg-emerald-100 text-emerald-700'],
  abgerechnet: ['Abgerechnet', 'bg-violet-100 text-violet-700'],
}

// Ist-Mengen-Eingabe mit Debounce (600 ms + Flush bei blur) – nie jeden
// Tastendruck in den Store schreiben (Vorlagen-Lektion).
function IstFeld({ position, user }) {
  const [wert, setWert] = useState(position.istMenge ?? 0)
  const timer = useRef(null)
  const fokussiert = useRef(false)

  useEffect(() => {
    if (!fokussiert.current) setWert(position.istMenge ?? 0)
  }, [position.istMenge])

  function speichern(neu) {
    withStore((s) => s.update('lvpositionen', position.id, {
      istMenge: Number(neu) || 0,
      istVon: user?.name || '',
      istAm: heuteISO(),
    }))
  }

  function aenderung(e) {
    const neu = e.target.value
    setWert(neu)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => speichern(neu), 600)
  }

  function blur() {
    fokussiert.current = false
    clearTimeout(timer.current)
    speichern(wert)
  }

  return (
    <input
      type="number" inputMode="decimal" step="0.01" min="0"
      value={wert}
      onFocus={() => { fokussiert.current = true }}
      onChange={aenderung}
      onBlur={blur}
      className="w-24 rounded-xl border border-slate-200 px-2.5 py-2.5 text-base font-bold text-right focus:outline-none focus:ring-2 focus:ring-praxis-500"
    />
  )
}

export default function MonteurBaustelle({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const projekte = useCollection('projekte')
  const patients = useCollection('patients')
  const positionen = useWhere('lvpositionen', 'projektId', id)
  const berichte = useWhere('berichte', 'projektId', id)
  const [formTyp, setFormTyp] = useState(null)       // 'regie' | 'reklamation' | 'abnahme'
  const [bearbeite, setBearbeite] = useState(null)
  const [spesenForm, setSpesenForm] = useState(false)
  const [zeigeLangtext, setZeigeLangtext] = useState(null)

  const projekt = projekte.find((p) => p.id === id)
  const kunde = patients.find((k) => k.id === projekt?.kundeId)

  const arbeitsPositionen = useMemo(
    () => positionen.filter((p) => p.typ === 'position').sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    [positionen]
  )
  const wertbar = arbeitsPositionen.filter((p) => !p.flags?.bedarf && !p.flags?.nep)
  const soll = wertbar.reduce((s, p) => s + (p.menge || 0) * (p.einheitspreis || 0), 0)
  const ist = wertbar.reduce((s, p) => s + (p.istMenge || 0) * (p.einheitspreis || 0), 0)
  const prozent = soll > 0 ? Math.min(100, Math.round((ist / soll) * 100)) : 0

  // Kopie sortieren – das Array aus useWhere ist React-State und darf nicht mutiert werden
  const meineBerichte = [...berichte].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  if (!projekt) {
    return <div className="p-6 text-center text-slate-400">Baustelle nicht gefunden.</div>
  }

  const grosserKnopf = 'flex flex-col items-center justify-center gap-1.5 rounded-3xl py-5 font-bold text-sm active:scale-[0.98] transition'

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Kopf */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-400 flex items-center gap-1 mb-1.5">
          <Icon name="arrowLeft" className="w-4 h-4" /> Zurück
        </button>
        <p className="font-bold text-lg text-slate-900 leading-snug">{projekt.name}</p>
        <p className="text-sm text-slate-500">{projekt.nummer}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent([projekt.anschrift?.strasse, projekt.anschrift?.plzOrt].filter(Boolean).join(', '))}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-praxis-600 bg-praxis-50 rounded-xl px-3 py-2"
          >
            <Icon name="pin" className="w-4 h-4" /> Navigation
          </a>
          {kunde?.telefon && (
            <a href={`tel:${kunde.telefon.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-praxis-600 bg-praxis-50 rounded-xl px-3 py-2">
              <Icon name="phone" className="w-4 h-4" /> {kunde.firma || kunde.ansprechpartner || 'Kunde'}
            </a>
          )}
        </div>
        {soll > 0 && (
          <div className="mt-3">
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-praxis-600 rounded-full transition-all" style={{ width: `${prozent}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-400">{prozent} % geleistet ({euro(ist)} von {euro(soll)})</p>
          </div>
        )}
      </div>

      {/* Große Aktions-Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setFormTyp('regie')} className={`${grosserKnopf} bg-amber-500 text-white`}>
          <Icon name="bericht" className="w-7 h-7" /> Regiebericht
        </button>
        <button onClick={() => setFormTyp('reklamation')} className={`${grosserKnopf} bg-red-500 text-white`}>
          <Icon name="alert" className="w-7 h-7" /> Reklamation
        </button>
        <button onClick={() => setFormTyp('abnahme')} className={`${grosserKnopf} bg-emerald-600 text-white`}>
          <Icon name="signatur" className="w-7 h-7" /> Abnahme
        </button>
        <button onClick={() => setSpesenForm(true)} className={`${grosserKnopf} bg-slate-700 text-white`}>
          <Icon name="truck" className="w-7 h-7" /> Spesen
        </button>
      </div>

      {/* Arbeitsauftrag: LV-Positionen mit Ist-Mengen */}
      {arbeitsPositionen.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
          <p className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Icon name="list" className="w-5 h-5 text-praxis-600" /> Arbeitsauftrag (Ist-Mengen eintragen)
          </p>
          <div className="space-y-3">
            {arbeitsPositionen.map((p) => {
              const anteil = p.menge > 0 ? Math.min(100, Math.round(((p.istMenge || 0) / p.menge) * 100)) : 0
              return (
                <div key={p.id} className="border border-slate-100 rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => setZeigeLangtext(zeigeLangtext === p.id ? null : p.id)} className="text-left flex-1 min-w-0">
                      <p className="text-xs text-slate-400">{p.oz}</p>
                      <p className="text-sm font-semibold text-slate-800">{p.kurztext}</p>
                    </button>
                    <div className="text-right shrink-0">
                      <IstFeld position={p} user={user} />
                      <p className="text-[11px] text-slate-400 mt-0.5">von {p.menge} {p.einheit}</p>
                    </div>
                  </div>
                  {zeigeLangtext === p.id && p.langtext && (
                    <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 whitespace-pre-wrap">{p.langtext}</p>
                  )}
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${anteil >= 100 ? 'bg-emerald-500' : 'bg-praxis-500'}`} style={{ width: `${anteil}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Berichte dieser Baustelle */}
      {meineBerichte.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
          <p className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Icon name="bericht" className="w-5 h-5 text-praxis-600" /> Berichte
          </p>
          <div className="space-y-2">
            {meineBerichte.map((b) => {
              const [label, farbe] = BERICHT_STATUS[b.status] || BERICHT_STATUS.entwurf
              const typLabel = b.typ === 'regie' ? 'Regiebericht' : b.typ === 'reklamation' ? 'Reklamation' : 'Abnahme'
              return (
                <button key={b.id}
                  onClick={() => b.status === 'entwurf' && setBearbeite(b)}
                  className="w-full text-left flex items-center gap-2.5 border border-slate-100 rounded-2xl px-3 py-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{typLabel}</span>
                    <span className="block text-xs text-slate-400 truncate">
                      {new Date((b.datum || '') + 'T12:00:00').toLocaleDateString('de-DE')} · {b.mitarbeiterName}{b.beschreibung ? ` · ${b.beschreibung}` : ''}
                    </span>
                  </span>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 ${farbe}`}>{label}</span>
                  {b.status === 'entwurf' && <Icon name="arrowRight" className="w-4 h-4 text-slate-300 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {formTyp && <BerichtForm typ={formTyp} projektId={id} user={user} onClose={() => setFormTyp(null)} />}
      {bearbeite && <BerichtForm typ={bearbeite.typ} bericht={bearbeite} user={user} onClose={() => setBearbeite(null)} />}
      {spesenForm && <SpesenForm projektId={id} user={user} onClose={() => setSpesenForm(false)} />}
    </div>
  )
}
