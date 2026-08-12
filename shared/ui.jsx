import { useThema, aktivesThema, naechstesThema } from './thema.js'
// Gemeinsame UI-Bausteine: Logo, Icon-Set (inline SVG) + Sprachumschalter

import { SPRACHEN, setLang, useLang, t } from './i18n.js'

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
  shield: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zm0 5v8m-3-5h6',
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
  // Maler-/Baustellen-Icons (Gabara)
  roller: 'M3 4.5h12v6H3v-6zm12 2h5v4.5h-8.5V15m-1.5 0h3v5.5h-3V15z',
  brush: 'M14 3l7 7-6.5 6.5c-1 1-2.5 1-3.5 0l-3.5-3.5c-1-1-1-2.5 0-3.5L14 3zM7 17l-4 4',
  folder: 'M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6z',
  doc: 'M6 3h8l4 4v14H6V3zm8 0v4h4M9 12h6m-6 4h6',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  // Euro. Der Bogen braucht large-arc=1 – mit 0 entsteht nur die MINDERE Sichel:
  // sie reichte von x=13,1 bis 17,5, während die Balken bei x=13,0 endeten. Die
  // beiden Teile berührten sich also nicht einmal, das Zeichen war zwei Striche
  // neben einem Halbmond. Jetzt kreuzen die Balken den Bogen nachweislich bei
  // x≈7,1 und laufen nach rechts aus, der untere kürzer als der obere.
  euro: 'M17.4 7.1A6.4 6.4 0 1 0 17.4 16.9M5.2 10.2h9M5.2 13.8h7.2',
  truck: 'M2 7h12v9H2V7zm12 3h4.5L21 13v3h-7v-6zM6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm10.5 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z',
  foto: 'M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zm8 9a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  signatur: 'M3 20h18M5 16c2.5-5 4.5-7 5.5-6s-2.5 6-.5 6.5 4-3.5 5.5-3.5.5 3.5 2.5 3.5H21',
  bericht: 'M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm2 5h6m-6 4h6m-6 4h4',
  info: 'M12 3a9 9 0 110 18 9 9 0 010-18zm0 8v5m0-8.6v.6',
  erfolg: 'M12 3a9 9 0 110 18 9 9 0 010-18zm-3.6 9.2l2.6 2.6 4.6-4.8',
  // Bau / Gewerk
  baustelle: 'M3.5 17.5h17M5.5 17.5v-1.5a6.5 6.5 0 0113 0v1.5M10 10.6V5.5a1 1 0 011-1h2a1 1 0 011 1v5.1',
  // Raum: Grundriss von oben – Aussenwaende, eine Innenwand mit Tueroeffnung.
  // Vorher stand hier 'baustelle' (ein Bauhelm); der steht fuer die Baustelle
  // als Ganzes, nicht fuer einen Raum darin.
  raum: 'M3.5 4.5h17v15h-17v-15zm10 0v6m0 4v5M3.5 12h4',
  material: 'M5 8h14l-1.2 11.2a2 2 0 01-2 1.8H8.2a2 2 0 01-2-1.8L5 8zM8 8V6a4 4 0 018 0v2M9.5 12h5',
  // Personen
  firma: 'M4 21V4.8a.8.8 0 01.8-.8h9.4a.8.8 0 01.8.8V21M15 10h4.2a.8.8 0 01.8.8V21M3 21h18M8 8h3M8 12h3M8 16h3',
  person: 'M12 12a4 4 0 110-8 4 4 0 010 8zm-7 8.5c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5',
  team: 'M12 11.5a3 3 0 110-6 3 3 0 010 6zm-4.6 8c0-2.5 2.1-4.5 4.6-4.5s4.6 2 4.6 4.5M7 11.2a2.5 2.5 0 010-5M17 6.2a2.5 2.5 0 010 5M2.4 18.5c0-2.2 1.4-4 3.4-4.6M21.6 18.5c0-2.2-1.4-4-3.4-4.6',
  // Belege / Vorgaenge
  regie: 'M13 3H6a1 1 0 00-1 1v16a1 1 0 001 1h4M13 3l5 5M13 3v5h5M8.5 9.5h3M8.5 13h4M17 14a4 4 0 110 8 4 4 0 010-8zm0 1.9v2.2l1.7 1',
  reklamation: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-5 4V6zm8 1.5v4.2m0 1.9v.4',
  abnahme: 'M9 4H7a1 1 0 00-1 1v15a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1h-2M9.8 2.5h4.4a.8.8 0 01.8.8v1.9H9V3.3a.8.8 0 01.8-.8zM8.6 13.2l2.4 2.4 4.4-4.6',
  rechnung: 'M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21V3zm3 5h6M9 11.5h6M9 15h3.5',
  beauftragt: 'M13 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V8l-5-5zm0 0v5h5M9 14.5l2 2 4-4.5',
  lv: 'M4 5.5h2.5M4 12h2.5M4 18.5h2.5M9.5 5.5H21M9.5 12H21M9.5 18.5h7.5',
  // Zeit / Geld
  stunden: 'M12 21a8 8 0 110-16 8 8 0 010 16zm0-11.5V13l2.6 1.6M9.5 2h5M19 5.5l1.6-1.6',
  spesen: 'M3 6.5h18a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1zm9 3a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM6 12h.01M18 12h.01',
  // Werkzeuge der Oberflaeche
  zahnrad: 'M12 9a3 3 0 110 6 3 3 0 010-6zM12 3v3m0 12v3m9-9h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6',
  diagramm: 'M4 4v16h16M8 17v-4.5M12.5 17V8.5M17 17v-7',
  suche: 'M11 4a7 7 0 110 14 7 7 0 010-14zm4.9 11.9l4.6 4.6',
  filter: 'M3.5 5h17l-6.6 7.6v5.9l-3.8 2.4v-8.3L3.5 5z',
  stift: 'M4.5 19.5h4L19.6 8.4a2.05 2.05 0 10-2.9-2.9L5.5 16.6l-1 2.9zM15.6 6.6l2.9 2.9',
  muell: 'M4 6.5h16M9.5 6.5V4.8a1 1 0 011-1h3a1 1 0 011 1v1.7M6.6 6.5l.9 13.1a1.4 1.4 0 001.4 1.3h6.2a1.4 1.4 0 001.4-1.3l.9-13.1M10 10.5v6.6M14 10.5v6.6',
  kopieren: 'M9 9.5a1.5 1.5 0 011.5-1.5h8A1.5 1.5 0 0120 9.5v9a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 019 18.5v-9zM15 8V5.5A1.5 1.5 0 0013.5 4h-8A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8',
  schloss: 'M8 10.5V7.5a4 4 0 018 0v3M6 10.5h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1zm6 3.5v2.5',
  pdf: 'M13 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V8l-5-5zm0 0v5h5M12 11.5v6m0 0l-2.5-2.5M12 17.5l2.5-2.5',
  drucken: 'M7 9V3.5h10V9M7 18H5a1 1 0 01-1-1v-5a1 1 0 011-1h14a1 1 0 011 1v5a1 1 0 01-1 1h-2M7 14.5h10V21H7v-6.5zM16.3 12.5h.01',
  speichern: 'M5 4h11l3 3v13H5V4zm3 0v5h7V4M8 20v-6h8v6',
  kreis: 'M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z',
  chevronUnten: 'M6 9.5l6 6 6-6',
  chevronOben: 'M6 14.5l6-6 6 6',
  chevronRechts: 'M9.5 6l6 6-6 6',
  mehr: 'M6 12h.01M12 12h.01M18 12h.01',
}

// Groessen-Stufen: kleine Icons brauchen mehr Strich, sonst wirken sie blass.
// Der alte Aufruf <Icon name="x" className="w-4 h-4" /> funktioniert unveraendert.
const STRICH = { xs: 2.1, s: 2.0, m: 1.8, l: 1.7, xl: 1.6 }
const MASS = { xs: 'w-3.5 h-3.5', s: 'w-4 h-4', m: 'w-5 h-5', l: 'w-6 h-6', xl: 'w-7 h-7' }

export function Icon({ name, groesse = 'm', className, strokeWidth }) {
  const d = PFADE[name] || PFADE.info
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className || MASS[groesse]} aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth={strokeWidth ?? STRICH[groesse]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Hell / Dunkel / System - reihum mit einem Knopf.
// Drei Zustaende an EINEM Knopf statt drei Knoepfen: der Platz neben dem
// Sprachumschalter ist knapp, und die Reihenfolge ist selbsterklaerend, weil
// das Symbol immer zeigt, was gerade gilt.
export function ThemaSchalter({ dunkel = false }) {
  const wahl = useThema()
  const aktiv = aktivesThema()
  const titel = t(`thema.${wahl}`)
  return (
    <button
      type="button"
      onClick={naechstesThema}
      title={titel}
      aria-label={titel}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
        dunkel ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-schrift-leise hover:text-schrift-stark hover:bg-gedeckt-tief'
      }`}
    >
      {wahl === 'system' ? (
        // Halb gefuellter Kreis = folgt dem Geraet
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
        </svg>
      ) : aktiv === 'dunkel' ? (
        // Mond
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
        </svg>
      ) : (
        // Sonne
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
        </svg>
      )}
    </button>
  )
}
