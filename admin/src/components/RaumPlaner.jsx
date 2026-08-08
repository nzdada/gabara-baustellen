import { useMemo, useRef, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, t } from '@shared/i18n.js'
import { flaecheAus, umfangAus, flaechenVon } from '@shared/raumflaeche.js'
import { summeJeRaum } from '@shared/leistungen.js'
import { useWhere, withStore } from '../hooks.js'
import { parseZahlPruef } from '../csv.js'
import RaumDialog from './RaumDialog.jsx'
import { tuerenVon } from '@shared/tueren.js'
import { fortschrittAufgaben } from '@shared/raumaufgaben.js'

// Grundriss-Planer für das Büro.
//
// WARUM DRAUFSICHT UND NICHT 3D
// Vorbild war das 3D-Haus aus C:\Users\dadah\ecoflow-3d-haus. Zum ANSEHEN ist
// das stark, zum ANLEGEN nicht: In einer gedrehten Szene ein Rechteck genau zu
// treffen, ist mit Maus wie mit Finger fummelig – und "schwer zu bedienen" war
// genau die Rückmeldung, die diesen Umbau ausgelöst hat. Die Draufsicht ist
// dieselbe Ansicht, die auch der Bauplan hat: maßstäblich, eindeutig, und jeder
// Raum lässt sich zusätzlich über Zahlen eingeben statt zu ziehen.
//
// EINHEIT IST METER. Gespeichert werden x, y, breite, laenge in Metern; die
// Fläche wird daraus gerechnet und NICHT getrennt gepflegt – zwei Quellen für
// dieselbe Zahl laufen sonst auseinander. Ausnahme: Räume aus einem Bauplan-
// Import bringen ihre Fläche mit, ohne Maße; dort bleibt flaeche führend.

const RASTER = 0.25          // m – Fangraster beim Ziehen
// Türen im Grundriss zeichnen.
//
// Ein Architekt zeichnet eine Tür als drei Dinge: eine LÜCKE in der Wand, das
// Türblatt und den Aufschlagbogen. Genau so entsteht sie hier – ein bloßer
// Strich wäre von einer Wandfuge nicht zu unterscheiden.
//
// Die Lücke wird über die Wand gemalt, nicht aus ihr herausgerechnet: Das
// Raumrechteck ist EIN SVG-Element mit umlaufender Kontur, aus dem sich nichts
// herausschneiden lässt, ohne es in vier Einzelwände zu zerlegen.
function tuerFormen(raum, x, y, b, h, skala) {
  const raus = []
  for (const tu of tuerenVon(raum)) {
    const breite = Math.max(8, (Number(tu.breite) || 0.885) * skala)
    const pos = Math.max(0, Math.min(1, Number(tu.position) || 0.5))
    let mx, my, dx, dy, nx, ny
    if (tu.wand === 'wandN')      { mx = x + pos * b; my = y;     dx = 1; dy = 0; nx = 0; ny = 1 }
    else if (tu.wand === 'wandS') { mx = x + pos * b; my = y + h; dx = 1; dy = 0; nx = 0; ny = -1 }
    else if (tu.wand === 'wandW') { mx = x; my = y + pos * h;     dx = 0; dy = 1; nx = 1; ny = 0 }
    else                          { mx = x + b; my = y + pos * h; dx = 0; dy = 1; nx = -1; ny = 0 }

    const ax = mx - (dx * breite) / 2
    const ay = my - (dy * breite) / 2
    const bx = mx + (dx * breite) / 2
    const by = my + (dy * breite) / 2
    raus.push({
      id: tu.id || `${raum.id}-${tu.wand}-${pos}`,
      lueckeVon: [ax, ay],
      lueckeBis: [bx, by],
      // Türblatt: vom Angelpunkt senkrecht in den Raum
      blattVon: [ax, ay],
      blattBis: [ax + nx * breite, ay + ny * breite],
      // Aufschlagbogen vom Blattende zurück zur anderen Laibung
      bogen: `M ${ax + nx * breite} ${ay + ny * breite} A ${breite} ${breite} 0 0 ${(dx * ny - dy * nx) > 0 ? 1 : 0} ${bx} ${by}`,
    })
  }
  return raus
}

const PX_JE_M = 26           // Grundzoom
const FARBEN = ['#8b1a1a', '#0e7490', '#4d7c0f', '#a16207', '#6d28d9', '#be185d']

function runde(n, s = 2) { const f = 10 ** s; return Math.round((Number(n) || 0) * f) / f }
function fang(n) { return Math.round(n / RASTER) * RASTER }

export default function RaumPlaner({ projektId, user }) {
  useLang()
  const raeume = useWhere('raeume', 'projektId', projektId)
  const meldungen = useWhere('leistungen', 'projektId', projektId)
  const [zoom, setZoom] = useState(1)
  const [gewaehlt, setGewaehlt] = useState(null)
  const [zieht, setZieht] = useState(null)      // { id, art, startX, startY, raum }
  const [dialog, setDialog] = useState(null)   // Raum-Fenster
  const flaecheRef = useRef(null)

  const sichtbar = useMemo(
    () => raeume.filter((r) => r.aktiv !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    [raeume]
  )
  const gemeldet = useMemo(() => summeJeRaum(meldungen), [meldungen])

  const gesamt = useMemo(
    () => runde(sichtbar.reduce((s, r) => s + (Number(r.flaeche) || flaecheAus(r.breite, r.laenge)), 0)),
    [sichtbar]
  )

  const skala = PX_JE_M * zoom

  // Zeichenfläche so groß, dass alle Räume hineinpassen (mit Rand)
  const grenzen = useMemo(() => {
    if (!sichtbar.length) return { breite: 20, hoehe: 14 }
    const maxX = Math.max(...sichtbar.map((r) => (Number(r.x) || 0) + (Number(r.breite) || 0)))
    const maxY = Math.max(...sichtbar.map((r) => (Number(r.y) || 0) + (Number(r.laenge) || 0)))
    return { breite: Math.max(20, maxX + 3), hoehe: Math.max(14, maxY + 3) }
  }, [sichtbar])

  async function speichern(id, felder) {
    await withStore((s) => s.update('raeume', id, felder))
  }

  async function neuerRaum() {
    // Freien Platz rechts neben dem letzten Raum suchen – niemals übereinander
    const maxX = sichtbar.length
      ? Math.max(...sichtbar.map((r) => (Number(r.x) || 0) + (Number(r.breite) || 0)))
      : 1
    const id = await withStore((s) => s.add('raeume', {
      projektId,
      name: '', nummer: '', bereich: '',
      x: runde(maxX + 0.5), y: 1,
      breite: 4, laenge: 3,
      flaeche: 12, umfang: umfangAus(4, 3),
      hoehe: 0, tueren: 1, fenster: 1,
      farbe: FARBEN[sichtbar.length % FARBEN.length],
      sort: sichtbar.length, fertig: false, aktiv: true, notiz: '',
      herkunft: 'hand', erstelltAm: Date.now(),
    }))
    setGewaehlt(id)
  }

  // --- Ziehen: verschieben und Größe ändern ---
  function zeigerAb(e, raum, art) {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setGewaehlt(raum.id)
    setZieht({ id: raum.id, art, startX: e.clientX, startY: e.clientY, raum: { ...raum } })
  }

  function zeigerBewegt(e) {
    if (!zieht) return
    const dx = (e.clientX - zieht.startX) / skala
    const dy = (e.clientY - zieht.startY) / skala
    const r = zieht.raum
    const neu = zieht.art === 'schieben'
      ? { x: Math.max(0, fang(r.x + dx)), y: Math.max(0, fang(r.y + dy)) }
      : { breite: Math.max(0.5, fang(r.breite + dx)), laenge: Math.max(0.5, fang(r.laenge + dy)) }
    setZieht({ ...zieht, vorschau: { ...r, ...neu } })
  }

  async function zeigerAuf() {
    if (!zieht) return
    const v = zieht.vorschau
    setZieht(null)
    if (!v) return
    const felder = zieht.art === 'schieben'
      ? { x: v.x, y: v.y }
      : { breite: v.breite, laenge: v.laenge, flaeche: flaecheAus(v.breite, v.laenge), umfang: umfangAus(v.breite, v.laenge) }
    await speichern(zieht.id, felder)
  }

  function anzeige(r) {
    return zieht?.vorschau && zieht.id === r.id ? zieht.vorschau : r
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={neuerRaum}
          className="px-4 min-h-11 flex items-center gap-2 rounded-feld bg-praxis-600 text-white text-sm font-bold hover:bg-praxis-700"
        >
          <Icon name="plus" className="w-4 h-4" /> {t('raum.neu')}
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(0.4, runde(z - 0.2, 1)))}
            className="w-11 h-11 rounded-feld border border-rahmen text-lg font-bold">−</button>
          <button onClick={() => setZoom((z) => Math.min(3, runde(z + 0.2, 1)))}
            className="w-11 h-11 rounded-feld border border-rahmen text-lg font-bold">+</button>
        </div>
        <p className="ml-auto text-sm">
          <span className="text-schrift-leise">{t('raum.gesamtflaeche')}</span>{' '}
          <strong className="text-schrift-stark">{gesamt.toLocaleString('de-DE')} m²</strong>
          <span className="text-schrift-zart"> · {sichtbar.length} {t('raum.raeume')}</span>
        </p>
      </div>

      {/* Zeichenfläche */}
      <div
        ref={flaecheRef}
        className="relative overflow-auto rounded-karte border border-rahmen bg-gedeckt"
        style={{ maxHeight: '60vh' }}
        onPointerMove={zeigerBewegt}
        onPointerUp={zeigerAuf}
        onPointerCancel={zeigerAuf}
      >
        <svg
          width={grenzen.breite * skala}
          height={grenzen.hoehe * skala}
          className="block touch-none select-none"
          style={{ touchAction: 'none' }}
        >
          {/* Meterraster – der Maßstab muss ablesbar sein */}
          <defs>
            <pattern id="raster" width={skala} height={skala} patternUnits="userSpaceOnUse">
              <path d={`M ${skala} 0 L 0 0 0 ${skala}`} fill="none"
                stroke="var(--color-rahmen)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#raster)" />

          {sichtbar.map((roh) => {
            const r = anzeige(roh)
            const b = (Number(r.breite) || 0) * skala
            const h = (Number(r.laenge) || 0) * skala
            const x = (Number(r.x) || 0) * skala
            const y = (Number(r.y) || 0) * skala
            const flaeche = Number(r.flaeche) || flaecheAus(r.breite, r.laenge)
            const ist = gemeldet[roh.id] || 0
            const aktiv = gewaehlt === roh.id
            return (
              <g key={roh.id}>
                <rect
                  x={x} y={y} width={b} height={h} rx="4"
                  fill={roh.farbe || FARBEN[0]} fillOpacity={roh.fertig ? 0.35 : 0.16}
                  stroke={roh.farbe || FARBEN[0]} strokeWidth={aktiv ? 3 : 1.5}
                  className="cursor-move"
                  onPointerDown={(e) => zeigerAb(e, roh, 'schieben')}
                  onDoubleClick={() => setDialog(roh)}
                />
                {b > 60 && h > 34 && (
                  <>
                    <text x={x + 8} y={y + 18} fontSize="12" fontWeight="700" fill="var(--color-schrift-stark)">
                      {roh.nummer ? `${roh.nummer} ` : ''}{roh.name || t('raum.ohneName')}
                    </text>
                    <text x={x + 8} y={y + 34} fontSize="11" fill="var(--color-schrift-leise)">
                      {flaeche.toLocaleString('de-DE')} m²
                      {(() => { const fa = fortschrittAufgaben(roh); return fa.hatAufgaben ? ` · ${fa.prozent} %` : '' })()}
                    </text>
                  </>
                )}
                {/* Türen: Lücke, Türblatt, Aufschlagbogen */}
                {tuerFormen(roh, x, y, b, h, skala).map((tu) => (
                  <g key={tu.id} pointerEvents="none">
                    <line
                      x1={tu.lueckeVon[0]} y1={tu.lueckeVon[1]} x2={tu.lueckeBis[0]} y2={tu.lueckeBis[1]}
                      stroke="var(--color-karte)" strokeWidth={aktiv ? 5 : 3.5} strokeLinecap="butt"
                    />
                    <line
                      x1={tu.blattVon[0]} y1={tu.blattVon[1]} x2={tu.blattBis[0]} y2={tu.blattBis[1]}
                      stroke={roh.farbe || FARBEN[0]} strokeWidth="2" strokeLinecap="round"
                    />
                    <path d={tu.bogen} fill="none" stroke={roh.farbe || FARBEN[0]} strokeWidth="1" strokeDasharray="3 2" opacity="0.75" />
                  </g>
                ))}
                {/* Griff unten rechts zum Vergrößern – bewusst 18 px, mit Finger treffbar */}
                <rect
                  x={x + b - 18} y={y + h - 18} width="18" height="18" rx="3"
                  fill={roh.farbe || FARBEN[0]} className="cursor-nwse-resize"
                  onPointerDown={(e) => zeigerAb(e, roh, 'groesse')}
                />
              </g>
            )
          })}
        </svg>

        {!sichtbar.length && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
            <Icon name="raum" className="w-10 h-10 text-schrift-zart mb-2" />
            <p className="text-sm text-schrift-leise">{t('raum.leerHinweis')}</p>
          </div>
        )}
      </div>

      <p className="text-[12px] text-schrift-zart -mt-2">{t('raum.planHilfe')}</p>

      {dialog && (
        <RaumDialog
          raum={sichtbar.find((r) => r.id === dialog.id) || dialog}
          projektId={projektId} user={user} onClose={() => setDialog(null)}
        />
      )}

      {/* Tabelle: derselbe Raum, in Zahlen. Wer nicht ziehen will, tippt hier. */}
      {sichtbar.length > 0 && (
        <div className="overflow-x-auto rounded-karte border border-rahmen">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-rahmen text-left">
                {['raum.nummer', 'raum.name', 'raum.breite', 'raum.laenge', 'raum.flaeche', 'raum.wand', 'raum.fertig', '']
                  .map((k, i) => (
                    <th key={i} className="px-2 py-2 text-[12px] font-bold uppercase tracking-wide text-schrift-zart">
                      {k ? t(k) : ''}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {sichtbar.map((r) => <Zeile key={r.id} raum={r} onSpeichern={speichern} gewaehlt={gewaehlt === r.id} onWahl={setGewaehlt} onOeffnen={setDialog} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Eine Zeile der Tabelle. Maße hier zu ändern verschiebt das Rechteck im
// Grundriss – es ist dieselbe Zahl, nur anders eingegeben.
function Zeile({ raum, onSpeichern, gewaehlt, onWahl, onOeffnen }) {
  const f = flaechenVon(raum)
  const feld = 'w-20 rounded-feld border border-rahmen px-2 py-1.5 text-sm text-right'

  async function masse(feldName, roh) {
    const g = parseZahlPruef(roh)
    if (g.leer || !g.ok || g.wert <= 0) return
    const neu = { ...raum, [feldName]: g.wert }
    await onSpeichern(raum.id, {
      [feldName]: g.wert,
      flaeche: flaecheAus(neu.breite, neu.laenge),
      umfang: umfangAus(neu.breite, neu.laenge),
    })
  }

  return (
    <tr
      className={`border-b border-rahmen last:border-0 ${gewaehlt ? 'bg-praxis-50' : ''}`}
      onClick={() => onWahl(raum.id)}
    >
      <td className="px-2 py-1.5">
        <input className="w-20 rounded-feld border border-rahmen px-2 py-1.5 text-sm"
          defaultValue={raum.nummer || ''} placeholder="1.01"
          onBlur={(e) => onSpeichern(raum.id, { nummer: e.target.value.trim() })} />
      </td>
      <td className="px-2 py-1.5">
        <input className="w-full min-w-[140px] rounded-feld border border-rahmen px-2 py-1.5 text-sm"
          defaultValue={raum.name || ''} placeholder={t('raum.namePlatz')}
          onBlur={(e) => onSpeichern(raum.id, { name: e.target.value.trim() })} />
      </td>
      <td className="px-2 py-1.5">
        <input className={feld} inputMode="decimal" defaultValue={raum.breite ?? ''}
          onBlur={(e) => masse('breite', e.target.value)} />
      </td>
      <td className="px-2 py-1.5">
        <input className={feld} inputMode="decimal" defaultValue={raum.laenge ?? ''}
          onBlur={(e) => masse('laenge', e.target.value)} />
      </td>
      <td className="px-2 py-1.5 text-right font-bold text-schrift-stark whitespace-nowrap">
        {f.boden.toLocaleString('de-DE')} m²
      </td>
      <td className="px-2 py-1.5 text-right whitespace-nowrap">
        {f.wand.toLocaleString('de-DE')} m²
        {f.geschaetzt && (
          <span className="ml-1 text-[11px] font-bold text-amber-700" title={t('raum.geschaetztHilfe')}>
            {t('raum.geschaetzt')}
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">
        <input type="checkbox" checked={Boolean(raum.fertig)} className="w-5 h-5 accent-emerald-600"
          onChange={(e) => onSpeichern(raum.id, { fertig: e.target.checked })} />
      </td>
      <td className="px-2 py-1.5 text-right whitespace-nowrap">
        <button
          onClick={(e) => { e.stopPropagation(); onOeffnen(raum) }}
          className="px-3 min-h-11 rounded-feld border border-rahmen text-xs font-bold hover:bg-gedeckt"
        >
          {t('raum.oeffnen')}
        </button>
        <button
          onClick={async (e) => {
            e.stopPropagation()
            if (!confirm(t('raum.loeschenFrage', { name: raum.name || raum.nummer || '?' }))) return
            // Endgültig löschen. Gemeldete Mengen (Sammlung 'leistungen') hängen
            // an der Position, nicht am Raum – sie bleiben erhalten und behalten
            // den Raumnamen als Schnappschuss.
            await withStore((s) => s.remove('raeume', raum.id))
          }}
          className="ml-1 text-schrift-zart hover:text-red-600 px-2 min-h-11"
          title={t('raum.loeschen')}
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}
