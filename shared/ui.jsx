// Gemeinsame UI-Bausteine: Logo, Icon-Set (inline SVG) + Sprachumschalter

import { SPRACHEN, setLang, useLang } from './i18n.js'

const SPRACHE_META = {
  de: { name: 'Deutsch' },
  en: { name: 'English' },
  ar: { name: 'العربية' },
}

// Mini-Flaggen als SVG – Emoji-Flaggen werden unter Windows nur als
// Buchstabenkürzel dargestellt, SVG sieht auf jedem Gerät gleich aus
const STERN = '0,-3 0.9,-0.9 3,-0.9 1.3,0.4 1.8,2.4 0,1.1 -1.8,2.4 -1.3,0.4 -3,-0.9 -0.9,-0.9'
function Flagge({ code }) {
  return (
    <span className="inline-flex rounded-[3px] overflow-hidden ring-1 ring-black/10 shrink-0">
      <svg viewBox="0 0 60 36" width="26" height="16" className="block" aria-hidden="true">
        {code === 'de' && (
          <>
            <rect width="60" height="12" fill="#000" />
            <rect y="12" width="60" height="12" fill="#DD0000" />
            <rect y="24" width="60" height="12" fill="#FFCE00" />
          </>
        )}
        {code === 'en' && (
          <>
            <rect width="60" height="36" fill="#012169" />
            <path d="M0,0 60,36 M60,0 0,36" stroke="#fff" strokeWidth="7" />
            <path d="M0,0 60,36 M60,0 0,36" stroke="#C8102E" strokeWidth="3" />
            <rect x="25" width="10" height="36" fill="#fff" />
            <rect y="13" width="60" height="10" fill="#fff" />
            <rect x="27" width="6" height="36" fill="#C8102E" />
            <rect y="15" width="60" height="6" fill="#C8102E" />
          </>
        )}
        {code === 'ar' && (
          <>
            {/* Neue syrische Flagge (2024): grün-weiß-schwarz mit 3 roten Sternen */}
            <rect width="60" height="12" fill="#007A3D" />
            <rect y="12" width="60" height="12" fill="#fff" />
            <rect y="24" width="60" height="12" fill="#000" />
            <polygon points={STERN} fill="#CE1126" transform="translate(15,18)" />
            <polygon points={STERN} fill="#CE1126" transform="translate(30,18)" />
            <polygon points={STERN} fill="#CE1126" transform="translate(45,18)" />
          </>
        )}
      </svg>
    </span>
  )
}

// Sprachumschalter: immer sichtbarer Segment-Schalter (Flagge + Kürzel),
// ein Klick genügt – die aktive Sprache ist als gefüllte Pille hervorgehoben
export function SprachSchalter({ dunkel = false }) {
  const lang = useLang()

  return (
    <div
      role="group"
      aria-label="Sprache / Language"
      className={`flex items-center gap-0.5 rounded-full p-1 border ${
        dunkel ? 'bg-white/10 border-white/15' : 'bg-slate-100 border-slate-200'
      }`}
    >
      {SPRACHEN.map((s) => {
        const m = SPRACHE_META[s.code]
        const istAktiv = lang === s.code
        return (
          <button
            key={s.code}
            type="button"
            onClick={() => setLang(s.code)}
            aria-pressed={istAktiv}
            title={m.name}
            className={`flex items-center gap-1.5 rounded-full px-2 sm:px-3 py-1.5 text-xs font-bold transition ${
              istAktiv
                ? dunkel
                  ? 'bg-white text-praxis-800 shadow-sm'
                  : 'bg-praxis-600 text-white shadow-sm'
                : dunkel
                  ? 'text-white/75 hover:text-white'
                  : 'text-slate-500 hover:text-praxis-700'
            }`}
          >
            <Flagge code={s.code} />
            <span className={istAktiv ? '' : 'hidden sm:inline'}>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Gabara-Logo: Farbrolle (Vorlagen-Regel: Export-Name ZahnLogo bleibt, nur die Grafik ist neu)
export function ZahnLogo({ className = 'w-9 h-9' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="5" y="7" width="27" height="12" rx="4" fill="currentColor" opacity="0.15" />
      <rect x="5" y="7" width="27" height="12" rx="4" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M32 13h8v9H26v4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="23" y="26" width="6" height="15" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="23" y="26" width="6" height="15" rx="2" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M9 24c0 2-1.8 2.6-1.8 4.2a1.8 1.8 0 003.6 0C10.8 26.6 9 26 9 24z" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

const PFADE = {
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zm7 11l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6L15.5 18l2.6-.9L19 14zM5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z',
  shield: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zm0 5v8m-3-5h6',
  tooth: 'M12 4c-2 0-3-1-5-1-2.8 0-4.5 2.2-4.5 5 0 2.5 1 4.2 2.2 5.7 1 1.2 1.5 3.5 1.8 5.7.2 1.8.7 3.6 2 3.6 1.8 0 1.2-4.5 2.5-7 .4-.8 1.6-.8 2 0 1.3 2.5.7 7 2.5 7 1.3 0 1.8-1.8 2-3.6.3-2.2.8-4.5 1.8-5.7C20.5 12.2 21.5 10.5 21.5 8c0-2.8-1.7-5-4.5-5-2 0-3 1-5 1z',
  root: 'M12 3c3 0 5 2 5 5 0 2-1 3-1 5s.5 8-1.5 8S13 15 12 15s-.5 6-2.5 6S8 15 8 13 7 10 7 8c0-3 2-5 5-5zm0 5v4',
  implant: 'M9 3h6M9 6.5h6M9.5 10h5m-4.5 3.5h4M12 3v18m-2.5-3.5L12 21l2.5-3.5',
  smile: 'M12 3a9 9 0 110 18 9 9 0 010-18zm-4 8c0-1 .7-2 1.5-2S11 10 11 11m2 0c0-1 .7-2 1.5-2s1.5 1 1.5 2m-9 3c1.5 2 3.5 3 6 3s4.5-1 6-3',
  child: 'M12 3a4 4 0 110 8 4 4 0 010-8zm-7 18c0-4 3-7 7-7s7 3 7 7m-9.5-9.5L7 9m7.5 2.5L17 9',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z',
  home: 'M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z',
  check: 'M5 13l4 4L19 7',
  chat: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-5 4V6z',
  alert: 'M12 3l10 18H2L12 3zm0 7v4m0 3v.5',
  phone: 'M5 4h4l1.5 4.5L8 10a12 12 0 006 6l1.5-2.5L20 15v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z',
  pin: 'M12 21s-7-6.5-7-11.5a7 7 0 1114 0C19 14.5 12 21 12 21zm0-9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  clock: 'M12 3a9 9 0 110 18 9 9 0 010-18zm0 4v5l3.5 2',
  mail: 'M4 6h16v12H4V6zm0 1l8 6 8-6',
  calendar: 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zm-1 5h16M8 3v4m8-4v4',
  users: 'M9 11a4 4 0 110-8 4 4 0 010 8zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6m1-9.5a3.5 3.5 0 100-7M22 20c0-2.8-1.8-5-4.5-5.7',
  inbox: 'M4 4h16v16H4V4zm0 11h4.5l1.5 2.5h4l1.5-2.5H20',
  upload: 'M12 16V4m0 0L7 9m5-5l5 5M4 20h16',
  tablet: 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zm5 15.5h2',
  logout: 'M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 8l-4 4 4 4m-4-4h11',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14m-7-7h14',
  bell: 'M12 4a5 5 0 015 5v3.5l1.7 3a.8.8 0 01-.7 1.2H6a.8.8 0 01-.7-1.2l1.7-3V9a5 5 0 015-5zm-2 14a2 2 0 004 0',
  arrowLeft: 'M19 12H5m0 0l6-6m-6 6l6 6',
  arrowRight: 'M5 12h14m0 0l-6-6m6 6l-6 6',
  dog: 'M8 5l2 3h4l2-3 3 2-1.5 4.5c.5 1 .5 2.5.5 3.5 0 3.5-2.5 6-6 6s-6-2.5-6-6c0-1 0-2.5.5-3.5L5 7l3-2zm2 9h.01M14 14h.01M12 16.5v1',
  // Maler-/Baustellen-Icons (Gabara)
  roller: 'M3 4.5h12v6H3v-6zm12 2h5v4.5h-8.5V15m-1.5 0h3v5.5h-3V15z',
  brush: 'M14 3l7 7-6.5 6.5c-1 1-2.5 1-3.5 0l-3.5-3.5c-1-1-1-2.5 0-3.5L14 3zM7 17l-4 4',
  folder: 'M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6z',
  doc: 'M6 3h8l4 4v14H6V3zm8 0v4h4M9 12h6m-6 4h6',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  euro: 'M17.5 5.5A7 7 0 0017.5 18.5M5 10h8m-8 4h8',
  truck: 'M2 7h12v9H2V7zm12 3h4.5L21 13v3h-7v-6zM6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm10.5 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z',
  foto: 'M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zm8 9a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  signatur: 'M3 20h18M5 16c2.5-5 4.5-7 5.5-6s-2.5 6-.5 6.5 4-3.5 5.5-3.5.5 3.5 2.5 3.5H21',
  bericht: 'M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm2 5h6m-6 4h6m-6 4h4',
}

export function Icon({ name, className = 'w-6 h-6', strokeWidth = 1.8 }) {
  const d = PFADE[name] || PFADE.check
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
