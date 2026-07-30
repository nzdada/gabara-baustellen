import { useMemo, useRef, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, tr } from '@shared/i18n.js'
import { withStore } from '../hooks.js'

// Interaktives Zahnschema (Odontogramm) nach FDI-Schema:
// Oberkiefer 18–11 | 21–28, Unterkiefer 48–41 | 31–38.
// - Kompakte Ansicht im Cockpit (Klick -> Befund-Dialog)
// - VOLLBILD-Modus mit anatomischen Zahnformen: Befunde eingeben UND direkt
//   auf den Zahn malen (Finger/Stift) – Zeichnung wird am Befund gespeichert
//   und im Schema auf dem Zahn angezeigt. Alles live auf allen Geräten.

const OBEN = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28']
const UNTEN = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']

const T = {
  titel: { de: 'Zahnschema & Befunde', en: 'Dental chart & findings', ar: 'مخطط الأسنان والتشخيصات' },
  zahn: { de: 'Zahn', en: 'Tooth', ar: 'السن' },
  ok: { de: 'Oberkiefer', en: 'Upper jaw', ar: 'الفك العلوي' },
  uk: { de: 'Unterkiefer', en: 'Lower jaw', ar: 'الفك السفلي' },
  legendeAktuell: { de: 'Befund in diesem Termin', en: 'Finding in this visit', ar: 'تشخيص في هذا الموعد' },
  legendeFrueher: { de: 'Befund aus früheren Terminen', en: 'Finding from earlier visits', ar: 'تشخيص من مواعيد سابقة' },
  platzhalter: { de: 'Befund beschreiben …', en: 'Describe the finding …', ar: 'صف التشخيص …' },
  speichern: { de: 'Befund speichern', en: 'Save finding', ar: 'حفظ التشخيص' },
  keineBefunde: { de: 'Noch keine Befunde in diesem Termin – Zahn antippen, um einen Befund zu erfassen.', en: 'No findings in this visit yet – tap a tooth to record one.', ar: 'لا تشخيصات في هذا الموعد بعد – اضغط على سن لتسجيل تشخيص.' },
  anzahlBefunde: { de: 'Befunde in diesem Termin – Zahn antippen zum Ansehen & Bearbeiten', en: 'findings in this visit – tap a tooth to view & edit', ar: 'تشخيصات في هذا الموعد – اضغط على سن للعرض والتعديل' },
  eintraege: { de: 'Befunde an diesem Zahn (dieser Termin)', en: 'Findings on this tooth (this visit)', ar: 'تشخيصات هذا السن (هذا الموعد)' },
  frueher: { de: 'Frühere Befunde an diesem Zahn', en: 'Earlier findings on this tooth', ar: 'تشخيصات سابقة لهذا السن' },
  voll: { de: 'Vollbild öffnen', en: 'Open full screen', ar: 'فتح ملء الشاشة' },
  vollTitel: { de: 'Odontogramm', en: 'Odontogram', ar: 'مخطط الأسنان' },
  schliessen: { de: 'Schließen', en: 'Close', ar: 'إغلاق' },
  waehlen: { de: 'Zahn antippen, um Befund + Zeichnung zu erfassen', en: 'Tap a tooth to record finding + drawing', ar: 'اضغط على سن لتسجيل التشخيص والرسم' },
  malen: { de: 'Direkt auf den Zahn malen (Finger oder Stift):', en: 'Draw directly on the tooth (finger or pen):', ar: 'ارسم مباشرة على السن (بالإصبع أو القلم):' },
  zeichnungLoeschen: { de: 'Zeichnung löschen', en: 'Clear drawing', ar: 'مسح الرسم' },
  farbKaries: { de: 'Rot (Karies/Defekt)', en: 'Red (caries/defect)', ar: 'أحمر (تسوس/عيب)' },
  farbFuellung: { de: 'Blau (Füllung)', en: 'Blue (filling)', ar: 'أزرق (حشوة)' },
  farbHinweis: { de: 'Grün (Hinweis)', en: 'Green (note)', ar: 'أخضر (ملاحظة)' },
}

const SCHNELL = ['Karies', 'Füllung', 'Krone', 'Wurzelbehandlung', 'Extraktion', 'Zahnstein', 'Beobachten']

// Zeichnen im Vollbild: bewusst NUR ein roter Stift (fachliche Markierung)
const STIFT_ROT = '#dc2626'

// ---------- Anatomische Zahnformen (Box 40 x 80, Wurzel oben = Oberkiefer) ----------

// Stil wie im professionellen Praxis-Chart, vereinfacht: kompakte breite Krone,
// deutlich abgesetzte, spitz zulaufende Wurzeln.
const FORMEN = {
  // Backenzahn: breite, fast quadratische Krone, zwei gespreizte spitze Wurzeln
  molar: 'M4 58 C4 47 5 43 9 41 L7 14 Q7 6 11 6 Q15 6 15 13 L17 40 L23 40 L25 13 Q25 6 29 6 Q33 6 33 14 L31 41 C35 43 36 47 36 58 C36 70 31 77 20 77 C9 77 4 70 4 58 Z',
  // Vorbackenzahn: rundliche Krone, eine spitze Wurzel
  praemolar: 'M6 58 C6 48 8 43 13 41 L17 10 Q20 5 23 10 L27 41 C32 43 34 48 34 58 C34 69 29 76 20 76 C11 76 6 69 6 58 Z',
  // Eckzahn: spitz zulaufende Krone, lange spitze Wurzel
  eckzahn: 'M8 55 C8 47 10 43 14 41 L18 8 Q20 4 22 8 L26 41 C30 43 32 47 32 55 C32 62 28 69 24 73 L20 78 L16 73 C12 69 8 62 8 55 Z',
  // Schneidezahn: schmale Krone mit gerader Schneidekante, schlanke Wurzel
  schneidezahn: 'M9 56 C9 48 11 43 14 41 L17 9 Q20 5 23 9 L26 41 C29 43 31 48 31 56 C31 66 29 74 25 75 L15 75 C11 74 9 66 9 56 Z',
}

// ---------- Fachliche Standard-Darstellungen am Zahn ----------
// Aus den Befund-Texten abgeleitet: Krone = goldene Kappe, Wurzelbehandlung =
// rote Linie im Wurzelkanal, Füllung = blaue Fläche, Karies = roter Punkt,
// Extraktion = rotes X.
export function befundArten(texte) {
  const t = texte.join(' ').toLowerCase()
  const arten = new Set()
  if (/extraktion|extrahiert|gezogen|fehlt/.test(t)) arten.add('extraktion')
  if (/krone/.test(t)) arten.add('krone')
  if (/wurzel/.test(t)) arten.add('wurzel')
  if (/füllung|fuellung/.test(t)) arten.add('fuellung')
  if (/karies/.test(t)) arten.add('karies')
  return arten
}

// Glyphen in Zahn-Koordinaten (Box 40x80, Wurzel oben) – werden für den
// Unterkiefer zusammen mit der Zahnform gespiegelt
function ArtGlyphen({ arten }) {
  return (
    <>
      {arten.has('krone') && (
        <path d="M6 45 Q20 38 34 45 L33 66 Q20 73 7 66 Z" fill="#fbbf24" opacity="0.55" stroke="#b45309" strokeWidth="1.5" />
      )}
      {arten.has('wurzel') && <line x1="20" y1="9" x2="20" y2="39" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />}
      {arten.has('fuellung') && <circle cx="16" cy="60" r="6" fill="#2563eb" opacity="0.85" />}
      {arten.has('karies') && <circle cx="26" cy="55" r="4.5" fill="#dc2626" />}
      {arten.has('extraktion') && (
        <g stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round">
          <line x1="6" y1="10" x2="34" y2="74" />
          <line x1="34" y1="10" x2="6" y2="74" />
        </g>
      )}
    </>
  )
}

function zahnTyp(nummer) {
  const z = Number(nummer[1])
  if (z <= 2) return 'schneidezahn'
  if (z === 3) return 'eckzahn'
  if (z <= 5) return 'praemolar'
  return 'molar'
}

export default function Zahnschema({ termin, patientTermine = [], user, dunkel = false }) {
  useLang()
  const [offenerZahn, setOffenerZahn] = useState(null)
  const [vollbild, setVollbild] = useState(false)
  const befunde = termin.befunde || []

  const historieZaehne = useMemo(() => {
    const menge = new Set()
    patientTermine
      .filter((t) => t.id !== termin.id)
      .forEach((t) => (t.befunde || []).forEach((b) => menge.add(b.zahn)))
    return menge
  }, [patientTermine, termin.id])

  const aktuelleZaehne = useMemo(() => new Set(befunde.map((b) => b.zahn)), [befunde])

  function status(nummer) {
    if (aktuelleZaehne.has(nummer)) return 'aktuell'
    if (historieZaehne.has(nummer)) return 'frueher'
    return null
  }

  async function speichereBefunde(neu) {
    await withStore((s) => s.update('appointments', termin.id, { befunde: neu }))
  }

  // Zeichnungen + fachliche Symbole je Zahn – auch in der Außenansicht sichtbar
  const bilder = useMemo(() => {
    const map = {}
    befunde.forEach((b) => { if (b.bild) map[b.zahn] = b.bild })
    return map
  }, [befunde])

  const artenJeZahn = useMemo(() => {
    const texteJeZahn = {}
    const sammle = (b) => { (texteJeZahn[b.zahn] = texteJeZahn[b.zahn] || []).push(b.text || '') }
    befunde.forEach(sammle)
    patientTermine.filter((t) => t.id !== termin.id).forEach((t) => (t.befunde || []).forEach(sammle))
    const map = {}
    Object.entries(texteJeZahn).forEach(([n, texte]) => { map[n] = befundArten(texte) })
    return map
  }, [befunde, patientTermine, termin.id])

  const nebentext = dunkel ? 'text-slate-400' : 'text-slate-500'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <p className={`font-bold flex items-center gap-2 ${dunkel ? 'text-lg' : 'text-slate-800'}`}>
          🦷 {tr(T.titel)}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${
            dunkel ? 'text-praxis-300 bg-praxis-500/15' : 'text-praxis-700 bg-praxis-100'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-praxis-500 animate-pulse" /> LIVE
          </span>
        </p>
        {/* Vollbild: großes anatomisches Odontogramm mit Zeichenfunktion */}
        <button
          onClick={() => setVollbild(true)}
          className={`ml-auto inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3.5 py-2 border transition ${
            dunkel
              ? 'border-praxis-500/40 text-praxis-300 hover:bg-praxis-500/15'
              : 'border-praxis-300 text-praxis-700 hover:bg-praxis-50'
          }`}
        >
          ⛶ {tr(T.voll)}
        </button>
      </div>

      {/* Anatomisches Schema auch in der Außenansicht – Klick öffnet das Vollbild */}
      <div className="mt-3 overflow-x-auto" dir="ltr">
        <svg viewBox="-4 -14 748 314" className="min-w-[620px] w-full max-w-4xl">
          {OBEN.map((n, i) => (
            <g key={n} transform={`translate(${i * 46 + (i >= 8 ? 12 : 0)} 0)`}>
              <AnatomZahn nummer={n} status={status(n)} bild={bilder[n]} arten={artenJeZahn[n]} dunkel={dunkel}
                onClick={() => { setOffenerZahn(n); setVollbild(true) }} />
            </g>
          ))}
          <line x1="370" y1="-8" x2="370" y2="294" stroke={dunkel ? 'rgba(255,255,255,0.15)' : '#e2e8f0'} strokeDasharray="4 4" />
          {UNTEN.map((n, i) => (
            <g key={n} transform={`translate(${i * 46 + (i >= 8 ? 12 : 0)} 206)`}>
              <AnatomZahn nummer={n} unten status={status(n)} bild={bilder[n]} arten={artenJeZahn[n]} dunkel={dunkel}
                onClick={() => { setOffenerZahn(n); setVollbild(true) }} />
            </g>
          ))}
        </svg>
      </div>

      <div className={`flex flex-wrap gap-4 text-[11px] mt-1 ${nebentext}`}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-praxis-600 inline-block" /> {tr(T.legendeAktuell)}</span>
        <span className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded inline-block ${dunkel ? 'bg-slate-600' : 'bg-slate-400'}`} /> {tr(T.legendeFrueher)}</span>
      </div>

      {/* Nur eine Zusammenfassung – Details/Bearbeitung im Vollbild per Zahn-Klick */}
      <p className={`mt-3 text-sm ${nebentext}`}>
        {befunde.length === 0 ? tr(T.keineBefunde) : `${befunde.length} ${tr(T.anzahlBefunde)}`}
      </p>

      {vollbild && (
        <OdontogrammVollbild
          befunde={befunde}
          statusFuer={status}
          patientTermine={patientTermine}
          terminId={termin.id}
          user={user}
          startZahn={offenerZahn}
          onSave={speichereBefunde}
          onClose={() => { setVollbild(false); setOffenerZahn(null) }}
        />
      )}
    </div>
  )
}

// ---------- Vollbild-Odontogramm mit anatomischen Zähnen + Zeichenfunktion ----------

// Ein anatomischer Zahn (Box 40x80). Oberkiefer: Wurzel oben. Unterkiefer: gespiegelt.
function AnatomZahn({ nummer, unten, status, gewaehlt, bild, arten, dunkel = false, onClick }) {
  const fuellung = status === 'aktuell' ? '#ccfbf1' : status === 'frueher' ? (dunkel ? '#475569' : '#e2e8f0') : '#ffffff'
  const kontur = gewaehlt ? '#0d9488' : status === 'aktuell' ? '#0f766e' : '#94a3b8'
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <g transform={unten ? 'translate(0 80) scale(1 -1)' : undefined}>
        <path d={FORMEN[zahnTyp(nummer)]} fill={fuellung} stroke={kontur} strokeWidth={gewaehlt ? 3 : 1.6} />
        {/* Fachliche Standard-Symbole (Krone, Wurzelbehandlung, Füllung, Karies, X) */}
        {arten && arten.size > 0 && <g style={{ pointerEvents: 'none' }}><ArtGlyphen arten={arten} /></g>}
      </g>
      {/* Gespeicherte Zeichnung liegt passgenau auf dem Zahn */}
      {bild && <image href={bild} x="0" y="0" width="40" height="80" style={{ pointerEvents: 'none' }} />}
      {gewaehlt && <rect x="-2" y="-2" width="44" height="84" rx="8" fill="none" stroke="#0d9488" strokeWidth="2" strokeDasharray="4 3" />}
      <text
        x="20"
        y={unten ? -6 : 94}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill={gewaehlt ? '#0d9488' : '#64748b'}
        style={{ pointerEvents: 'none' }}
      >
        {nummer}
      </text>
    </g>
  )
}

function OdontogrammVollbild({ befunde, statusFuer, patientTermine, terminId, user, startZahn = null, onSave, onClose }) {
  const [zahn, setZahn] = useState(startZahn)
  const [text, setText] = useState('')
  const [hatStriche, setHatStriche] = useState(false)
  const canvasRef = useRef(null)
  const malt = useRef(false)

  // Neueste Zeichnung je Zahn (dieser Termin) für die Anzeige im Schema
  const bilder = useMemo(() => {
    const map = {}
    befunde.forEach((b) => { if (b.bild) map[b.zahn] = b.bild })
    return map
  }, [befunde])

  // Fachliche Symbole je Zahn – aus ALLEN Befund-Texten (dieser Termin + Historie)
  const artenJeZahn = useMemo(() => {
    const texteJeZahn = {}
    const sammle = (b) => { (texteJeZahn[b.zahn] = texteJeZahn[b.zahn] || []).push(b.text || '') }
    befunde.forEach(sammle)
    patientTermine.filter((t) => t.id !== terminId).forEach((t) => (t.befunde || []).forEach(sammle))
    const map = {}
    Object.entries(texteJeZahn).forEach(([n, texte]) => { map[n] = befundArten(texte) })
    return map
  }, [befunde, patientTermine, terminId])

  const fruehere = useMemo(
    () =>
      zahn
        ? patientTermine
            .filter((t) => t.id !== terminId)
            .flatMap((t) => (t.befunde || []).filter((b) => b.zahn === zahn).map((b) => ({ ...b, datum: t.datum })))
        : [],
    [patientTermine, terminId, zahn]
  )

  function zahnWaehlen(n) {
    setZahn(n)
    setText('')
    setHatStriche(false)
    // Canvas leeren, sobald es (neu) gerendert ist
    requestAnimationFrame(() => {
      const c = canvasRef.current
      if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height)
    })
  }

  // ---- Zeichnen (Finger/Stift/Maus) auf dem großen Zahn ----
  function punkt(e) {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height]
  }

  function malStart(e) {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = STIFT_ROT
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const [x, y] = punkt(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
    malt.current = true
    setHatStriche(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function malZug(e) {
    if (!malt.current) return
    const ctx = canvasRef.current.getContext('2d')
    const [x, y] = punkt(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function malEnde() {
    malt.current = false
  }

  function zeichnungLoeschen() {
    const c = canvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setHatStriche(false)
  }

  function speichern() {
    if (!text.trim() && !hatStriche) return
    const eintrag = {
      zahn,
      text: text.trim() || 'Siehe Zeichnung',
      von: user?.name || 'Team',
      at: Date.now(),
    }
    if (hatStriche) eintrag.bild = canvasRef.current.toDataURL('image/png')
    onSave([...befunde, eintrag])
    setZahn(null)
  }

  const unten = zahn && ['3', '4'].includes(zahn[0])

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/85 p-2 sm:p-4 flex" onClick={onClose}>
      <div
        className="bg-white w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="ltr"
      >
        {/* Kopfzeile */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 shrink-0">
          <p className="text-lg font-bold text-slate-900">🦷 {tr(T.vollTitel)}</p>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-praxis-100 border border-praxis-600 inline-block" /> {tr(T.legendeAktuell)}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200 border border-slate-400 inline-block" /> {tr(T.legendeFrueher)}</span>
          </div>
          <button
            onClick={onClose}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-full px-4 py-2"
          >
            <Icon name="x" className="w-4 h-4" /> {tr(T.schliessen)}
          </button>
        </div>

        {/* Großes Schema über die volle Breite */}
        <div className="flex-1 min-h-0 overflow-auto p-4 lg:p-8 flex flex-col">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{tr(T.ok)}</p>
          <svg viewBox="-4 -14 748 314" className="w-full max-h-full">
            {OBEN.map((n, i) => (
              <g key={n} transform={`translate(${i * 46 + (i >= 8 ? 12 : 0)} 0)`}>
                <AnatomZahn nummer={n} status={statusFuer(n)} gewaehlt={zahn === n} bild={bilder[n]} arten={artenJeZahn[n]} onClick={() => zahnWaehlen(n)} />
              </g>
            ))}
            <line x1="370" y1="-8" x2="370" y2="294" stroke="#e2e8f0" strokeDasharray="4 4" />
            {UNTEN.map((n, i) => (
              <g key={n} transform={`translate(${i * 46 + (i >= 8 ? 12 : 0)} 206)`}>
                <AnatomZahn nummer={n} unten status={statusFuer(n)} gewaehlt={zahn === n} bild={bilder[n]} arten={artenJeZahn[n]} onClick={() => zahnWaehlen(n)} />
              </g>
            ))}
          </svg>
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">{tr(T.uk)}</p>
          {/* Legende der fachlichen Standard-Symbole */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-4 h-3 rounded-sm inline-block" style={{ background: '#fbbf24', border: '1px solid #b45309' }} /> Krone</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-1 rounded-full inline-block" style={{ background: '#dc2626' }} /> Wurzelbehandlung</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#2563eb' }} /> Füllung</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#dc2626' }} /> Karies</span>
            <span className="flex items-center gap-1.5 font-bold" style={{ color: '#dc2626' }}>✕ <span className="font-normal text-slate-500">Extraktion</span></span>
          </div>
          {!zahn && <p className="text-center text-sm text-slate-400 mt-3">{tr(T.waehlen)}</p>}
        </div>

        {/* Zahn-Bearbeitung als POP-UP */}
        {zahn && (
          <div className="fixed inset-0 z-[80] bg-slate-900/60 flex items-center justify-center p-3" onClick={() => setZahn(null)}>
            <div className="bg-white w-full max-w-lg max-h-full overflow-y-auto rounded-3xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xl font-bold text-slate-900">
                  <span className="inline-flex items-center justify-center w-12 h-9 rounded-xl bg-praxis-600 text-white text-base mr-2">{zahn}</span>
                  {tr(T.zahn)} {zahn}
                </p>
                <button onClick={() => setZahn(null)} className="text-slate-400 hover:text-slate-700 p-1">
                  <Icon name="x" className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-5">
                {/* Großer Zahn zum Draufmalen – nur roter Stift */}
                <div className="shrink-0">
                  <div className="relative w-[170px] h-[340px] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                    <svg viewBox="0 0 40 80" className="absolute inset-0 w-full h-full">
                      <g transform={unten ? 'translate(0 80) scale(1 -1)' : undefined}>
                        <path d={FORMEN[zahnTyp(zahn)]} fill="#ffffff" stroke="#94a3b8" strokeWidth="1.2" />
                        {artenJeZahn[zahn] && <ArtGlyphen arten={artenJeZahn[zahn]} />}
                      </g>
                    </svg>
                    <canvas
                      ref={canvasRef}
                      width="170"
                      height="340"
                      className="absolute inset-0 w-full h-full"
                      style={{ touchAction: 'none' }}
                      onPointerDown={malStart}
                      onPointerMove={malZug}
                      onPointerUp={malEnde}
                      onPointerCancel={malEnde}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400 text-center w-[170px]">{tr(T.malen)}</p>
                  <button
                    onClick={zeichnungLoeschen}
                    className="mt-1 w-[170px] text-xs font-semibold text-slate-400 hover:text-red-600 border border-slate-200 rounded-full px-3 py-1.5"
                  >
                    🧽 {tr(T.zeichnungLoeschen)}
                  </button>
                </div>

                {/* Befund-Daten */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {SCHNELL.map((s) => (
                      <button
                        key={s}
                        onClick={() => setText(text ? `${text.trim()} ${s}` : s)}
                        className="text-xs font-semibold rounded-full px-3 py-1.5 border border-praxis-200 text-praxis-700 hover:bg-praxis-50"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    placeholder={`${tr(T.zahn)} ${zahn}: ${tr(T.platzhalter)}`}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-praxis-500"
                  />
                  {/* Vorhandene Befunde dieses Zahns (dieser Termin) – hier auch löschbar */}
                  {befunde.some((b) => b.zahn === zahn) && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-bold text-slate-500">{tr(T.eintraege)}:</p>
                      {befunde.map((b, i) => b.zahn === zahn && (
                        <div key={i} className="flex items-center gap-2 bg-praxis-50 border border-praxis-100 rounded-xl px-3 py-2 text-xs text-slate-700">
                          {b.bild && <img src={b.bild} alt="" className="w-5 h-9 object-contain bg-white rounded border border-slate-200" />}
                          <span className="flex-1 min-w-0">{b.text}</span>
                          <button
                            onClick={() => onSave(befunde.filter((_, idx) => idx !== i))}
                            className="text-slate-400 hover:text-red-600 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {fruehere.length > 0 && (
                    <div className="mt-3 bg-slate-50 rounded-xl px-4 py-3">
                      <p className="text-xs font-bold text-slate-500 mb-1.5">{tr(T.frueher)}:</p>
                      {fruehere.map((b, i) => (
                        <p key={i} className="text-xs text-slate-600">
                          {new Date(b.datum + 'T12:00:00').toLocaleDateString('de-DE')} – {b.text} <span className="text-slate-400">({b.von})</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={speichern}
                disabled={!text.trim() && !hatStriche}
                className="mt-4 w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl"
              >
                {tr(T.speichern)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

