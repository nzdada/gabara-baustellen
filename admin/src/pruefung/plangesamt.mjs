// Gesamtprobe: Die Produktionsmodule gegen den echten Plan halten.
import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { linienAus, massstabAus, raeumeAusGeometrie, tuerenAus, tuerenZuordnen } from './shared/planGeometrie.js'
import { woerterAus, flaechenAus, stempelZu } from './shared/planImport.js'

const dok = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])) }).promise
const seite = await dok.getPage(1)
const sicht = seite.getViewport({ scale: 1 })

// --- Text wie in seiteAuswerten ---
const inhalt = await seite.getTextContent()
const woerter = woerterAus(inhalt, sicht.height)
const flaechen = flaechenAus(woerter)
const raeume = flaechen.map((f) => {
  const st = stempelZu(f, woerter)
  return { nummer: st.nummer, name: st.name, flaeche: Math.round(f.flaeche * 100) / 100, x: f.x, y: f.y }
})
console.log(`Text: ${raeume.length} Raeume, Summe ${Math.round(raeume.reduce((s, r) => s + r.flaeche, 0) * 100) / 100} m²`)

// --- Geometrie ---
const ops = await seite.getOperatorList()
const linien = linienAus(ops, pdfjs.OPS)
const stempel = raeume.map((r) => ({ nummer: r.nummer, flaeche: r.flaeche, x: r.x, y: sicht.height - r.y + 10 }))
const m = massstabAus(stempel, linien)
console.log(`Massstab: ${m.name} (${m.treffer}/${stempel.length} Treffer)`)

const { raeume: mitGeo, nullpunkt } = raeumeAusGeometrie(stempel, linien, { skala: m.skala })
const gefunden = tuerenAus(linien.boegen, m.skala)
const jeRaum = tuerenZuordnen(mitGeo, gefunden, nullpunkt)
console.log(`Tueren erkannt: ${gefunden.length}, davon zugeordnet: ${[...jeRaum.values()].reduce((s, l) => s + l.length, 0)}`)

console.log('\nNr        Name                  Flaeche   Masse (m)        Lage (m)      Tueren')
let ueberlappungen = 0
const boxen = []
for (let i = 0; i < raeume.length; i++) {
  const r = raeume[i]
  const g = mitGeo[i]
  const tu = jeRaum.get(r.nummer || r.name) || []
  console.log(
    (r.nummer || '?').padEnd(10),
    (r.name || '–').slice(0, 20).padEnd(22),
    String(r.flaeche).padStart(7),
    g.breite != null ? `${g.breite} x ${g.laenge}`.padEnd(16) : 'ohne'.padEnd(16),
    g.x != null ? `${g.x} / ${g.y}`.padEnd(13) : '–'.padEnd(13),
    tu.map((t) => `${t.wand.slice(4)}@${Math.round(t.position * 100)}%`).join(' ') || '–',
    g.geschaetzt ? '  (Form geschaetzt)' : ''
  )
  if (g.x != null) boxen.push({ nr: r.nummer, x: g.x, y: g.y, b: g.breite, l: g.laenge })
}

// Ueberlappungsprobe: der Kern der Beschwerde "Raeume liegen ineinander"
for (let i = 0; i < boxen.length; i++) {
  for (let j = i + 1; j < boxen.length; j++) {
    const a = boxen[i], b = boxen[j]
    const ux = Math.min(a.x + a.b, b.x + b.b) - Math.max(a.x, b.x)
    const uy = Math.min(a.y + a.l, b.y + b.l) - Math.max(a.y, b.y)
    if (ux > 0.35 && uy > 0.35) {
      ueberlappungen++
      if (ueberlappungen <= 6) console.log(`  Ueberlappung: ${a.nr} / ${b.nr} → ${ux.toFixed(2)} x ${uy.toFixed(2)} m`)
    }
  }
}
let xmax = 0, ymax = 0
for (const b of boxen) { xmax = Math.max(xmax, b.x + b.b); ymax = Math.max(ymax, b.y + b.l) }
console.log(`\nGrundriss: ${xmax.toFixed(1)} x ${ymax.toFixed(1)} m · Ueberlappungen: ${ueberlappungen}`)
