import { useEffect, useRef, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { beobachteAnmeldung, abmelden } from '@shared/auth.js'
import * as S from './stil.js'
import { useLang, t } from '@shared/i18n.js'
import { storeModus } from '@shared/store.js'
import { ZahnLogo, Icon, SprachSchalter, ThemaSchalter } from '@shared/ui.jsx'
import Login from './pages/Login.jsx'
import Fehlerschutz from './components/Fehlerschutz.jsx'
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
import Stunden from './pages/Stunden.jsx'
import Hilfe from './pages/Hilfe.jsx'
import Abrechnung from './pages/Abrechnung.jsx'
import MonteurApp from './pages/monteur/MonteurApp.jsx'
import { useCollection } from './hooks.js'

// Reihenfolge = Sichtbarkeit: Kalender ist die Startseite der Verwaltung.
const NAV = [
  { to: '/', schluessel: 'nav.kalender', icon: 'calendar', exakt: true },
  { to: '/projekte', schluessel: 'nav.projekte', icon: 'folder' },
  { to: '/termine', schluessel: 'nav.termine', icon: 'list' },
  { to: '/berichte', schluessel: 'nav.berichte', icon: 'bericht' },
  { to: '/kunden', schluessel: 'nav.kunden', icon: 'firma' },
  { to: '/abrechnung', schluessel: 'nav.abrechnung', icon: 'euro' },
  { to: '/uebersicht', schluessel: 'nav.uebersicht', icon: 'home' },
  { to: '/anfragen', schluessel: 'nav.anfragen', icon: 'inbox' },
  { to: '/dashboard', schluessel: 'nav.dashboard', icon: 'diagramm' },
  { to: '/stunden', schluessel: 'nav.stunden', icon: 'clock' },
  { to: '/import', schluessel: 'nav.import', icon: 'upload' },
  { to: '/einstellungen', schluessel: 'nav.einstellungen', icon: 'zahnrad' },
  { to: '/hilfe', schluessel: 'nav.hilfe', icon: 'info' },
  { to: '/monteur', schluessel: 'nav.monteur', icon: 'tablet' },
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
      className="fixed top-4 right-4 z-[70] w-80 max-w-[calc(100vw-2rem)] text-left bg-karte border border-praxis-300 rounded-karte shadow-hoch p-4 toast-rein"
    >
      <p className="flex items-center gap-2 text-xs font-bold text-praxis-600 uppercase tracking-wider">
        <Icon name={toast.art === 'bericht' ? 'bericht' : 'inbox'} groesse="xs" /> {toast.titel}
      </p>
      <p className="mt-1.5 font-bold text-schrift-stark">{toast.name}</p>
      <p className="text-sm text-schrift-leise truncate">{toast.text}</p>
      <span
        onClick={(e) => { e.stopPropagation(); setToast(null) }}
        className="absolute top-3 right-3 text-schrift-zart hover:text-schrift-stark cursor-pointer"
      >
        <Icon name="x" groesse="xs" />
      </span>
    </button>
  )
}

function Badge({ wert }) {
  if (!wert) return null
  return <span className={`ml-auto ${S.ZAEHLER}`}>{wert}</span>
}

function Layout({ user, children }) {
  useLang() // Sprachwechsel baut den Rahmen neu auf
  const requests = useCollection('requests')
  const berichte = useCollection('berichte')
  const neueAnfragen = requests.filter((r) => r.status === 'neu').length
  const neueBerichte = berichte.filter((b) => b.status === 'eingereicht').length
  const modus = storeModus()

  return (
    <div className="min-h-screen bg-flaeche flex">
      <LiveToast />
      {/* Seitenleiste (Desktop).
          sticky + h-screen: die Leiste bleibt stehen, während lange Seiten
          (Wissensdatenbank, Stundenlisten, Projektlisten) darunter wegscrollen.
          Ohne das wandert die Navigation mit nach oben aus dem Bild und man
          muss zum Seitenwechsel erst wieder ganz nach oben scrollen. */}
      <aside className="hidden lg:flex flex-col w-60 bg-praxis-900 text-white shrink-0 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
          <ZahnLogo className="w-7 h-7 text-praxis-200" />
          <div className="leading-tight">
            <p className="font-bold text-sm">{t('nav.titel')}</p>
            <p className="text-[12px] text-praxis-200/70">{t('nav.untertitel')}</p>
          </div>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exakt}
              className={({ isActive }) => `${S.NAV_LINK} ${isActive ? S.NAV_AN : S.NAV_AUS}`}
            >
              <Icon name={n.icon} groesse="m" />
              {t(n.schluessel)}
              {n.to === '/anfragen' && <Badge wert={neueAnfragen} />}
              {n.to === '/berichte' && <Badge wert={neueBerichte} />}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs space-y-2.5">
          <SprachSchalter dunkel />
          <ThemaSchalter dunkel />
          <p className="flex items-center gap-2 text-praxis-100/80 truncate">
            <Icon name="person" groesse="xs" className="w-3.5 h-3.5 shrink-0" />
            {user.name}
          </p>
          <p className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
            modus === 'firebase' ? 'bg-praxis-600/60 text-white' : 'bg-amber-400/20 text-amber-200'
          }`}>
            <Icon name={modus === 'firebase' ? 'erfolg' : 'info'} groesse="xs" className="w-3 h-3" />
            {t(modus === 'firebase' ? 'nav.online' : 'nav.lokal')}
          </p>
          <button onClick={abmelden} className="flex items-center gap-2 text-praxis-200/70 hover:text-white transition">
            <Icon name="logout" groesse="xs" className="w-4 h-4" /> {t('allg.abmelden')}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Kopfzeile (Mobil) */}
        <header className="lg:hidden bg-praxis-900 text-white h-14 flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <ZahnLogo className="w-6 h-6 text-praxis-200" />
            <span className="font-bold text-sm">{t('nav.titel')}</span>
          </div>
          <div className="flex items-center gap-2">
            <SprachSchalter dunkel />
          <ThemaSchalter dunkel />
            <button onClick={abmelden} className="text-praxis-200 p-1"><Icon name="logout" groesse="s" /></button>
          </div>
        </header>

        <main className="flex-1 min-w-0 pb-20 lg:pb-0">{children}</main>

        {/* Untere Navigation (Mobil/Tablet) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-karte border-t border-rahmen flex z-40">
          {NAV.slice(0, 5).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exakt}
              className={({ isActive }) => `${S.NAV_MOB} ${isActive ? S.NAV_MOB_AN : S.NAV_MOB_AUS}`}
            >
              <Icon name={n.icon} groesse="m" />
              {t(n.schluessel)}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

// Ladebild mit Notausgang. Nach sechs Sekunden ist klar, dass etwas klemmt –
// dann bekommt der Nutzer eine Erklaerung und einen Knopf statt eines
// pulsierenden Logos, das sich nie aendert.
function Ladebild() {
  useLang()
  const [lange, setLange] = useState(false)
  useEffect(() => {
    const uhr = setTimeout(() => setLange(true), 6000)
    return () => clearTimeout(uhr)
  }, [])
  return (
    <div className="min-h-screen bg-praxis-900 flex flex-col items-center justify-center text-praxis-200 px-6 text-center">
      <ZahnLogo className="w-12 h-12 animate-pulse" />
      {lange && (
        <>
          <p className="mt-6 text-sm max-w-sm text-praxis-200/80">{t('start.laedtLang')}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2.5 rounded-feld bg-white/10 hover:bg-white/20 text-sm font-bold"
          >
            {t('start.neuLaden')}
          </button>
        </>
      )}
    </div>
  )
}

function StartFehler({ user }) {
  useLang()
  return (
    <div className="min-h-screen bg-flaeche flex items-center justify-center px-6">
      <div className="bg-karte border border-amber-200 rounded-karte p-8 max-w-lg">
        <h1 className="text-lg font-bold text-schrift-stark mb-2">{t('nav.titel')}</h1>
        <p className="text-sm text-schrift-leise">
          {t(user.fehler === 'start' ? 'start.startFehler' : 'start.profilFehler')}
        </p>
        {user.meldung && (
          <pre className="mt-3 text-[11px] text-schrift-zart whitespace-pre-wrap break-words" dir="ltr">{user.meldung}</pre>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-feld bg-praxis-600 text-white text-sm font-bold hover:bg-praxis-700"
          >
            {t('start.neuLaden')}
          </button>
          <button
            onClick={() => abmelden().then(() => window.location.reload())}
            className="px-4 py-2.5 rounded-feld bg-karte border border-rahmen text-sm font-medium"
          >
            {t('start.abmelden')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = lädt noch
  const location = useLocation()

  useEffect(() => beobachteAnmeldung((u) => setUser(u)), [])

  if (user === undefined) return <Ladebild />

  // Angemeldet, aber die Rolle ist unbekannt (Datenbank nicht erreichbar).
  // Weiterzumachen waere geraten: mit falscher Rolle landet das Buero in der
  // Monteur-Ansicht. Lieber sagen was los ist und einen Weg heraus anbieten.
  // Fragezeichen ist Pflicht: abgemeldet ist user === null.
  if (user?.fehler) return <StartFehler user={user} />

  if (!user) return <Login />

  // Monteure bekommen IMMER die Handy-Ansicht (Vollbild, große Buttons);
  // Admins erreichen sie als Vorschau über /monteur.
  // Auch die Handy-Ansicht abgesichert: draußen auf der Baustelle ist ein
  // weißer Bildschirm ohne jeden Hinweis am schlimmsten.
  if (user.rolle === 'mitarbeiter') {
    return <Fehlerschutz schluessel={location.pathname}><MonteurApp user={user} /></Fehlerschutz>
  }
  if (location.pathname.startsWith('/monteur')) {
    return <Fehlerschutz schluessel={location.pathname}><MonteurApp user={user} vorschau /></Fehlerschutz>
  }

  return (
    <Layout user={user}>
      {/* schluessel = aktueller Pfad: beim Wechsel der Ansicht verschwindet
          eine stehende Fehlermeldung wieder von selbst. */}
      <Fehlerschutz schluessel={location.pathname}>
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
        <Route path="/stunden" element={<Stunden />} />
        <Route path="/hilfe" element={<Hilfe />} />
        <Route path="/import" element={<Import />} />
        <Route path="/einstellungen" element={<Einstellungen user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Fehlerschutz>
    </Layout>
  )
}
