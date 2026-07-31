import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { abmelden } from '@shared/auth.js'
import { ZahnLogo, Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { istOffen } from '@shared/projektstatus.js'
import { useCollection, withStore } from '../../hooks.js'
import SpesenForm from '../../components/SpesenForm.jsx'
import MonteurBaustelle from './MonteurBaustelle.jsx'

// Handy-Ansicht für Monteure: große Buttons, wenig Text, alles Wichtige in
// drei Tabs (Heute · Baustellen · Spesen). Läuft im Vollbild ohne Admin-Chrome.
// Admins erreichen sie als Vorschau über /monteur.

const KATEGORIE = {
  umsetzung: { label: 'Umsetzung', farbe: 'bg-praxis-100 text-praxis-800' },
  fertigstellung: { label: 'Fertigstellung', farbe: 'bg-emerald-100 text-emerald-700' },
  reklamation: { label: 'Reklamation', farbe: 'bg-red-100 text-red-700' },
  krank: { label: 'Abwesend', farbe: 'bg-amber-100 text-amber-800' },
  privat: { label: 'Privat', farbe: 'bg-slate-200 text-slate-600' },
}

function heuteIso() {
  return new Date().toISOString().slice(0, 10)
}

function mapsLink(anschrift) {
  const q = [anschrift?.strasse, anschrift?.plzOrt].filter(Boolean).join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`
}

// Meine Einsätze: zugewiesen über mitarbeiterIds (Fallback: Altfeld arzt = mein Name)
function istMeiner(termin, user) {
  if (user?.rolle === 'admin') return true // Admin-Vorschau sieht alles
  if ((termin.mitarbeiterIds || []).includes(user?.userId)) return true
  return Boolean(termin.arzt && termin.arzt === user?.name)
}

function EinsatzKarte({ termin, projekt, onErledigt, onOeffnen }) {
  const kat = KATEGORIE[termin.kategorie]
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-bold text-slate-900" dir="ltr">{termin.start} – {termin.ende} Uhr</p>
        {kat && <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${kat.farbe}`}>{kat.label}</span>}
      </div>
      <p className="mt-1 font-semibold text-slate-800">{termin.titel || termin.behandlung}</p>
      {projekt && (
        <>
          <p className="text-sm text-slate-500">{projekt.nummer} · {projekt.name}</p>
          <a
            href={mapsLink(projekt.anschrift)}
            target="_blank" rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-praxis-600 font-medium"
          >
            <Icon name="pin" className="w-4 h-4" />
            {[projekt.anschrift?.strasse, projekt.anschrift?.plzOrt].filter(Boolean).join(', ')}
          </a>
        </>
      )}
      {termin.beschreibung && (
        <p className="mt-2 text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 whitespace-pre-wrap">{termin.beschreibung}</p>
      )}
      <div className="mt-3 flex gap-2">
        {projekt && (
          <button onClick={onOeffnen}
            className="flex-1 py-3.5 rounded-2xl bg-praxis-600 text-white font-bold text-sm active:scale-[0.99]">
            Zur Baustelle
          </button>
        )}
        <button onClick={onErledigt}
          className={`flex-1 py-3.5 rounded-2xl font-bold text-sm border ${
            termin.erledigt ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'
          }`}>
          {termin.erledigt ? 'Erledigt' : 'Erledigt melden'}
        </button>
      </div>
    </div>
  )
}

function Heute({ user }) {
  const appointments = useCollection('appointments')
  const projekte = useCollection('projekte')
  const navigate = useNavigate()
  const heute = heuteIso()

  const meine = useMemo(() => appointments
    .filter((t) => istMeiner(t, user) && t.status !== 'abgesagt' && t.kategorie !== 'privat')
    .filter((t) => {
      const p = projekte.find((x) => x.id === t.projektId)
      return !p || istOffen(p.status) // abgeschlossene Baustellen verschwinden vom Handy
    })
    .filter((t) => t.datum >= heute || !t.erledigt)
    .sort((a, b) => (a.datum + a.start).localeCompare(b.datum + b.start)), [appointments, projekte, user, heute])

  const gruppen = [
    ['Heute', meine.filter((t) => t.datum === heute)],
    ['Demnächst', meine.filter((t) => t.datum > heute)],
    ['Offen von früher', meine.filter((t) => t.datum < heute && !t.erledigt)],
  ]

  async function erledigt(t) {
    await withStore((s) => s.update('appointments', t.id, { erledigt: !t.erledigt, erledigtAm: !t.erledigt ? heute : '' }))
  }

  return (
    <div className="p-4 space-y-5 pb-24">
      {meine.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 mt-6">
          <Icon name="calendar" className="w-9 h-9 mx-auto mb-2" />
          Keine Einsätze zugewiesen. Das Büro plant deine Einsätze im Kalender.
        </div>
      )}
      {gruppen.map(([titel, liste]) => liste.length > 0 && (
        <div key={titel}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{titel}</p>
          <div className="space-y-3">
            {liste.map((t) => (
              <div key={t.id}>
                <p className="text-xs text-slate-400 mb-1">{new Date(t.datum + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <EinsatzKarte
                  termin={t}
                  projekt={projekte.find((p) => p.id === t.projektId)}
                  onErledigt={() => erledigt(t)}
                  onOeffnen={() => navigate(`/monteur/baustelle/${t.projektId}`)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Baustellen({ user }) {
  const appointments = useCollection('appointments')
  const projekte = useCollection('projekte')
  const lv = useCollection('lvpositionen')
  const navigate = useNavigate()

  const meineProjekte = useMemo(() => {
    const ids = new Set(appointments.filter((t) => istMeiner(t, user)).map((t) => t.projektId).filter(Boolean))
    return projekte.filter((p) => ids.has(p.id) && istOffen(p.status))
  }, [appointments, projekte, user])

  return (
    <div className="p-4 space-y-3 pb-24">
      {meineProjekte.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 mt-6">
          <Icon name="folder" className="w-9 h-9 mx-auto mb-2" /> Keine aktiven Baustellen zugewiesen.
        </div>
      )}
      {meineProjekte.map((p) => {
        const pos = lv.filter((x) => x.projektId === p.id && x.typ === 'position' && !x.flags?.bedarf && !x.flags?.nep)
        const soll = pos.reduce((s, x) => s + (x.menge || 0) * (x.einheitspreis || 0), 0)
        const ist = pos.reduce((s, x) => s + (x.istMenge || 0) * (x.einheitspreis || 0), 0)
        const prozent = soll > 0 ? Math.min(100, Math.round((ist / soll) * 100)) : 0
        return (
          <button key={p.id} onClick={() => navigate(`/monteur/baustelle/${p.id}`)}
            className="w-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm p-4 active:scale-[0.99]">
            <p className="font-bold text-slate-900">{p.name}</p>
            <p className="text-sm text-slate-500">{p.nummer} · {[p.anschrift?.strasse, p.anschrift?.plzOrt].filter(Boolean).join(', ')}</p>
            {soll > 0 && (
              <div className="mt-2.5">
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-praxis-600 rounded-full" style={{ width: `${prozent}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-400">{prozent} % geleistet ({euro(ist)} von {euro(soll)})</p>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Spesen({ user }) {
  const spesen = useCollection('spesen')
  const [neu, setNeu] = useState(false)
  const [bearbeite, setBearbeite] = useState(null)

  const meine = spesen
    .filter((s) => user?.rolle === 'admin'
      || s.mitarbeiterId === user?.userId
      || (s.mitarbeiterName && s.mitarbeiterName === user?.name))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const STATUS = { entwurf: ['Entwurf', 'bg-slate-100 text-slate-600'], eingereicht: ['Eingereicht', 'bg-sky-100 text-sky-700'], erstattet: ['Erstattet', 'bg-emerald-100 text-emerald-700'] }

  return (
    <div className="p-4 space-y-3 pb-24">
      <button onClick={() => setNeu(true)}
        className="w-full py-4 rounded-3xl bg-praxis-600 text-white font-bold active:scale-[0.99]">
        + Spesen erfassen (Fahrt / Hotel)
      </button>
      {meine.map((s) => {
        const [label, farbe] = STATUS[s.status] || STATUS.entwurf
        return (
          <button key={s.id} onClick={() => s.status === 'entwurf' && setBearbeite(s)}
            className="w-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <Icon name={s.typ === 'fahrt' ? 'truck' : 'euro'} className="w-5 h-5 text-praxis-600 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-slate-800">
                {s.typ === 'fahrt' ? `Fahrt ${s.fahrt?.km || 0} km` : s.typ === 'hotel' ? 'Hotel' : 'Spesen'}
              </span>
              <span className="block text-xs text-slate-400 truncate">
                {new Date((s.datum || '') + 'T12:00:00').toLocaleDateString('de-DE')}{s.kommentar ? ` · ${s.kommentar}` : ''}
              </span>
            </span>
            <span className="font-bold">{euro(s.betrag)}</span>
            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${farbe}`}>{label}</span>
          </button>
        )
      })}
      {neu && <SpesenForm user={user} onClose={() => setNeu(false)} />}
      {bearbeite && <SpesenForm spesen={bearbeite} user={user} onClose={() => setBearbeite(null)} />}
    </div>
  )
}

const TABS = [
  { to: '/monteur', label: 'Heute', icon: 'calendar', exakt: true },
  { to: '/monteur/baustellen', label: 'Baustellen', icon: 'folder' },
  { to: '/monteur/spesen', label: 'Spesen', icon: 'truck' },
]

export default function MonteurApp({ user, vorschau = false }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-praxis-900 text-white h-14 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <ZahnLogo className="w-6 h-6 text-praxis-200 shrink-0" />
          <div className="leading-tight min-w-0">
            <p className="font-bold text-sm truncate">Gabara Baustellen</p>
            <p className="text-[10px] text-praxis-200/70 truncate">{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {vorschau && (
            <button onClick={() => navigate('/')} className="text-xs font-bold bg-white/10 rounded-lg px-2.5 py-1.5">
              Zur Verwaltung
            </button>
          )}
          <button onClick={abmelden} className="text-praxis-200"><Icon name="logout" className="w-5 h-5" /></button>
        </div>
      </header>

      <main>
        {!user?.userId && user?.rolle === 'mitarbeiter' && (
          <p className="m-4 mb-0 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            Dein Login ist noch keinem Mitarbeiter-Profil zugeordnet – du siehst deshalb keine Einsätze.
            Das Büro legt dich unter Einstellungen → Mitarbeiter an (gleiche E-Mail wie dein Login).
          </p>
        )}
        <Routes>
          <Route path="/monteur" element={<Heute user={user} />} />
          <Route path="/monteur/baustellen" element={<Baustellen user={user} />} />
          <Route path="/monteur/baustelle/:id" element={<MonteurBaustelle user={user} />} />
          <Route path="/monteur/spesen" element={<Spesen user={user} />} />
          <Route path="*" element={<Navigate to="/monteur" replace />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.exakt}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-bold ${isActive ? 'text-praxis-700' : 'text-slate-400'}`
            }>
            <Icon name={t.icon} className="w-6 h-6" />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
