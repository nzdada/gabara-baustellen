import { useEffect, useRef, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { beobachteAnmeldung, abmelden } from '@shared/auth.js'
import { storeModus } from '@shared/store.js'
import { ZahnLogo, Icon } from '@shared/ui.jsx'
import Login from './pages/Login.jsx'
import Uebersicht from './pages/Uebersicht.jsx'
import Projekte from './pages/Projekte.jsx'
import ProjektDetail from './pages/ProjektDetail.jsx'
import Kalender from './pages/Kalender.jsx'
import Termine from './pages/Termine.jsx'
import Kunden from './pages/Kunden.jsx'
import Berichte from './pages/Berichte.jsx'
import Anfragen from './pages/Anfragen.jsx'
import Import from './pages/Import.jsx'
import Einstellungen from './pages/Einstellungen.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Abrechnung from './pages/Abrechnung.jsx'
import MonteurApp from './pages/monteur/MonteurApp.jsx'
import { useCollection } from './hooks.js'

// Reihenfolge = Sichtbarkeit: Kalender ist die Startseite der Verwaltung.
const NAV = [
  { to: '/', label: 'Kalender', icon: 'calendar', exakt: true },
  { to: '/projekte', label: 'Projekte', icon: 'folder' },
  { to: '/termine', label: 'Termine', icon: 'list' },
  { to: '/berichte', label: 'Berichte', icon: 'bericht' },
  { to: '/kunden', label: 'Kunden', icon: 'users' },
  { to: '/abrechnung', label: 'Abrechnung', icon: 'euro' },
  { to: '/uebersicht', label: 'Übersicht', icon: 'home' },
  { to: '/anfragen', label: 'Anfragen', icon: 'inbox' },
  { to: '/dashboard', label: 'Dashboard', icon: 'chat' },
  { to: '/import', label: 'Import', icon: 'upload' },
  { to: '/einstellungen', label: 'Einstellungen', icon: 'bell' },
  { to: '/monteur', label: 'Monteur-Ansicht', icon: 'tablet' },
]

// Dezenter Doppel-Piepton für neue Anfragen/Berichte (WebAudio, kein Audio-Asset nötig)
function piepton() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.18].forEach((versatz, i) => {
      const osc = ctx.createOscillator()
      const lautstaerke = ctx.createGain()
      osc.connect(lautstaerke)
      lautstaerke.connect(ctx.destination)
      osc.frequency.value = i === 0 ? 880 : 1174
      lautstaerke.gain.setValueAtTime(0.06, ctx.currentTime + versatz)
      lautstaerke.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + versatz + 0.15)
      osc.start(ctx.currentTime + versatz)
      osc.stop(ctx.currentTime + versatz + 0.16)
    })
  } catch (e) { /* Autoplay-Richtlinie o. ä. – Ton ist optional */ }
}

// Toast oben rechts: neue Webseiten-Anfragen UND neu eingereichte Berichte.
// WICHTIG: useCollection startet mit [] und liefert die echten Daten erst danach.
// Ohne Zeitschranke gälten deshalb beim Mounten (z. B. Rückkehr aus der
// Monteur-Ansicht) ALLE vorhandenen Einträge als "neu" -> Fehlalarm.
// Darum zusätzlich zum Bekannt-Set: nur melden, was NACH dem Mounten entstand.
function LiveToast() {
  const requests = useCollection('requests')
  const berichte = useCollection('berichte')
  const navigate = useNavigate()
  const seit = useRef(Date.now())
  const bekannteAnfragen = useRef(new Set())
  const bekannteBerichte = useRef(new Set())
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const offene = requests.filter((r) => r.status === 'neu')
    const frische = offene.filter((r) => !bekannteAnfragen.current.has(r.id) && (r.createdAt || 0) > seit.current)
    offene.forEach((r) => bekannteAnfragen.current.add(r.id))
    if (frische.length > 0) {
      const r = frische[frische.length - 1]
      setToast({ art: 'anfrage', titel: 'Neue Anfrage', name: r.name, text: r.anliegen || '', ziel: `/anfragen?id=${r.id}` })
      piepton()
    }
  }, [requests])

  useEffect(() => {
    const eingereicht = berichte.filter((b) => b.status === 'eingereicht')
    const frische = eingereicht.filter((b) => !bekannteBerichte.current.has(b.id) && (b.eingereichtAm || 0) > seit.current)
    eingereicht.forEach((b) => bekannteBerichte.current.add(b.id))
    if (frische.length > 0) {
      const b = frische[frische.length - 1]
      const typ = b.typ === 'regie' ? 'Regiebericht' : b.typ === 'abnahme' ? 'Abnahme' : 'Reklamation'
      setToast({ art: 'bericht', titel: `Neuer ${typ}`, name: b.mitarbeiterName || '', text: b.beschreibung || '', ziel: '/berichte' })
      piepton()
    }
  }, [berichte])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 10000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null
  return (
    <button
      onClick={() => { navigate(toast.ziel); setToast(null) }}
      className="fixed top-4 right-4 z-[70] w-80 max-w-[calc(100vw-2rem)] text-left bg-white border-2 border-amber-400 rounded-2xl shadow-2xl p-4 toast-rein"
    >
      <p className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wide">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" /> {toast.titel}
      </p>
      <p className="mt-1.5 font-bold text-slate-900">{toast.name}</p>
      <p className="text-sm text-slate-500 truncate">{toast.text}</p>
      <span
        onClick={(e) => { e.stopPropagation(); setToast(null) }}
        className="absolute top-2.5 right-3 text-slate-300 hover:text-slate-600 text-lg leading-none cursor-pointer"
      >
        ×
      </span>
    </button>
  )
}

function Badge({ wert, farbe = 'bg-amber-400 text-praxis-900' }) {
  if (!wert) return null
  return (
    <span className={`ml-auto ${farbe} text-xs font-bold rounded-full px-2 py-0.5`}>{wert}</span>
  )
}

function Layout({ user, children }) {
  const requests = useCollection('requests')
  const berichte = useCollection('berichte')
  const neueAnfragen = requests.filter((r) => r.status === 'neu').length
  const neueBerichte = berichte.filter((b) => b.status === 'eingereicht').length
  const modus = storeModus()

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <LiveToast />
      {/* Seitenleiste (Desktop) */}
      <aside className="hidden lg:flex flex-col w-60 bg-praxis-900 text-white shrink-0">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
          <ZahnLogo className="w-7 h-7 text-praxis-200" />
          <div className="leading-tight">
            <p className="font-bold text-sm">Gabara Verwaltung</p>
            <p className="text-[11px] text-praxis-200/70">Baustellen & Abrechnung</p>
          </div>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exakt}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? 'bg-praxis-600 text-white' : 'text-praxis-100/80 hover:bg-white/10'
                }`
              }
            >
              <Icon name={n.icon} className="w-5 h-5" />
              {n.label}
              {n.to === '/anfragen' && <Badge wert={neueAnfragen} />}
              {n.to === '/berichte' && <Badge wert={neueBerichte} farbe="bg-sky-400 text-praxis-900" />}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs space-y-2.5">
          <p className="text-praxis-100/80 truncate">{user.name}</p>
          <p className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
            modus === 'firebase' ? 'bg-praxis-600/60' : 'bg-amber-400/20 text-amber-200'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {modus === 'firebase' ? 'Online (Firebase)' : 'Lokaler Demo-Modus'}
          </p>
          <button onClick={abmelden} className="flex items-center gap-2 text-praxis-200/70 hover:text-white">
            <Icon name="logout" className="w-4 h-4" /> Abmelden
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Kopfzeile (Mobil) */}
        <header className="lg:hidden bg-praxis-900 text-white h-14 flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <ZahnLogo className="w-6 h-6 text-praxis-200" />
            <span className="font-bold text-sm">Gabara Verwaltung</span>
          </div>
          <button onClick={abmelden} className="text-praxis-200"><Icon name="logout" className="w-5 h-5" /></button>
        </header>

        <main className="flex-1 min-w-0 pb-20 lg:pb-0">{children}</main>

        {/* Untere Navigation (Mobil/Tablet) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-40">
          {NAV.slice(0, 5).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exakt}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium relative ${
                  isActive ? 'text-praxis-700' : 'text-slate-400'
                }`
              }
            >
              <Icon name={n.icon} className="w-5 h-5" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = lädt noch
  const location = useLocation()

  useEffect(() => beobachteAnmeldung((u) => setUser(u)), [])

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-praxis-900 flex items-center justify-center text-praxis-200">
        <ZahnLogo className="w-12 h-12 animate-pulse" />
      </div>
    )
  }

  if (!user) return <Login />

  // Monteure bekommen IMMER die Handy-Ansicht (Vollbild, große Buttons);
  // Admins erreichen sie als Vorschau über /monteur.
  if (user.rolle === 'mitarbeiter') return <MonteurApp user={user} />
  if (location.pathname.startsWith('/monteur')) return <MonteurApp user={user} vorschau />

  return (
    <Layout user={user}>
      <Routes>
        <Route path="/" element={<Kalender user={user} />} />
        <Route path="/kalender" element={<Navigate to="/" replace />} />
        <Route path="/uebersicht" element={<Uebersicht user={user} />} />
        <Route path="/projekte" element={<Projekte />} />
        <Route path="/projekte/:id" element={<ProjektDetail user={user} />} />
        <Route path="/termine" element={<Termine user={user} />} />
        <Route path="/kunden" element={<Kunden />} />
        <Route path="/berichte" element={<Berichte user={user} />} />
        <Route path="/anfragen" element={<Anfragen user={user} />} />
        <Route path="/abrechnung" element={<Abrechnung />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/import" element={<Import />} />
        <Route path="/einstellungen" element={<Einstellungen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
