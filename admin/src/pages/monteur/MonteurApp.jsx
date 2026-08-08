import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { abmelden, istMonteurRolle } from '@shared/auth.js'
import { ZahnLogo, Icon, SprachSchalter, ThemaSchalter } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { istOffen } from '@shared/projektstatus.js'
import { teamFuerTermin } from '@shared/teams.js'
import { heuteISO } from '@shared/slots.js'
import { useCollection, withStore } from '../../hooks.js'
import DatumWahl from '../../components/DatumWahl.jsx'
import SpesenForm from '../../components/SpesenForm.jsx'
import MonteurBaustelle from './MonteurBaustelle.jsx'
import Heute from './Heute.jsx'
import StundenKachel from './StundenKachel.jsx'
import RegieMelden from './RegieMelden.jsx'
import AufmassRaum from './AufmassRaum.jsx'
import FotoLeiste from './FotoLeiste.jsx'

// Handy-Ansicht für Monteure (V2, Plan Kapitel 3.1): untere Leiste
// HEUTE · RÄUME · STUNDEN – drei Knöpfe. HEUTE öffnet direkt den Einsatz des
// Tages (kein Zwischenmenü); Spesen sind über STUNDEN erreichbar, Regie über
// den Kopf von HEUTE. Läuft im Vollbild ohne Admin-Chrome, Admins erreichen
// sie als Vorschau über /monteur.
//
// Die alte Terminliste (V1-appointments) bleibt als Rückfallebene, solange
// noch keine V2-Einsätze existieren (Migration = AP 10). Die alte
// Mengen-Eingabe (MengeMelden) ist aus der Navigation genommen – die Datei
// bleibt, bis AP 10 sie endgültig ablöst.

const KATEGORIE = {
  umsetzung: { schluessel: 'kat.umsetzung', farbe: 'bg-praxis-100 text-praxis-800' },
  fertigstellung: { schluessel: 'kat.fertigstellung', farbe: 'bg-emerald-100 text-emerald-700' },
  reklamation: { schluessel: 'kat.reklamationKurz', farbe: 'bg-red-100 text-red-700' },
  krank: { schluessel: 'kat.krankKurz', farbe: 'bg-amber-100 text-amber-800' },
  privat: { schluessel: 'kat.privatKurz', farbe: 'bg-slate-200 text-slate-600' },
}

// Lokales Datum – toISOString() waere UTC und nachts einen Tag zurueck
const heuteIso = heuteISO

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

function EinsatzKarte({ termin, projekt, team, onErledigt, onOeffnen }) {
  const kat = KATEGORIE[termin.kategorie]
  return (
    <div
      className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 border-l-8"
      style={team?.farbe ? { borderLeftColor: team.farbe } : undefined}
    >
      {team?.explizit && (
        <p className="text-[12px] font-bold uppercase tracking-wide mb-0.5" style={{ color: team.farbe }}>
          {team.name}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-bold text-slate-900" dir="ltr">{termin.start} – {termin.ende} Uhr</p>
        {kat && <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${kat.farbe}`}>{t(kat.schluessel)}</span>}
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
            {t('monteur.zurBaustelle')}
          </button>
        )}
        <button onClick={onErledigt}
          className={`flex-1 py-3.5 rounded-2xl font-bold text-sm border ${
            termin.erledigt ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'
          }`}>
          {termin.erledigt ? t('monteur.erledigt') : t('monteur.erledigtMelden')}
        </button>
      </div>
    </div>
  )
}

// V1-Rückfallebene: die Terminliste aus appointments. Wird nur noch gezeigt,
// wenn für heute KEIN V2-Einsatz existiert (siehe Heute.jsx).
function TerminListe({ user }) {
  const appointments = useCollection('appointments')
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const navigate = useNavigate()
  const heute = heuteIso()
  const [ansicht, setAnsicht] = useState('liste')  // liste | kalender
  const [tag, setTag] = useState(heute)

  // Alle mir zugewiesenen Einsätze auf offenen Baustellen (Basis für beide Ansichten)
  const alleMeine = useMemo(() => appointments
    .filter((t) => istMeiner(t, user) && t.status !== 'abgesagt' && t.kategorie !== 'privat')
    .filter((t) => {
      const p = projekte.find((x) => x.id === t.projektId)
      return !p || istOffen(p.status) // abgeschlossene Baustellen verschwinden vom Handy
    })
    .sort((a, b) => `${a.datum}${a.start || ''}`.localeCompare(`${b.datum}${b.start || ''}`)),
    [appointments, projekte, user])

  // Listenansicht blendet erledigte Alt-Termine aus, die Kalenderansicht zeigt alles
  const meine = useMemo(() => alleMeine.filter((t) => t.datum >= heute || !t.erledigt), [alleMeine, heute])

  const marker = useMemo(() => {
    const m = {}
    for (const t of alleMeine) m[t.datum] = (m[t.datum] || 0) + 1
    return m
  }, [alleMeine])

  const desTages = useMemo(() => alleMeine.filter((t) => t.datum === tag), [alleMeine, tag])

  const gruppen = [
    [t('monteur.heute'), meine.filter((x) => x.datum === heute)],
    [t('monteur.demnaechst'), meine.filter((x) => x.datum > heute)],
    [t('monteur.frueher'), meine.filter((x) => x.datum < heute && !x.erledigt)],
  ]

  async function erledigt(t) {
    await withStore((s) => s.update('appointments', t.id, { erledigt: !t.erledigt, erledigtAm: !t.erledigt ? heute : '' }))
  }

  const karte = (t) => (
    <EinsatzKarte
      termin={t}
      projekt={projekte.find((p) => p.id === t.projektId)}
      team={teamFuerTermin(t, users)}
      onErledigt={() => erledigt(t)}
      onOeffnen={() => navigate(`/monteur/baustelle/${t.projektId}`)}
    />
  )

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Umschalter Liste / Kalender */}
      <div className="flex items-center gap-1 bg-white rounded-2xl border border-slate-200 p-1">
        {[['liste', t('monteur.liste'), 'list'], ['kalender', t('monteur.kalender'), 'calendar']].map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setAnsicht(id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition ${
              ansicht === id ? 'bg-praxis-600 text-white' : 'text-slate-500'
            }`}
          >
            <Icon name={icon} className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {ansicht === 'kalender' ? (
        <>
          <DatumWahl wert={tag} onWert={setTag} marker={marker} />
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {datumLok(tag, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {desTages.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400">
              <Icon name="calendar" className="w-9 h-9 mx-auto mb-2" />
              {t('monteur.nichtsAmTag')}
            </div>
          ) : (
            <div className="space-y-3">
              {desTages.map((t) => <div key={t.id}>{karte(t)}</div>)}
            </div>
          )}
        </>
      ) : (
        <>
          {meine.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 mt-6">
              <Icon name="calendar" className="w-9 h-9 mx-auto mb-2" />
              {t('monteur.keineEinsaetze')}
            </div>
          )}
          {gruppen.map(([titel, liste]) => liste.length > 0 && (
            <div key={titel}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{titel}</p>
              <div className="space-y-3">
                {liste.map((t) => (
                  <div key={t.id}>
                    <p className="text-xs text-slate-400 mb-1">{datumLok(t.datum, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    {karte(t)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
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
          <Icon name="folder" className="w-9 h-9 mx-auto mb-2" /> {t('monteur.keineBaustellen')}
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
                <p className="mt-1 text-xs text-slate-400">{t('monteur.geleistet', { prozent, ist: euro(ist), soll: euro(soll) })}</p>
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

  const STATUS = {
    entwurf: ['status.entwurf', 'bg-slate-100 text-slate-600'],
    eingereicht: ['status.eingereicht', 'bg-sky-100 text-sky-700'],
    erstattet: ['status.erstattet', 'bg-emerald-100 text-emerald-700'],
  }

  return (
    <div className="p-4 space-y-3 pb-24">
      <button onClick={() => setNeu(true)}
        className="w-full py-4 rounded-3xl bg-praxis-600 text-white font-bold active:scale-[0.99]">
        {t('monteur.spesenErfassen')}
      </button>
      {meine.map((s) => {
        const [schluessel, farbe] = STATUS[s.status] || STATUS.entwurf
        return (
          <button key={s.id} onClick={() => s.status === 'entwurf' && setBearbeite(s)}
            className="w-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <Icon name={s.typ === 'fahrt' ? 'truck' : 'euro'} className="w-5 h-5 text-praxis-600 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-slate-800">
                {s.typ === 'fahrt' ? t('monteur.fahrtKm', { km: s.fahrt?.km || 0 }) : s.typ === 'hotel' ? t('monteur.hotel') : t('monteur.spesen')}
              </span>
              <span className="block text-xs text-slate-400 truncate">
                {datumLok(s.datum || heuteIso())}{s.kommentar ? ` · ${s.kommentar}` : ''}
              </span>
            </span>
            <span className="font-bold">{euro(s.betrag)}</span>
            <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${farbe}`}>{t(schluessel)}</span>
          </button>
        )
      })}
      {neu && <SpesenForm user={user} onClose={() => setNeu(false)} />}
      {bearbeite && <SpesenForm spesen={bearbeite} user={user} onClose={() => setBearbeite(null)} />}
    </div>
  )
}

const TABS = [
  { to: '/monteur', schluessel: 'mt.tabHeute', icon: 'calendar', exakt: true },
  { to: '/monteur/raeume', schluessel: 'mt.tabRaeume', icon: 'raum' },
  { to: '/monteur/stunden', schluessel: 'mt.tabStunden', icon: 'clock' },
]

export default function MonteurApp({ user, vorschau = false }) {
  useLang() // Sprachwechsel -> Neuaufbau der gesamten Handy-Ansicht
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-praxis-900 text-white h-14 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <ZahnLogo className="w-6 h-6 text-praxis-200 shrink-0" />
          <div className="leading-tight min-w-0">
            <p className="font-bold text-sm truncate">{t('monteur.titel')}</p>
            <p className="text-[11px] text-praxis-200/70 truncate">{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SprachSchalter dunkel />
          <ThemaSchalter dunkel />
          {vorschau && (
            <button onClick={() => navigate('/')} className="text-xs font-bold bg-white/10 rounded-lg px-2.5 py-1.5">
              {t('nav.zurVerwaltung')}
            </button>
          )}
          <button onClick={abmelden} className="text-praxis-200"><Icon name="logout" className="w-5 h-5" /></button>
        </div>
      </header>

      {/* AP 6: Offline-Banner, Warteschlangen-Balken (⬆ n warten), Gate-Streifen */}
      <FotoLeiste user={user} />

      <main>
        {!user?.userId && istMonteurRolle(user?.rolle) && (
          <p className="m-4 mb-0 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            {t('monteur.keinProfil')}
          </p>
        )}
        <Routes>
          <Route path="/monteur" element={<Heute user={user} fallback={<TerminListe user={user} />} />} />
          <Route path="/monteur/raeume" element={<Baustellen user={user} />} />
          <Route path="/monteur/baustellen" element={<Navigate to="/monteur/raeume" replace />} />
          <Route path="/monteur/baustelle/:id" element={<MonteurBaustelle user={user} />} />
          <Route path="/monteur/stunden" element={<StundenKachel user={user} />} />
          <Route path="/monteur/regie" element={<RegieMelden user={user} />} />
          <Route path="/monteur/aufmass" element={<AufmassRaum user={user} />} />
          <Route path="/monteur/spesen" element={<Spesen user={user} />} />
          <Route path="*" element={<Navigate to="/monteur" replace />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.exakt}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-3 text-[12px] font-bold ${isActive ? 'text-praxis-700' : 'text-slate-400'}`
            }>
            <Icon name={tab.icon} className="w-6 h-6" />
            {t(tab.schluessel)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
