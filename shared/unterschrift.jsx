import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang, t } from './i18n.js'

// Unterschrift auf dem Handy.
//
// Warum ein Popup statt eines Feldes mitten im Formular:
// Auf der Baustelle wird mit dem Finger unterschrieben. In einem 144 px hohen
// Streifen inmitten eines scrollenden Formulars ist das praktisch unmöglich –
// die Fläche ist zu klein, und jede Fingerbewegung kann die Seite mitscrollen.
// Der Dialog nimmt den ganzen Bildschirm ein: viel Platz, nichts scrollt weg.
//
// Zwei echte Zeichenfehler sind hier ebenfalls behoben:
// 1. Die Zeichenfläche wurde nur EINMAL beim Einbau vermessen. War sie zu dem
//    Zeitpunkt noch nicht sichtbar (eingeklappter Abschnitt) oder drehte man das
//    Handy, passten Fingerposition und Strich nicht mehr zusammen – man zeichnete
//    daneben oder gar nicht. Jetzt wird bei jeder Größenänderung neu vermessen.
// 2. Ohne Zeigererfassung (setPointerCapture) riss der Strich ab, sobald der
//    Finger kurz über den Rand ging; onPointerLeave beendete ihn zusätzlich
//    mitten in der Bewegung. Beides ist weg.
//
// Die Striche werden als Punktlisten gehalten, nicht nur als Pixel. Dadurch
// lässt sich nach einer Drehung sauber neu zeichnen, statt zu verpixeln.

const FARBE = '#1e293b'

function zeichneAlles(canvas, striche) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = FARBE
  for (const strich of striche) {
    if (!strich.length) continue
    ctx.beginPath()
    if (strich.length === 1) {
      // Ein einzelner Tipp ist auch eine Markierung – als Punkt zeichnen
      ctx.arc(strich[0].x, strich[0].y, 1.25, 0, Math.PI * 2)
      ctx.fillStyle = FARBE
      ctx.fill()
      continue
    }
    ctx.moveTo(strich[0].x, strich[0].y)
    for (let i = 1; i < strich.length; i++) ctx.lineTo(strich[i].x, strich[i].y)
    ctx.stroke()
  }
}

// Die eigentliche Zeichenfläche. Meldet über onStriche, ob etwas gezeichnet ist.
function Zeichenflaeche({ canvasRef, striche, onStriche, klasse, hinweis }) {
  const zeichnet = useRef(false)
  const [leer, setLeer] = useState(() => striche.current.length === 0)

  // Größe an die tatsächliche Anzeigefläche anpassen – beim Öffnen und bei
  // jeder Drehung. Ohne das zeichnet der Finger neben dem Strich.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const messen = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const b = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (!b || !h) return          // noch nicht sichtbar – später erneut
      if (canvas.width === b && canvas.height === h) return
      canvas.width = b
      canvas.height = h
      zeichneAlles(canvas, striche.current)
    }
    messen()
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(canvas)
    return () => beobachter.disconnect()
  }, [canvasRef, striche])

  function punkt(e) {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function start(e) {
    e.preventDefault()
    // Zeigererfassung: alle weiteren Bewegungen kommen hier an, auch wenn der
    // Finger den Rand der Fläche verlässt.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ältere Browser */ }
    zeichnet.current = true
    striche.current.push([punkt(e)])
    if (leer) setLeer(false)
    zeichneAlles(canvasRef.current, striche.current)
    onStriche?.()
  }

  function ziehen(e) {
    if (!zeichnet.current) return
    e.preventDefault()
    const aktuell = striche.current[striche.current.length - 1]
    // getCoalescedEvents liefert die Zwischenpunkte schneller Bewegungen –
    // ohne sie wird eine zügige Unterschrift eckig.
    const rohe = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
    for (const r of (rohe.length ? rohe : [e])) aktuell.push(punkt(r))
    zeichneAlles(canvasRef.current, striche.current)
    onStriche?.()
  }

  function ende(e) {
    if (!zeichnet.current) return
    zeichnet.current = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* egal */ }
    onStriche?.()
  }

  return (
    <div className="relative flex-1 min-h-0">
      <canvas
        ref={canvasRef}
        className={klasse}
        // touchAction bewusst als fester Stil, nicht als Hilfsklasse: ohne
        // 'none' scrollt der Finger auf dem Handy die Seite, statt zu zeichnen.
        // Genau daran ist das Unterschreiben vorher gescheitert. Diese eine
        // Eigenschaft darf nicht davon abhaengen, ob ein Baulauf sie erzeugt.
        // Weiss BEWUSST als Stil-Attribut, nicht als Klasse: im dunklen Bild
        // biegt eine CSS-Regel bg-white auf die dunkle Karte um – hier waere
        // das fatal, dunkle Tinte auf dunklem Grund. Das Attribut sticht die Regel.
        style={{ touchAction: 'none', backgroundColor: '#ffffff' }}
        onPointerDown={start}
        onPointerMove={ziehen}
        onPointerUp={ende}
        onPointerCancel={ende}
      />
      {leer && (
        <p style={{ color: '#b8bec9' }} className="absolute inset-0 flex items-center justify-center text-sm pointer-events-none px-4 text-center">
          {hinweis || t('unterschrift.hinweis')}
        </p>
      )}
      {/* Unterschriftslinie wie auf Papier – gibt dem Finger eine Orientierung */}
      <div className="absolute left-6 right-6 bottom-10 border-b border-slate-200 pointer-events-none" />
    </div>
  )
}

// Vollbild-Dialog zum Unterschreiben
function UnterschriftDialog({ hinweis, onFertig, onAbbruch }) {
  useLang()
  const canvasRef = useRef(null)
  const striche = useRef([])
  const [hatStrich, setHatStrich] = useState(false)

  // Seite darf im Hintergrund nicht scrollen, solange unterschrieben wird
  useEffect(() => {
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const taste = (e) => { if (e.key === 'Escape') onAbbruch() }
    window.addEventListener('keydown', taste)
    return () => {
      document.body.style.overflow = vorher
      window.removeEventListener('keydown', taste)
    }
  }, [onAbbruch])

  function loeschen() {
    striche.current = []
    zeichneAlles(canvasRef.current, striche.current)
    setHatStrich(false)
  }

  function uebernehmen() {
    if (!hatStrich) return
    // Losgelöste Kopie: der Dialog verschwindet gleich, die Zeichnung bleibt.
    const quelle = canvasRef.current
    const kopie = document.createElement('canvas')
    kopie.width = quelle.width
    kopie.height = quelle.height
    kopie.getContext('2d').drawImage(quelle, 0, 0)
    onFertig(kopie)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/70 flex flex-col p-3 sm:p-6" dir="ltr">
      <div className="bg-karte rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-rahmen flex items-center justify-between shrink-0">
          <p className="font-bold text-schrift-stark">{t('unterschrift.titel')}</p>
          <button type="button" onClick={onAbbruch} className="text-sm text-schrift-leise px-2 py-1">
            {t('unterschrift.abbrechen')}
          </button>
        </div>
        <Zeichenflaeche
          canvasRef={canvasRef}
          striche={striche}
          onStriche={() => setHatStrich(striche.current.length > 0)}
          hinweis={hinweis}
          klasse="w-full h-full bg-white touch-none block"
        />
        <div className="px-4 py-3 border-t border-rahmen flex items-center gap-3 shrink-0">
          <button
            type="button" onClick={loeschen}
            className="px-4 py-3 rounded-xl border border-rahmen-stark text-sm font-medium text-schrift"
          >
            {t('unterschrift.loeschen')}
          </button>
          <button
            type="button" onClick={uebernehmen} disabled={!hatStrich}
            className="flex-1 px-4 py-3 rounded-xl bg-praxis-600 text-white font-bold disabled:opacity-40"
          >
            {t('unterschrift.uebernehmen')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Im Formular steht nur noch ein Knopf bzw. die fertige Unterschrift.
export function UnterschriftFeld({ onAenderung, hinweis = '' }) {
  useLang()
  const [offen, setOffen] = useState(false)
  const [vorschau, setVorschau] = useState('')

  function fertig(canvas) {
    setVorschau(unterschriftAlsDataUrl(canvas))
    setOffen(false)
    onAenderung(canvas)
  }

  function verwerfen() {
    setVorschau('')
    onAenderung(null)
  }

  return (
    <div>
      {vorschau ? (
        <div>
          <img
            src={vorschau} alt=""
            style={{ backgroundColor: '#ffffff' }}
            className="w-full h-28 object-contain border border-rahmen rounded-2xl"
          />
          <div className="mt-1.5 flex gap-3">
            <button type="button" onClick={() => setOffen(true)} className="text-xs text-praxis-600 font-medium">
              {t('unterschrift.aendern')}
            </button>
            <button type="button" onClick={verwerfen} className="text-xs text-schrift-leise hover:text-red-600">
              {t('unterschrift.loeschen')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="w-full h-28 bg-karte border-2 border-dashed border-rahmen-stark rounded-2xl
                     flex flex-col items-center justify-center gap-1 text-schrift-leise
                     active:bg-gedeckt"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-6 h-6">
            <path d="M3 19c3-1 4-8 7-8s2 5 4 5 3-3 5-3" strokeLinecap="round" />
            <path d="M3 21h18" strokeLinecap="round" opacity=".4" />
          </svg>
          <span className="text-sm font-medium">{hinweis || t('unterschrift.oeffnen')}</span>
        </button>
      )}
      {offen && (
        <UnterschriftDialog
          hinweis={hinweis}
          onFertig={fertig}
          onAbbruch={() => setOffen(false)}
        />
      )}
    </div>
  )
}

// Canvas -> kleines PNG-Daten-URL (400×150) fürs Firestore-Dokument und den
// Ausdruck.
//
// Zugeschnitten wird auf den tatsächlich beschriebenen Bereich, NICHT auf die
// ganze Zeichenfläche. Der Dialog ist hochkant (z. B. 700×1268), das Ziel
// querformat: passte man die volle Fläche ein, bliebe die Unterschrift ein
// 82 px schmaler Fussel in der Mitte eines fast leeren Bildes. Auf dem
// Regiebericht muss sie lesbar sein – sie ist dort ein Beweismittel.
export function unterschriftAlsDataUrl(canvas) {
  if (!canvas || !canvas.width || !canvas.height) return ''
  const { width: qw, height: qh } = canvas
  const punkte = canvas.getContext('2d').getImageData(0, 0, qw, qh).data

  // Umschließendes Rechteck aller gesetzten Punkte suchen
  let x1 = qw, y1 = qh, x2 = -1, y2 = -1
  for (let y = 0; y < qh; y++) {
    for (let x = 0; x < qw; x++) {
      if (punkte[(y * qw + x) * 4 + 3] > 10) {
        if (x < x1) x1 = x
        if (x > x2) x2 = x
        if (y < y1) y1 = y
        if (y > y2) y2 = y
      }
    }
  }
  if (x2 < 0) return ''   // nichts gezeichnet

  // Etwas Luft rundum, damit die Unterschrift nicht am Rand klebt
  const luft = Math.round(Math.max(qw, qh) * 0.03)
  x1 = Math.max(0, x1 - luft); y1 = Math.max(0, y1 - luft)
  x2 = Math.min(qw - 1, x2 + luft); y2 = Math.min(qh - 1, y2 + luft)
  const aw = x2 - x1 + 1
  const ah = y2 - y1 + 1

  const B = 400
  const H = 150
  const klein = document.createElement('canvas')
  klein.width = B
  klein.height = H
  const ctx = klein.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, B, H)
  const faktor = Math.min(B / aw, H / ah)
  const b = aw * faktor
  const h = ah * faktor
  ctx.drawImage(canvas, x1, y1, aw, ah, (B - b) / 2, (H - h) / 2, b, h)
  return klein.toDataURL('image/png')
}
