import { useEffect, useRef, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { beobachteAnmeldung, abmelden } from '@shared/auth.js'
import { storeModus } from '@shared/store.js'
import { ZahnLogo, Icon, SprachSchalter } from '@shared/ui.jsx'
import { useLang, tr, setLang } from '@shared/i18n.js'
import { useEinstellungen } from './hooks.js'
import Login from './pages/Login.jsx'
import Kalender from './pages/Kalender.jsx'
import Anfragen from './pages/Anfragen.jsx'
import Patienten from './pages/Patienten.jsx'
import Import from './pages/Import.jsx'
import Cockpit from './pages/Cockpit.jsx'
import Einstellungen from './pages/Einstellungen.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Abrechnung from './pages/Abrechnung.jsx'
import FeedbackAdmin from './pages/FeedbackAdmin.jsx'
import { useCollection } from './hooks.js'

const NAV = [
  { to: '/kalender', label: { de: 'Kalender', en: 'Calendar', ar: 'التقويم' }, icon: 'calendar' },
  { to: '/anfragen', label: { de: 'Anfragen', en: 'Requests', ar: 'الطلبات' }, icon: 'inbox' },
  { to: '/patienten', label: { de: 'Patienten', en: 'Patients', ar: 'المرضى' }, icon: 'users' },
  { to: '/dashboard', label: { de: 'Dashboard', en: 'Dashboard', ar: 'لوحة الطبيب' }, icon: 'chat' },
  { to: '/cockpit', label: { de: 'Arzt-Cockpit', en: 'Doctor cockpit', ar: 'شاشة الطبيب' }, icon: 'tablet' },
  { to: '/abrechnung', label: { de: 'Abrechnung', en: 'Billing', ar: 'الفوترة' }, icon: 'shield' },
  { to: '/feedback', label: { de: 'Feedback', en: 'Feedback', ar: 'الملاحظات' }, icon: 'smile' },
  { to: '/import', label: { de: 'Import', en: 'Import', ar: 'استيراد' }, icon: 'upload' },
  { to: '/einstellungen', label: { de: 'Einstellungen', en: 'Settings', ar: 'الإعدادات' }, icon: 'bell' },
]

const TA = {
  verwaltung: { de: 'Gabara Verwaltung', en: 'Gabara Verwaltung', ar: 'Gabara Verwaltung' },
  online: { de: 'Online (Firebase)', en: 'Online (Firebase)', ar: 'متصل (Firebase)' },
  lokal: { de: 'Lokaler Demo-Modus', en: 'Local demo mode', ar: 'وضع تجريبي محلي' },
  abmelden: { de: 'Abmelden', en: 'Sign out', ar: 'تسجيل الخروج' },
  neueAnfrage: { de: 'Neue Terminanfrage', en: 'New appointment request', ar: 'طلب موعد جديد' },
  uhr: { de: 'Uhr', en: '', ar: '' },
}

// Dezenter Doppel-Piepton für neue Anfragen (WebAudio, kein Audio-Asset nötig)
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

// Toast oben rechts: erscheint live, sobald eine neue Online-Anfrage eingeht
function AnfragenToast() {
  const requests = useCollection('requests')
  const navigate = useNavigate()
  const bekannt = useRef(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const offene = requests.filter((r) => r.status === 'neu')
    if (bekannt.current === null) {
      // Erste Ladung nicht melden – nur wirklich NEUE Anfragen
      if (requests.length > 0 || bekannt.current === null) bekannt.current = new Set(offene.map((r) => r.id))
      return
    }
    const frische = offene.filter((r) => !bekannt.current.has(r.id))
    offene.forEach((r) => bekannt.current.add(r.id))
    if (frische.length > 0) {
      setToast(frische[frische.length - 1])
      piepton()
    }
  }, [requests])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 10000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null
  return (
    <button
      onClick={() => { navigate(`/anfragen?id=${toast.id}`); setToast(null) }}
      className="fixed top-4 right-4 rtl:right-auto rtl:left-4 z-[70] w-80 max-w-[calc(100vw-2rem)] text-left rtl:text-right bg-white border-2 border-amber-400 rounded-2xl shadow-2xl p-4 toast-rein"
    >
      <p className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wide">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" /> {tr(TA.neueAnfrage)}
      </p>
      <p className="mt-1.5 font-bold text-slate-900">{toast.name}</p>
      <p className="text-sm text-slate-500">
        {toast.anliegen} · {new Date(toast.datum + 'T12:00:00').toLocaleDateString('de-DE')} · {toast.start} {tr(TA.uhr)}
      </p>
      <span
        onClick={(e) => { e.stopPropagation(); setToast(null) }}
        className="absolute top-2.5 right-3 rtl:right-auto rtl:left-3 text-slate-300 hover:text-slate-600 text-lg leading-none cursor-pointer"
      >
        ×
      </span>
    </button>
  )
}

function Layout({ user, children }) {
  useLang()
  const requests = useCollection('requests')
  const feedback = useCollection('feedback')
  const neueAnfragen = requests.filter((r) => r.status === 'neu').length
  const feedbackAlarme = feedback.filter((f) => f.status === 'neu' && f.sterne <= 2).length
  const modus = storeModus()

  // Standardsprache aus den globalen Einstellungen – nur wenn der Nutzer
  // noch keine eigene Sprachwahl getroffen hat
  const einst = useEinstellungen()
  useEffect(() => {
    try {
      if (!localStorage.getItem('praxis-sprache') && einst.standardSprache) setLang(einst.standardSprache)
    } catch (e) { /* localStorage gesperrt */ }
  }, [einst.standardSprache])

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <AnfragenToast />
      {/* Seitenleiste (Desktop) */}
      <aside className="hidden lg:flex flex-col w-60 bg-praxis-900 text-white shrink-0">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
          <ZahnLogo className="w-7 h-7 text-praxis-200" />
          <div className="leading-tight">
            <p className="font-bold text-sm">{tr(TA.verwaltung)}</p>
            <p className="text-[11px] text-praxis-200/70">Baustellen & Abrechnung</p>
          </div>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? 'bg-praxis-600 text-white' : 'text-praxis-100/80 hover:bg-white/10'
                }`
              }
            >
              <Icon name={n.icon} className="w-5 h-5" />
              {tr(n.label)}
              {n.to === '/anfragen' && neueAnfragen > 0 && (
                <span className="ml-auto rtl:ml-0 rtl:mr-auto bg-amber-400 text-praxis-900 text-xs font-bold rounded-full px-2 py-0.5">
                  {neueAnfragen}
                </span>
              )}
              {n.to === '/feedback' && feedbackAlarme > 0 && (
                <span className="ml-auto rtl:ml-0 rtl:mr-auto bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 animate-pulse">
                  {feedbackAlarme}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs space-y-2.5">
          <p className="text-praxis-100/80 truncate">{user.name}</p>
          <p className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
            modus === 'firebase' ? 'bg-praxis-600/60' : 'bg-amber-400/20 text-amber-200'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {modus === 'firebase' ? tr(TA.online) : tr(TA.lokal)}
          </p>
          <SprachSchalter dunkel />
          <button onClick={abmelden} className="flex items-center gap-2 text-praxis-200/70 hover:text-white">
            <Icon name="logout" className="w-4 h-4" /> {tr(TA.abmelden)}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Kopfzeile (Mobil) */}
        <header className="lg:hidden bg-praxis-900 text-white h-14 flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <ZahnLogo className="w-6 h-6 text-praxis-200" />
            <span className="font-bold text-sm">{tr(TA.verwaltung)}</span>
          </div>
          <div className="flex items-center gap-2">
            <SprachSchalter dunkel />
            <button onClick={abmelden} className="text-praxis-200"><Icon name="logout" className="w-5 h-5" /></button>
          </div>
        </header>

        <main className="flex-1 min-w-0 pb-20 lg:pb-0">{children}</main>

        {/* Untere Navigation (Mobil/Tablet) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-40">
          {NAV.slice(0, 5).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium relative ${
                  isActive ? 'text-praxis-700' : 'text-slate-400'
                }`
              }
            >
              <Icon name={n.icon} className="w-5 h-5" />
              {tr(n.label)}
              {n.to === '/anfragen' && neueAnfragen > 0 && (
                <span className="absolute top-1 right-1/2 translate-x-4 bg-amber-400 text-praxis-900 text-[9px] font-bold rounded-full px-1.5">
                  {neueAnfragen}
                </span>
              )}
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

  // Das Cockpit läuft im Vollbild ohne Verwaltung drumherum (Tablet-Ansicht)
  if (location.pathname.startsWith('/cockpit')) {
    return (
      <Routes>
        <Route path="/cockpit" element={<Cockpit user={user} />} />
        <Route path="*" element={<Navigate to="/cockpit" replace />} />
      </Routes>
    )
  }

  return (
    <Layout user={user}>
      <Routes>
        <Route path="/" element={<Navigate to="/kalender" replace />} />
        <Route path="/kalender" element={<Kalender user={user} />} />
        <Route path="/anfragen" element={<Anfragen user={user} />} />
        <Route path="/patienten" element={<Patienten user={user} />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/abrechnung" element={<Abrechnung />} />
        <Route path="/feedback" element={<FeedbackAdmin />} />
        <Route path="/import" element={<Import />} />
        <Route path="/einstellungen" element={<Einstellungen />} />
        <Route path="*" element={<Navigate to="/kalender" replace />} />
      </Routes>
    </Layout>
  )
}
