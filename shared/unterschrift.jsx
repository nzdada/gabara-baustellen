import { useEffect, useRef, useState } from 'react'

// Unterschriften-Feld (erprobt aus dem box-therapie-Projekt):
// Zeichnen per Finger/Stift/Maus über Pointer Events, 'touch-none' verhindert
// Scrollen beim Unterschreiben, interne Auflösung ×2 für scharfe Linien.
// Speicherung: unterschriftAlsDataUrl(canvas) -> kleines 400×150-PNG (<~20 KB).

export function UnterschriftFeld({ onAenderung, hinweis = 'Hier mit Finger oder Maus unterschreiben' }) {
  const canvasRef = useRef(null)
  const zeichnet = useRef(false)
  const [leer, setLeer] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e293b'
  }, [])

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function start(e) {
    e.preventDefault()
    zeichnet.current = true
    const ctx = canvasRef.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function ziehen(e) {
    if (!zeichnet.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (leer) setLeer(false)
    onAenderung(canvasRef.current)
  }

  function ende() { zeichnet.current = false }

  function loeschen() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setLeer(true)
    onAenderung(null)
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-36 bg-white border-2 border-dashed border-slate-300 rounded-2xl touch-none"
          onPointerDown={start}
          onPointerMove={ziehen}
          onPointerUp={ende}
          onPointerLeave={ende}
        />
        {leer && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-300 pointer-events-none">
            {hinweis}
          </p>
        )}
      </div>
      <button type="button" onClick={loeschen} className="mt-2 text-xs text-slate-500 hover:text-praxis-600">
        Unterschrift löschen
      </button>
    </div>
  )
}

// Canvas -> kleines PNG-Daten-URL (400×150), passend fürs Firestore-Dokument
export function unterschriftAlsDataUrl(canvas) {
  if (!canvas) return ''
  const klein = document.createElement('canvas')
  klein.width = 400
  klein.height = 150
  const ctx = klein.getContext('2d')
  ctx.drawImage(canvas, 0, 0, 400, 150)
  return klein.toDataURL('image/png')
}
